"""Exact-equivalence checks for date clamping and the original fallback path."""

from pathlib import Path

import pytest
from rustfava.core import RustfavaLedger
from rustfava.rustledger.types import directives_to_json

from fava_dashboards.period_cache import PeriodCache


@pytest.fixture
def ledger(tmp_path: Path):
    source = """option "operating_currency" "USD"
2023-12-01 open Assets:Bank USD
2023-12-01 open Assets:Shares DEMO
2023-12-01 open Equity:Opening USD
2023-12-01 open Income:Sales USD
2023-12-01 commodity DEMO
  name: "Demo investment"
2023-12-02 * "Opening"
  Assets:Bank 1000 USD
  Equity:Opening -1000 USD
2023-12-15 * "Buy"
  Assets:Shares 2 DEMO {10 USD}
  Assets:Bank -20 USD
2024-01-01 * "Sale" #sale
  note: "Boundary and metadata"
  Assets:Bank 100 USD
  Income:Sales -100 USD
2024-01-31 price DEMO 12 USD
2024-02-01 * "Next month" #sale
  Assets:Bank 200 USD
  Income:Sales -200 USD
"""
    path = tmp_path / "fixture.beancount"
    path.write_text(source)
    return RustfavaLedger(str(path), poll_watcher=True)


@pytest.mark.parametrize("period", ["2023-12", "2024-01", "2024-02", "2024", "2023-11", "2024-03"])
def test_held_period_matches_all_directives(ledger, period):
    cache = PeriodCache(ledger)
    expected = ledger.get_filtered(time=period)
    actual = cache(time=period)
    assert directives_to_json(list(actual.entries)) == directives_to_json(list(expected.entries))
    assert actual.date_range == expected.date_range
    assert actual._date_first == expected._date_first
    assert actual._date_last == expected._date_last
    assert directives_to_json(list(actual.entries_with_all_prices)) == directives_to_json(
        list(expected.entries_with_all_prices)
    )
    assert cache(time=period) is actual
    assert cache.session is not None


@pytest.mark.parametrize("args", [{"account": "Assets"}, {"filter": "#sale"}, {"account": "Income", "filter": "#sale"}])
def test_account_and_search_keep_original_filter_order(ledger, args):
    cache = PeriodCache(ledger)
    assert directives_to_json(list(cache(time="2024-01", **args).entries)) == directives_to_json(
        list(ledger.get_filtered(time="2024-01", **args).entries)
    )
    assert cache.session is None


def test_reload_replaces_held_ledger_and_cached_period(ledger):
    cache = PeriodCache(ledger)
    ledger.get_filtered = cache
    before = cache(time="2024-01")
    with open(ledger.beancount_file_path, "a") as stream:
        stream.write('\n2024-01-20 * "Reloaded"\n  Assets:Bank 50 USD\n  Income:Sales -50 USD\n')
    ledger.load_file()
    after = cache(time="2024-01")
    expected = ledger._get_filtered(time="2024-01")
    assert len(after.entries) == len(before.entries) + 1
    assert directives_to_json(list(after.entries)) == directives_to_json(list(expected.entries))


def test_unavailable_session_falls_back(ledger, monkeypatch):
    class Unsupported:
        def open_session_file(self, path):
            raise NotImplementedError

    monkeypatch.setattr("fava_dashboards.period_cache.get_engine", lambda: Unsupported())
    cache = PeriodCache(ledger)
    assert directives_to_json(list(cache(time="2024-01").entries)) == directives_to_json(
        list(ledger.get_filtered(time="2024-01").entries)
    )


def test_different_padding_loader_uses_original_entries(ledger):
    path = Path(ledger.beancount_file_path)
    path.write_text(
        path.read_text().replace(
            '2023-12-02 * "Opening"\n  Assets:Bank 1000 USD\n  Equity:Opening -1000 USD',
            "2023-12-02 pad Assets:Bank Equity:Opening\n2023-12-03 balance Assets:Bank 1000 USD",
        )
    )
    ledger.load_file()
    cache = PeriodCache(ledger)
    actual = cache(time="2023-12")
    expected = ledger.get_filtered(time="2023-12")
    assert directives_to_json(list(actual.entries)) == directives_to_json(list(expected.entries))
    assert cache.failed
