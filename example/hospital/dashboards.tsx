import { defineConfig } from "fava-dashboards";

// Synthetic KRW example. The calculations are exported for direct Node tests.
export const POSTINGS_QUERY = "SELECT date, account, units, tags, id AS txid WHERE currency = 'KRW' ORDER BY date";
const CASH = "Assets:Cash:";
const DEBT = "Liabilities:Loans:";
const INTEREST = "Expenses:Interest:";
const money = (value) => `${new Intl.NumberFormat("ko-KR").format(value)}원`;
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const total = (rows, predicate) => rows.reduce((sum, row) => sum + (predicate(row) ? row.units.number : 0), 0);
const inRange = (row, first, last) => row.date >= first && row.date <= last;

function cashMovements(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (row.txid == null) throw new Error("거래 식별자가 없습니다.");
    if (row.units.currency !== "KRW" || !Number.isSafeInteger(row.units.number)) {
      throw new Error("이 예제는 안전한 정수 범위의 KRW 금액만 지원합니다.");
    }
    const group = groups.get(row.txid) ?? [];
    group.push(row);
    groups.set(row.txid, group);
  }
  return [...groups.values()].flatMap((group) => {
    if (group.some((row) => row.date !== group[0].date)) throw new Error("거래 id가 중복되었습니다.");
    const cash = total(group, (row) => row.account.startsWith(CASH));
    // Cash-account transfers net to zero before gross inflow/outflow is counted.
    if (!cash) return [];
    const tags = new Set(group[0].tags);
    const classes = ["operating", "investing", "financing", "opening"].filter((tag) => tags.has(tag));
    if (classes.length !== 1) throw new Error("현금 거래에는 활동 분류 태그가 하나 필요합니다.");
    const category = classes[0] === "opening" ? "adjustments" : classes[0];
    const flow = { date: group[0].date, cash, operating: 0, investing: 0, financing: 0, adjustments: 0 };
    flow[category] = cash;
    // This example classifies cash interest as operating, including mixed payments.
    if (tags.has("loan-repayment")) {
      const interest = total(group, (row) => row.account.startsWith(INTEREST));
      if (interest < 0 || interest > -cash) throw new Error("원리금 납부 거래를 확인해야 합니다.");
      flow.operating -= interest;
      flow.financing += interest;
    }
    return [flow];
  });
}

function period(rows, flows, first, last) {
  const selected = rows.filter((row) => inRange(row, first, last));
  const selectedFlows = flows.filter((flow) => inRange(flow, first, last));
  const before = rows.filter((row) => row.date < first);
  const through = rows.filter((row) => row.date <= last);
  const revenue = -total(selected, (row) => row.account.startsWith("Income:")) || 0;
  const expenses = total(selected, (row) => row.account.startsWith("Expenses:"));
  const loanAccounts = [...new Set(through.filter((row) => row.account.startsWith(DEBT)).map((row) => row.account))].sort();
  const loans = loanAccounts.map((account) => {
    const loanRows = selected.filter((row) => row.account === account);
    const draws = -total(loanRows, (row) => row.tags.includes("loan-draw")) || 0;
    const repayments = total(loanRows, (row) => row.tags.includes("loan-repayment"));
    const opening = -total(before, (row) => row.account === account) || 0;
    const closing = -total(through, (row) => row.account === account) || 0;
    const interest = total(selected, (row) => row.account === INTEREST + account.slice(DEBT.length));
    return { account, opening, draws, repayments, closing, interest, adjustments: closing - opening - draws + repayments };
  });
  const sumLoans = (key) => loans.reduce((sum, loan) => sum + loan[key], 0);
  const sumFlows = (key) => selectedFlows.reduce((sum, flow) => sum + flow[key], 0);
  const openingCash = total(before, (row) => row.account.startsWith(CASH));
  const closingCash = total(through, (row) => row.account.startsWith(CASH));
  const inflow = selectedFlows.reduce((sum, flow) => sum + Math.max(flow.cash, 0), 0);
  const outflow = selectedFlows.reduce((sum, flow) => sum + Math.max(-flow.cash, 0), 0);
  const result = {
    first, last, revenue, expenses, profit: revenue - expenses,
    openingCash, closingCash, inflow, outflow, netCash: inflow - outflow,
    operating: sumFlows("operating"), investing: sumFlows("investing"), financing: sumFlows("financing"), adjustments: sumFlows("adjustments"),
    loans, openingDebt: sumLoans("opening"), draws: sumLoans("draws"), repayments: sumLoans("repayments"), closingDebt: sumLoans("closing"), interest: sumLoans("interest"), debtAdjustments: sumLoans("adjustments"),
  };
  if (result.openingCash + result.netCash !== result.closingCash || result.operating + result.investing + result.financing + result.adjustments !== result.netCash) {
    throw new Error("현금흐름과 잔액이 일치하지 않습니다.");
  }
  return result;
}

export function buildReport(rows, first, last) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(first) || !/^\d{4}-\d{2}-\d{2}$/.test(last) || first > last) throw new Error("조회 기간을 확인해야 합니다.");
  const flows = cashMovements(rows);
  const summary = period(rows, flows, first, last);
  const months = [];
  const current = new Date(first.slice(0, 7) + "-01T00:00:00Z");
  while (current.toISOString().slice(0, 10) <= last) {
    const start = current.toISOString().slice(0, 10);
    current.setUTCMonth(current.getUTCMonth() + 1);
    const end = new Date(current.getTime() - 86400000).toISOString().slice(0, 10);
    months.push({ month: start.slice(0, 7), ...period(rows, flows, start < first ? first : start, end > last ? last : end) });
  }
  return { ...summary, months };
}

