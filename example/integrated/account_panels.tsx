// 장부의 비용 계정 두 단계까지 묶는다. 예: Expenses:Rent.
// 계정명을 번역하거나 특정 업종의 분류로 치환하지 않는다.
async function monthlyAccountChart({ ledger, variables }, includeIncome = false) {
  const currency = variables.currency;
  const rows = await ledger.query(
    `SELECT year, month, root(account, 2) AS account,
     CONVERT(SUM(position), '${currency}', LAST(date)) AS value
     WHERE account ~ '^${includeIncome ? "(Income|Expenses)" : "Expenses"}:'
     GROUP BY year, month, account`
  );
  const monthly = new Map();
  const accounts = new Set<string>();
  for (const row of rows) {
    const month = `${row.year}-${String(row.month).padStart(2, "0")}`;
    const account = includeIncome && row.account.startsWith("Income:") ? "Income" : row.account;
    accounts.add(account);
    const values = monthly.get(month) ?? {};
    const sign = account === "Income" ? -1 : 1;
    values[account] = (values[account] ?? 0) + sign * (row.value[currency] ?? 0);
    monthly.set(month, values);
  }
  const months = [...new Set([
    ...iterateMonths(ledger.dateFirst, ledger.dateLast).map(m => `${m.year}-${String(m.month).padStart(2, "0")}`),
    ...monthly.keys(),
  ])].sort();
  const sorted = [...accounts].sort((a, b) => a === "Income" ? -1 : b === "Income" ? 1 : a.localeCompare(b));
  const formatter = getCurrencyFormatter(currency);
  return {
    ...(includeIncome ? { mobileMinWidth: Math.max(480, months.length * 80 + 160) } : {}),
    tooltip: { trigger: "axis", valueFormatter: anyFormatter(formatter) },
    legend: { bottom: 0, type: "scroll" },
    grid: { ...(includeIncome ? { left: 16, right: 16 } : {}), bottom: 80, containLabel: true },
    xAxis: { type: "category", data: months },
    yAxis: { type: "value", axisLabel: { formatter } },
    series: sorted.map(account => ({
      name: account,
      type: includeIncome ? "bar" : "line",
      ...(includeIncome ? { stack: account === "Income" ? "income" : "expenses" } : {}),
      emphasis: { focus: "series" },
      data: months.map(month => monthly.get(month)?.[account] ?? 0),
    })),
    onClick: event => {
      const account = event.seriesName;
      const month = months[event.dataIndex];
      if (!sorted.includes(account) || !month) return;
      window.open(ledger.urlFor(`../../account/${encodeURIComponent(account)}/?time=${month}`));
    },
  };
}
const overview = originalConfig.dashboards.find(d => d.name === "Overview");
const incomeExpenses = overview.panels.find(p => p.title === "Income vs. Expenses 💸");
incomeExpenses.title = "월별 수익·비용";
incomeExpenses.spec = params => monthlyAccountChart(params, true);
const categories = originalConfig.dashboards.find(d => d.name === "Income and Expenses");
const monthlyExpenses = categories.panels.find(p => p.title === "Food Expenses 🥐");
monthlyExpenses.title = "월별 비용 계정";
monthlyExpenses.link = "../../account/Expenses/";
monthlyExpenses.spec = params => monthlyAccountChart(params);
