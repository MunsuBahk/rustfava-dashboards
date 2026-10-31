type ChartRecord = Record<string, unknown>;
const object = (value: unknown): ChartRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as ChartRecord) : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : value ? [value] : []);

/** Give dense charts a bounded reading width without widening indicators or pies. */
export function inferMobileChartWidth(value: unknown): number | undefined {
  const spec = object(value);
  const series = list(spec.series).map(object);
  if (series.some((item) => item.type === "sankey")) {
    return 960;
  }
  if (list(spec.calendar).length) {
    return 920;
  }
  const axis = list(spec.xAxis).map(object)[0];
  if (!axis || !series.length) {
    return;
  }

  const sources = list(spec.dataset).flatMap((dataset) => {
    const source = object(dataset).source;
    return Array.isArray(source) ? source : [];
  });
  const points = series.flatMap((item) => (Array.isArray(item.data) ? item.data : []));
  const firstDimension = (row: unknown): unknown => {
    if (Array.isArray(row)) {
      return row[0];
    }
    const item = object(row);
    return item.date ?? item._date ?? Object.values(item)[0];
  };

  let count = 0;
  let cellWidth = 72;
  if (axis.type === "time") {
    // Daily points share month space; long forecasts must not create huge canvases.
    const months = [...sources, ...points].map(firstDimension).flatMap((date) => {
      const match = typeof date === "string" ? /^(\d{4})[-/](\d{1,2})/.exec(date) : null;
      return match ? [`${match[1]}-${match[2].padStart(2, "0")}`] : [];
    });
    count = new Set(months).size;
    cellWidth = 64;
  } else if (axis.type === "category" || Array.isArray(axis.data) || axis.type === undefined) {
    if (Array.isArray(axis.data)) {
      count = axis.data.length;
    } else if (series.some((item) => item.type === "heatmap")) {
      count = new Set(points.map(firstDimension)).size;
      cellWidth = 104;
    } else {
      const sourceCategories = new Set(sources.map(firstDimension).filter((key) => key !== undefined));
      count = Math.max(
        sourceCategories.size,
        ...series.map((item) => (Array.isArray(item.data) ? item.data.length : 0)),
      );
    }
  }
  return count > 4 ? Math.min(3200, Math.max(640, count * cellWidth + 128)) : undefined;
}
