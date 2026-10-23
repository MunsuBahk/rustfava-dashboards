"""Assemble five upstream dashboards and three additional dashboards."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
original = (ROOT / 'example/dashboards.tsx').read_text()
assert original.count('export default defineConfig(') == 1
original = original.replace('export default defineConfig(', 'const originalConfig = defineConfig(', 1)
original = original.replace('throw Error("No Income/Expense accounts found.");', 'return { title: { text: "이 기간에는 수익·비용 거래가 없습니다.", left: "center", top: "middle" }, series: [] };')

original = original.replace('source: Object.values(dataset).reverse(),', 'source: categoryRows(Object.values(dataset).reverse()),')
original = original.replace('source: Object.values(dataset),', 'source: categoryRows(Object.values(dataset)),')
original = original.replace('Object.keys(dataset).map((year) => [0, parseInt(year)])', 'Object.keys(dataset).map((year) => [0, year])')
original = original.replace('Object.keys(dataset).map((year) => [parseInt(year), 0])', 'Object.keys(dataset).map((year) => [year, 0])')

extra = (ROOT / 'example/hospital/dashboards.tsx').read_text()
extra = extra.replace('import { defineConfig } from "fava-dashboards";', '', 1)
extra = extra.replace('export const POSTINGS_QUERY', 'const POSTINGS_QUERY')
extra = extra.replace('export function buildReport', 'function buildReport')
extra = extra.replace('export default defineConfig(', 'return defineConfig(', 1)
for a, b in [('병원 손익', '손익'), ('병원 현금흐름', '현금흐름'), ('병원 대출', '대출')]:
    extra = extra.replace('name: "' + a + '"', 'name: "' + b + '"')
translation = r'''
originalConfig.dashboards = originalConfig.dashboards.filter(dashboard => dashboard.name !== "Travelling");
const names = { Overview: "종합", Assets: "자산", "Income and Expenses": "수익·비용", Sankey: "흐름도", Projection: "순자산 전망" };
function categoryRows(rows) {
  return rows.map(row => typeof row._date === "number" ? { ...row, _date: String(row._date) } : row);
}
function favaValue(value) {
  if (Array.isArray(value)) return value.map(favaValue);
  if (!value || typeof value !== "object") return value;
  const converted = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, favaValue(item)]));
  if (typeof value.number === "number" && typeof value.currency === "string") converted[value.currency] = value.number;
  return converted;
}
const compatibleLedgers = new WeakMap();
function compatibleLedger(ledger) {
  if (!compatibleLedgers.has(ledger)) {
    compatibleLedgers.set(ledger, { ...ledger, query: async (bql) => {
      const query = bql.replaceAll(/INTERVAL\('(\d+) (day|month|year)s?'\)/g, "INTERVAL($1, '$2')");
      return favaValue(await ledger.query(query));
    } });
  }
  return compatibleLedgers.get(ledger);
}
for (const dashboard of originalConfig.dashboards) {
  for (const panel of dashboard.panels) {
    const spec = panel.spec;
    panel.spec = (params) => spec({ ...params, ledger: compatibleLedger(params.ledger) });
  }
  dashboard.name = names[dashboard.name] ?? dashboard.name;
  for (const variable of dashboard.variables ?? []) {
    if (variable.name === "currency") variable.label = "통화";
  }
}
export default defineConfig({ dashboards: [...originalConfig.dashboards, ...extraConfig.dashboards] });
'''
localization = (ROOT / 'example/integrated/korean_panels.tsx').read_text()
translation = translation.replace('const names =', localization + '\nconst names =', 1)
account_panels = (ROOT / 'example/integrated/account_panels.tsx').read_text()
output = original + '\n' + account_panels + '\nconst extraConfig = (() => {\n' + extra + '\n})();\n' + translation
(ROOT / 'example/integrated/dashboards.tsx').write_text(output)
ledger = (ROOT / 'example/hospital/hospital.beancount').read_text().replace('"Hospital dashboard demo"', '"Dashboard preview"')
ledger += """
2024-12-31 commodity DEMO
  name: "합성 투자상품"
  asset_class: "Fund"
  asset_allocation_Equity_Demo: 100
2024-12-31 open Assets:Investments:Demo DEMO
2024-12-31 * "합성 투자 기초잔액" #opening
  id: "demo-investment-opening"
  Assets:Investments:Demo  10 DEMO {1000 KRW}
  Equity:Opening          -10000 KRW
2024-12-31 price DEMO 1000 KRW
2025-01-31 price DEMO 1200 KRW
2025-02-28 price DEMO 1250 KRW
2024-01-01 price CPI 100 KRW
2025-01-01 price CPI 103 KRW
2026-01-01 price CPI 105 KRW
"""
(ROOT / 'example/integrated/demo.beancount').write_text(ledger)
print('Generated eight dashboards and synthetic preview ledger')
