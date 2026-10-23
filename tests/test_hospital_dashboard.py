"""Exercise the hospital example against the real rustledger BQL engine."""

import json
from pathlib import Path
from urllib.parse import urlencode

import pytest
from rustfava.application import create_app

ROOT = Path(__file__).resolve().parents[1]
BASE = "/hospital-dashboard-demo/extension/FavaDashboards"
QUERY = "SELECT date, account, units, tags, id AS txid ORDER BY date"


@pytest.fixture
def client():
    app = create_app(
        [str(ROOT / "example/hospital/hospital.beancount")],
        incognito=True,
        read_only=True,
        poll_watcher=True,
    )
    app.testing = True
    return app.test_client()


@pytest.mark.parametrize(
    ("time", "revenue"),
    [("2025-01", 11_000_000), ("2025-02", 13_000_000), ("2025", 24_000_000)],
)
def test_income_query_uses_signed_refunds_and_period(client, time, revenue):
    params = urlencode(
        {
            "bql": "SELECT sum(position) AS total WHERE account ~ '^Income:'",
            "time": time,
        }
    )
    response = client.get(f"{BASE}/query?{params}")
    assert response.status_code == 200
    assert response.json["data"]["result"] == [{"total": {"KRW": -revenue}}]


def test_empty_period_keeps_requested_dates(client):
    response = client.get(f"{BASE}/v2_ledger?time=2025-03")
    assert response.status_code == 200
    data = response.json["data"]["ledgerData"]
    assert data["filterFirst"] == "2025-03-01"
    assert data["filterLast"] == "2025-03-31"


def test_history_query_exposes_stable_transaction_ids(client):
    response = client.get(f"{BASE}/query?{urlencode({'bql': QUERY})}")
    assert response.status_code == 200
    rows = response.json["data"]["result"]
    assert rows and all(row["txid"] is not None for row in rows)
    assert {row["date"][:4] for row in rows} == {"2024", "2025", "2026"}
    assert sum(row["units"]["number"] for row in rows if row["date"] == "2025-01-25" and row["account"].startswith("Assets:Cash:")) == 0


if __name__ == "__main__":
    app = create_app(
        [str(ROOT / "example/hospital/hospital.beancount")],
        incognito=True,
        read_only=True,
        poll_watcher=True,
    )
    response = app.test_client().get(f"{BASE}/query?{urlencode({'bql': QUERY})}")
    assert response.status_code == 200, response.get_data(as_text=True)
    print(json.dumps(response.json["data"]["result"], ensure_ascii=False))
