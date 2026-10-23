"""Integration checks for the Rustfava compatibility layer."""

from pathlib import Path
from urllib.parse import urlencode

import pytest
from rustfava.application import create_app


@pytest.fixture
def client(tmp_path: Path):
    ledger_path = tmp_path / "mvp.beancount"
    ledger_path.write_text(
        """option "title" "Dashboard MVP fixture"
option "operating_currency" "KRW"
2024-01-01 open Assets:Bank KRW
2024-01-01 open Income:Sales KRW
2024-01-01 custom "fava-extension" "fava_dashboards"

2024-01-15 * "January sale"
  Income:Sales  -100000 KRW
  Assets:Bank

2024-02-15 * "February sale"
  Income:Sales  -150000 KRW
  Assets:Bank
""",
        encoding="utf-8",
    )
    (tmp_path / "dashboards.tsx").write_text(
        'export default { dashboards: [{ name: "MVP", panels: [] }] };\n',
        encoding="utf-8",
    )
    app = create_app([str(ledger_path)], incognito=True, read_only=True, poll_watcher=True)
    app.testing = True
    return app.test_client()


def test_extension_page_and_javascript_module_load(client) -> None:
    page = client.get("/dashboard-mvp-fixture/extension/FavaDashboards/")
    module = client.get("/dashboard-mvp-fixture/extension_js_module/FavaDashboards.js")

    assert page.status_code == 200
    assert b"Dashboards" in page.data
    assert module.status_code == 200
    assert b"onExtensionPageLoad" in module.data


def test_config_and_rustledger_query_follow_time_filter(client) -> None:
    base = "/dashboard-mvp-fixture/extension/FavaDashboards"
    config = client.get(f"{base}/v2_config")
    query = "SELECT month, sum(position) AS total WHERE account ~ '^Income:' GROUP BY month"
    position_query = "SELECT position WHERE account ~ '^Assets:Bank'"

    all_months = client.get(f"{base}/query?{urlencode({'bql': query})}")
    january_params = urlencode({"bql": query, "time": "2024-01"})
    january = client.get(f"{base}/query?{january_params}")
    positions = client.get(f"{base}/query?{urlencode({'bql': position_query})}")
    ledger_data = client.get(f"{base}/v2_ledger?time=2024-01")

    assert config.status_code == 200
    assert config.json["data"]["configJs"].startswith("export default")
    assert all_months.status_code == 200
    assert [row["month"] for row in all_months.json["data"]["result"]] == [1, 2]
    assert january.status_code == 200
    assert [row["month"] for row in january.json["data"]["result"]] == [1]
    assert positions.status_code == 200
    assert positions.json["data"]["result"][0]["position"]["units"]["currency"] == "KRW"
    assert ledger_data.status_code == 200
    assert ledger_data.json["data"]["ledgerData"]["dateLast"] == "2024-01-15"
