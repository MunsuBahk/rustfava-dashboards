"""Common date and configuration helpers for the Rustfava adapter."""

from collections.abc import Sequence
from datetime import date
from pathlib import Path

from rustfava.beans.abc import Directive
from rustfava.beans.abc import Price
from rustfava.beans.abc import Transaction
from rustfava.helpers import RustfavaAPIError


def read_dashboards_tsx(path: Path) -> str:
    """Read the dashboard's TypeScript configuration."""
    try:
        return path.read_text(encoding="utf-8")
    except OSError as error:
        raise RustfavaAPIError(f"cannot read configuration file {path}: {error}") from error


def get_ledger_duration(entries: Sequence[Directive]) -> tuple[date, date]:
    """Return the date span covered by transactions and prices."""
    date_first = next((entry.date for entry in entries if isinstance(entry, Transaction)), None)
    date_last = next(
        (entry.date for entry in reversed(entries) if isinstance(entry, (Transaction, Price))),
        None,
    )
    if date_first is None or date_last is None:
        raise RustfavaAPIError("no transactions found")
    return date_first, date_last


def clamp_to_ledger_range(
    filter_first: date,
    filter_last: date,
    ledger_first: date,
    ledger_last: date,
) -> tuple[date, date]:
    """Clamp an overlapping date filter to the ledger's actual data range."""
    clamped_first = max(filter_first, ledger_first)
    clamped_last = min(filter_last, ledger_last)
    if clamped_first > clamped_last:
        return filter_first, filter_last
    return clamped_first, clamped_last
