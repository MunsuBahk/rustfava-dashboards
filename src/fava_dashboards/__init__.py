"""Rustfava adapter for the fava-dashboards frontend."""

from __future__ import annotations

import datetime
import json
from collections import OrderedDict
from threading import RLock
import traceback
from decimal import Decimal
from pathlib import Path
from typing import Any

from flask import jsonify
from flask import request
from rustfava.context import g
from rustfava.core.query_shell import FavaQueryRunner
from rustfava.ext import RustfavaExtensionBase
from rustfava.ext import extension_endpoint
from rustfava.helpers import RustfavaAPIError
from rustfava.rustledger.types import RLAmount
from rustfava.rustledger.types import RLPosition

from .period_cache import PeriodCache


def api_response(func):
    """Keep the response envelope expected by the upstream frontend."""

    def decorator(*args, **kwargs):
        try:
            return jsonify({"success": True, "data": func(*args, **kwargs)})
        except RustfavaAPIError as error:
            return jsonify({"success": False, "error": error.message}), 500
        except Exception as error:  # noqa: BLE001 - API errors must use the frontend response envelope.
            traceback.print_exception(error)
            return jsonify({"success": False, "error": str(error)}), 500

    decorator.__name__ = func.__name__
    return decorator


SCRIPT_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".cjs", ".mjs"]


def _json_value(value: Any) -> Any:
    """Convert rustledger query values to the shapes used by fava-dashboards."""
    if isinstance(value, RLAmount):
        return {"number": float(value.number), "currency": value.currency}
    if isinstance(value, RLPosition):
        cost = value.cost
        return {
            "units": _json_value(value.units),
            "cost": (
                {
                    "number": _json_value(cost.number),
                    "currency": cost.currency,
                    "date": _json_value(cost.date),
                }
                if cost is not None
                else None
            ),
        }
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): _json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set, frozenset)):
        return [_json_value(item) for item in value]
    if hasattr(value, "items"):
        return {str(key): _json_value(item) for key, item in value.items()}
    return value


def _clean_meta(meta: dict[str, Any]) -> dict[str, Any]:
    """Drop Rustfava's internal source-location metadata from the API."""
    internal_keys = {"filename", "lineno", "hash", "__tolerances__"}
    return _json_value({key: item for key, item in meta.items() if key not in internal_keys})


