"""Reuse one held ledger for date clamping without changing Rustfava files."""

import logging
from functools import lru_cache
from pathlib import Path
from threading import RLock

from rustfava.core import FilteredLedger
from rustfava.core.filters import TimeFilter
from rustfava.rustledger.backend import get_engine
from rustfava.rustledger.loader import _sort_entries
from rustfava.rustledger.types import directives_from_json
from rustfava.rustledger.types import directives_to_json

LOGGER = logging.getLogger(__name__)


class PeriodCache:
    """Ledger-local adapter with an exact startup check and conservative fallback.

    A file session preserves source locations. Before using it, compare every
    loaded directive (including generated entries and metadata) with Rustfava's
    already loaded ledger. Differing loaders/plugins/padding keep the original
    path. Account and search filters also retain their original ordering.
    """

    def __init__(self, ledger):
        self.ledger = ledger
        self.original = ledger.get_filtered
        self.lock = RLock()
        self.entries = None
        self.session = None
        self.failed = False
        self.cached = lru_cache(maxsize=16)(self._create)

    def prepare(self):
        with self.lock:
            if self.entries is not self.ledger.all_entries:
                self.entries = self.ledger.all_entries
                self.session = None
                self.failed = False
                self.cached.cache_clear()
            if self.session is None and not self.failed:
                try:
                    candidate = get_engine().open_session_file(self.ledger.beancount_file_path)
                    held = _sort_entries(list(directives_from_json(candidate.info()["entries"])))
                    if directives_to_json(held) != directives_to_json(list(self.entries)):
                        raise ValueError("Held file session differs from the loaded Rustfava ledger")
                    self.session = candidate
                except Exception:  # Engine/version incompatibility must preserve the original behavior.
                    LOGGER.warning("Held period session unavailable; using Rustfava filtering", exc_info=True)
                    self.failed = True

    def cache_clear(self):
        with self.lock:
            self.cached.cache_clear()
            self.original.cache_clear()
            self.entries = None
            self.session = None
            self.failed = False

    def cache_info(self):
        return self.cached.cache_info()

    def __call__(self, account=None, filter=None, time=None):
        with self.lock:
            if self.entries is not self.ledger.all_entries:
                self.cache_clear()
                self.entries = self.ledger.all_entries
            return self.cached(account, filter, time)

    def _create(self, account, filter, time):
        if not time or account or (filter and filter.strip()):
            return self.original(account=account, filter=filter, time=time)
        time_filter = TimeFilter(self.ledger.options, self.ledger.fava_options, time)
        self.prepare()
        if self.session is None:
            return self.original(account=account, filter=filter, time=time)
        try:
            raw = self.session.clamp(str(time_filter.date_range.begin), str(time_filter.date_range.end))
            get_engine()._rewrite_guest_paths({"entries": raw}, Path(self.ledger.beancount_file_path).resolve().parent)
            entries = list(directives_from_json(raw))
        except Exception:
            LOGGER.warning("Held date clamp unavailable; using Rustfava filtering", exc_info=True)
            return self.original(account=account, filter=filter, time=time)
        result = FilteredLedger(self.ledger)
        result.entries = entries
        result.date_range = time_filter.date_range
        result._date_first = time_filter.date_range.begin
        result._date_last = time_filter.date_range.end
        return result