async function report(ledger) {
  // Remove only time: balances need earlier history. Account/search filters remain.
  const url = new URL(ledger.urlFor("query"), window.location.href);
  url.searchParams.delete("time");
  url.searchParams.set("bql", POSTINGS_QUERY);
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.error ?? "BQL 조회 실패");
  return buildReport(payload.data.result, ledger.filterFirst ?? ledger.dateFirst, ledger.filterLast ?? ledger.dateLast);
}

function cards(items) {
  return `<div style="display:flex;flex-wrap:wrap;gap:24px">${items.map(([label, value]) => `<div style="min-width:170px"><div>${escape(label)}</div><strong style="font-size:24px">${money(value)}</strong></div>`).join("")}</div>`;
}

function table(headers, rows) {
  return `<table style="width:100%;border-collapse:collapse;margin-top:24px"><thead><tr>${headers.map((h) => `<th style="text-align:right;padding:8px;border-bottom:1px solid #bbb">${escape(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value) => `<td style="text-align:right;padding:8px;border-bottom:1px solid #ddd">${typeof value === "number" ? money(value) : escape(value)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function note(r, extra = "") {
  return `<p><strong>합성 장부 · KRW 예제</strong> | ${r.first} ～ ${r.last}</p><p>잔액은 기간 이전 거래를 포함한다. ${extra}</p>`;
}

function chart(r, series) {
  return {
    tooltip: { trigger: "axis", valueFormatter: money },
    legend: { top: 0 }, grid: { left: 100, right: 40, top: 50, bottom: 40 },
    xAxis: { type: "category", data: r.months.map((month) => month.month) },
    yAxis: { type: "value", axisLabel: { formatter: (value) => `${value / 1000000}백만` } },
    series,
  };
}

export default defineConfig({
  dashboards: [
    {
      name: "손익",
      panels: [
        { title: "기간 손익", kind: "html", height: "auto", spec: async ({ ledger }) => {
          const r = await report(ledger);
          return note(r, "매출은 환불을 차감하고, 비용에는 이자를 포함한다.") + cards([["순매출", r.revenue], ["비용", r.expenses], ["이익", r.profit]]) + table(["월", "순매출", "비용", "이익"], r.months.map((m) => [m.month, m.revenue, m.expenses, m.profit]));
        } },
        { title: "월별 손익", kind: "echarts", height: "360px", spec: async ({ ledger }) => {
          const r = await report(ledger);
          return chart(r, [["순매출", "revenue"], ["비용", "expenses"], ["이익", "profit"]].map(([name, key]) => ({ name, type: "bar", data: r.months.map((m) => m[key]) })));
        } },
      ],
    },
    {
      name: "현금흐름",
      panels: [
        { title: "현금 유입·유출과 잔액", kind: "html", height: "auto", spec: async ({ ledger }) => {
          const r = await report(ledger);
          return note(r, "현금 계정 간 이체는 제외하고, 원리금 동시 납부의 이자는 영업활동으로 구분한다.") + cards([["기초 현금", r.openingCash], ["유입", r.inflow], ["유출", r.outflow], ["기말 현금", r.closingCash]]) + table(["월", "영업", "투자", "재무", "기초설정·조정", "순증감", "기말 현금"], r.months.map((m) => [m.month, m.operating, m.investing, m.financing, m.adjustments, m.netCash, m.closingCash]));
        } },
        { title: "월별 활동별 현금흐름과 기말 잔액", kind: "echarts", height: "360px", spec: async ({ ledger }) => {
          const r = await report(ledger);
          return chart(r, [...[["영업", "operating"], ["투자", "investing"], ["재무", "financing"], ["조정", "adjustments"]].map(([name, key]) => ({ name, type: "bar", data: r.months.map((m) => m[key]) })), { name: "기말 현금", type: "line", data: r.months.map((m) => m.closingCash) }]);
        } },
      ],
    },
    {
      name: "대출",
      panels: [
        { title: "대출 원금과 이자", kind: "html", height: "auto", spec: async ({ ledger }) => {
          const r = await report(ledger);
          return note(r, "대출 실행·원금 상환은 매출·비용에 포함하지 않는다.") + cards([["기초 원금", r.openingDebt], ["대출 실행", r.draws], ["원금 상환", r.repayments], ["기말 원금", r.closingDebt], ["이자", r.interest]]) + table(["대출", "기초 원금", "실행", "상환", "기초설정·조정", "기말 원금", "이자"], r.loans.map((loan) => [loan.account.slice(DEBT.length), loan.opening, loan.draws, loan.repayments, loan.adjustments, loan.closing, loan.interest]));
        } },
        { title: "월별 대출 실행·상환과 잔액", kind: "echarts", height: "360px", spec: async ({ ledger }) => {
          const r = await report(ledger);
          return chart(r, [{ name: "실행", type: "bar", data: r.months.map((m) => m.draws) }, { name: "원금 상환", type: "bar", data: r.months.map((m) => -m.repayments) }, ...r.loans.map((loan) => ({ name: `대출 ${loan.account.slice(DEBT.length)} 잔액`, type: "line", data: r.months.map((m) => m.loans.find((item) => item.account === loan.account)?.closing ?? 0) }))]);
        } },
      ],
    },
  ],
});