class FavaDashboards(RustfavaExtensionBase):
    """Run fava-dashboards pages and queries inside rustfava."""

    report_title = "Dashboards"
    has_js_module = True

    def __init__(self, ledger, config=None):
        self._query_lock = RLock()
        self._query_states = OrderedDict()
        super().__init__(ledger, config)
        options = self.config if isinstance(self.config, dict) else {}
        self._period_cache = None
        if options.get("fast_time_filter", True):
            self._period_cache = PeriodCache(ledger)
            ledger.get_filtered = self._period_cache

    def after_load_file(self):
        """Release period sessions and results whenever the ledger reloads."""
        with self._query_lock:
            self._query_states.clear()
        if self._period_cache is not None:
            self._period_cache.cache_clear()
            self._period_cache.prepare()

    def _query_result(self, entries, bql):
        # Retain entries themselves so object IDs cannot be reused while cached.
        # One lock also prevents parallel panels from preparing the same session.
        with self._query_lock:
            key = id(entries)
            if key not in self._query_states:
                if len(self._query_states) >= 4:
                    self._query_states.popitem(last=False)
                self._query_states[key] = (entries, FavaQueryRunner(self.ledger), OrderedDict(), 0)
            self._query_states.move_to_end(key)
            held_entries, runner, results, cache_bytes = self._query_states[key]
            if bql in results:
                results.move_to_end(bql)
                return results[bql][0]
            result = runner.run(held_entries, bql)
            if isinstance(result, str):
                raise RustfavaAPIError("query did not return a table")
            columns = [column.name for column in result.description]
            payload = {"result": [
                {column: _json_value(value) for column, value in zip(columns, row)}
                for row in result.fetchall()
            ]}
            size = len(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
            if size <= 2 * 1024 * 1024:
                while results and (len(results) >= 64 or cache_bytes + size > 2 * 1024 * 1024):
                    _, (_, old_size) = results.popitem(last=False)
                    cache_bytes -= old_size
                results[bql] = (payload, size)
                cache_bytes += size
                self._query_states[key] = (held_entries, runner, results, cache_bytes)
            return payload

    def _config_path(self) -> Path:
        config = self.config if isinstance(self.config, dict) else {}
        ledger_dir = Path(self.ledger.beancount_file_path).parent
        if "config" in config:
            return (ledger_dir / config["config"]).resolve()
        for extension in [*SCRIPT_EXTENSIONS, ".yaml"]:
            candidate = ledger_dir / f"dashboards{extension}"
            if candidate.exists():
                return candidate
        return ledger_dir / "dashboards.tsx"

    def _get_ledger_data(self) -> dict[str, Any]:
        filtered = g.filtered
        transactions = [entry for entry in filtered.entries if entry.__class__.__name__.endswith("Transaction")]
        if not transactions:
            # Empty periods still need metadata so charts can display zero activity.
            transactions = [
                entry for entry in self.ledger.all_entries if entry.__class__.__name__.endswith("Transaction")
            ]
        if not transactions:
            raise RustfavaAPIError("no transactions found in the ledger")

        ledger_first = transactions[0].date
        ledger_last = max(entry.date for entry in transactions)
        date_range = filtered.date_range
        if date_range:
            filter_first = date_range.begin
            filter_last = date_range.end - datetime.timedelta(days=1)
            date_first = max(filter_first, ledger_first)
            date_last = min(filter_last, ledger_last)
            if date_first > date_last:
                date_first, date_last = filter_first, filter_last
        else:
            filter_first = filter_last = None
            date_first, date_last = ledger_first, ledger_last

        currencies = list(self.ledger.options["operating_currency"])
        if not currencies:
            raise RustfavaAPIError("no operating currency specified in the ledger")

        accounts = {name: {"meta": _clean_meta(account.meta)} for name, account in self.ledger.accounts.items()}
        commodities = {
            entry.currency: {
                "currency": entry.currency,
                "meta": _clean_meta(entry.meta),
            }
            for entry in self.ledger.all_entries_by_type.Commodity
        }
        return {
            "dateFirst": date_first.isoformat(),
            "dateLast": date_last.isoformat(),
            "filterFirst": filter_first.isoformat() if filter_first else None,
            "filterLast": filter_last.isoformat() if filter_last else None,
            "operatingCurrencies": currencies,
            "ccy": currencies[0],
            "accounts": accounts,
            "commodities": commodities,
        }

    @extension_endpoint("query")
    @api_response
    def api_query(self):
        bql = request.args.get("bql")
        if not bql:
            raise RustfavaAPIError("missing bql query")
        return self._query_result(g.filtered.entries_with_all_prices, bql)

    @extension_endpoint("report_postings")
    @api_response
    def api_report_postings(self):
        """Serialize already loaded postings for full-history cash/debt reports.

        Uses Rustfava's filtered entries, just as the query endpoint does.
        Avoids a second WASM-to-Python table conversion for every posting.
        """
        rows = []
        for index, entry in enumerate(g.filtered.entries):
            if not entry.__class__.__name__.endswith("Transaction"):
                continue
            for posting in entry.postings:
                if posting.units is None or posting.units.currency != "KRW":
                    continue
                rows.append({
                    "date": entry.date.isoformat(),
                    "account": posting.account,
                    "units": _json_value(posting.units),
                    "tags": sorted(entry.tags or []),
                    "txid": str(index),
                })
        return {"result": rows}

    @extension_endpoint("v2_config")
    @api_response
    def api_v2_config(self):
        path = self._config_path()
        if path.suffix not in SCRIPT_EXTENSIONS:
            raise RustfavaAPIError(f'invalid dashboard file "{path}"')
        try:
            config_js = path.read_text(encoding="utf-8")
        except OSError as error:
            raise RustfavaAPIError(f"cannot read configuration file {path}: {error}") from error
        return {"configJs": config_js}

    @extension_endpoint("v2_ledger")
    @api_response
    def api_v2_ledger(self):
        return {"ledgerData": self._get_ledger_data()}
