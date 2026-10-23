// 패널명을 번역하고 월별 손익 표의 표시 너비를 조정한다. 계정명과 쿼리, 변수 값은 유지한다.
const koreanPanelTitles = {
  "Assets": "자산",
  "Liabilities": "부채",
  "Monthly Profit and Loss": "월별 손익",
  "Net Worth": "순자산",
  "Portfolio": "포트폴리오",
  "Portfolio Gains": "포트폴리오 평가손익",
  "Asset Classes Year-over-Year": "연도별 자산 종류 비교",
  "Asset Classes": "자산 종류",
  "Assets Allocation": "자산 배분",
  "Avg. Income per Month": "월평균 수익",
  "Avg. Expenses per Month": "월평균 비용",
  "Avg. Savings per Month": "월평균 손익",
  "Savings Heatmap": "월별 손익 히트맵",
  "Expenses Calendar Heatmap": "일별 비용 히트맵",
  "Income Categories (per month)": "월평균 수익 분류",
  "Expenses Categories (per month)": "월평균 비용 분류",
  "Recurring, Regular and Irregular Expenses": "반복·일반·비정기 비용",
  "Income Year-Over-Year": "연도별 수익 비교",
  "Expenses Year-Over-Year": "연도별 비용 비교",
  "Top 10 Largest Expenses": "금액이 큰 비용 10건",
  "Sankey (per month)": "월평균 흐름도",
};
const koreanMonthlyRows = {
  income: "수익",
  expenses: "비용",
  net_profit: "순이익",
  assets: "자산",
  liabilities: "부채",
  unrealized_gains: "미실현 평가손익",
  net_worth: "순자산",
};
for (const dashboard of originalConfig.dashboards) {
  for (const panel of dashboard.panels) {
    if (panel.title === "Monthly Profit and Loss 📅") {
      const originalSpec = panel.spec;
      panel.spec = async (params) => {
        const spec = await originalSpec(params);
        return {
        ...spec,
        rows: spec.rows.map(row => ({ ...row, name: koreanMonthlyRows[row.id] ?? row.name })),
        autosizeOnMount: true,
        autosizeOptions: {
          includeHeaders: true,
          includeOutliers: true,
          expand: false,
          disableColumnVirtualization: true,
        },
        };
      };
    }
    // 원본의 이모지는 패널명 뒤에 붙어 있으므로 그대로 유지한다.
    const matched = Object.keys(koreanPanelTitles).sort((a, b) => b.length - a.length).find(title => panel.title === title || panel.title.startsWith(title + " "));
    if (matched) panel.title = koreanPanelTitles[matched] + panel.title.slice(matched.length);
  }
}
