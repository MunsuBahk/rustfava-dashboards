import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Execute the actual JavaScript-compatible TSX config, without mocking its maths.
const configSource = await readFile(new URL("../example/hospital/dashboards.tsx", import.meta.url), "utf8");
const moduleSource = configSource.replace('import { defineConfig } from "fava-dashboards";', "const defineConfig = (config) => config;");
const { buildReport } = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`);
assert.ok(process.env.HOSPITAL_POSTINGS_JSON, "Export actual BQL rows before running this test.");
const rows = JSON.parse(await readFile(process.env.HOSPITAL_POSTINGS_JSON, "utf8"));

test("January: credit sales, refund, mixed principal/interest and equipment", () => {
  const r = buildReport(rows, "2025-01-01", "2025-01-31");
  for (const [key, expected] of Object.entries({
    revenue: 11_000_000, expenses: 6_200_000, profit: 4_800_000,
    openingCash: 10_000_000, inflow: 15_000_000, outflow: 12_200_000,
    operating: 2_800_000, investing: -4_000_000, financing: 4_000_000,
    closingCash: 12_800_000, openingDebt: 20_000_000, draws: 5_000_000,
    repayments: 1_000_000, closingDebt: 24_000_000, interest: 200_000,
  })) assert.equal(r[key], expected, key);
  assert.deepEqual(r.loans.map((loan) => loan.closing), [19_000_000, 5_000_000]);
});

test("February: receivable collection is cash only and prior balances carry", () => {
  const r = buildReport(rows, "2025-02-01", "2025-02-28");
  for (const [key, expected] of Object.entries({
    revenue: 13_000_000, expenses: 7_240_000, profit: 5_760_000,
    openingCash: 12_800_000, inflow: 17_000_000, outflow: 8_740_000,
    operating: 7_760_000, investing: 0, financing: 500_000,
    closingCash: 21_060_000, openingDebt: 24_000_000, draws: 0,
    repayments: 1_500_000, closingDebt: 22_500_000, interest: 240_000,
  })) assert.equal(r[key], expected, key);
  assert.deepEqual(r.loans.map((loan) => loan.closing), [18_000_000, 4_500_000]);
});

test("Annual totals exclude future transactions and reconcile cash and debt", () => {
  const r = buildReport(rows, "2025-01-01", "2025-12-31");
  assert.equal(r.revenue, 24_000_000);
  assert.equal(r.expenses, 13_440_000);
  assert.equal(r.profit, 10_560_000);
  assert.equal(r.openingCash + r.inflow - r.outflow, 21_060_000);
  assert.equal(r.openingDebt + r.draws - r.repayments, 22_500_000);
  assert.equal(r.closingDebt, 22_500_000);
  assert.equal(r.months.length, 12);
});

test("Empty month has zero activity and carries the closing balances", () => {
  const r = buildReport(rows, "2025-03-01", "2025-03-31");
  assert.equal(r.profit, 0);
  assert.equal(r.inflow, 0);
  assert.equal(r.outflow, 0);
  assert.equal(r.openingCash, 21_060_000);
  assert.equal(r.closingCash, 21_060_000);
  assert.equal(r.closingDebt, 22_500_000);
});

test("Year boundaries use year-month keys and opening entries stay adjustments", () => {
  const r = buildReport(rows, "2024-12-01", "2025-02-28");
  assert.deepEqual(r.months.map((month) => month.month), ["2024-12", "2025-01", "2025-02"]);
  assert.equal(r.months[0].adjustments, 10_000_000);
  assert.equal(r.months[0].draws, 0);
  assert.equal(r.months[0].debtAdjustments, 20_000_000);
  const nextYear = buildReport(rows, "2026-01-01", "2026-01-31");
  assert.equal(nextYear.revenue, 1_000_000);
  assert.equal(nextYear.draws, 3_000_000);
  assert.equal(nextYear.closingCash, 25_060_000);
});

test("Unsafe currency or missing transaction IDs are reported explicitly", () => {
  assert.throws(() => buildReport([{ ...rows[0], txid: null }], "2025-01-01", "2025-01-31"), /식별자/);
  assert.throws(() => buildReport([{ ...rows[0], units: { number: 1, currency: "USD" } }], "2025-01-01", "2025-01-31"), /KRW/);
});
