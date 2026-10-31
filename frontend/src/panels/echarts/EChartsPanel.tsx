import { Box, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { dispose, ECElementEvent, ECharts, EChartsOption, init } from "echarts";
import { useEffect, useRef } from "react";
import { useConfigContext } from "../../components/ConfigProvider";
import { useResizeObserver } from "../../components/hooks";
import { PanelProps } from "../registry";
import { inferMobileChartWidth } from "./mobileChartWidth";
import * as themes from "./themes";

export type EChartsThemeName = keyof typeof themes;
export const EChartsThemeNames = Object.keys(themes) as ReadonlyArray<EChartsThemeName>;

export interface EChartsSpec extends EChartsOption {
  /** Optional horizontal chart width on phone-sized screens. */
  mobileMinWidth?: number;
  onClick?: (params: ECElementEvent) => void;
  onDblClick?: (params: ECElementEvent) => void;
}

export function EChartsPanel({ spec }: PanelProps<EChartsSpec>) {
  const theme = useTheme();
  const isPhone = useMediaQuery("(max-width: 767px)");
  const mobileMinWidth = spec.mobileMinWidth ?? inferMobileChartWidth(spec);
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts>(null);
  const rect = useResizeObserver(ref);
  const { config } = useConfigContext();
  const echartsTheme = loadTheme(config.theme?.echarts) ?? (theme.palette.mode === "dark" ? "dark" : undefined);

  function cleanup() {
    if (chartRef.current) {
      dispose(chartRef.current);
      chartRef.current = null;
    }
  }

  useEffect(() => {
    cleanup();
    if (!rect) {
      return;
    }

    const chart = init(ref.current, echartsTheme, {
      width: rect.width,
      height: rect.height,
    });
    const { onClick, onDblClick, mobileMinWidth: _mobileMinWidth, ...option } = spec;

    if (onClick) {
      chart.on("click", onClick);
    }

    if (onDblClick) {
      chart.on("dblclick", onDblClick);
    }

    if (echartsTheme == "dark" && option.backgroundColor === undefined) {
      option.backgroundColor = "transparent";
    }

    if (isPhone && mobileMinWidth && option.xAxis) {
      const grids = Array.isArray(option.grid) ? option.grid : [option.grid ?? {}];
      option.grid = grids.map((grid) => ({
        ...grid,
        left: typeof grid.left === "number" ? grid.left : 16,
        right: typeof grid.right === "number" ? grid.right : 16,
        containLabel: grid.containLabel ?? true,
      }));
    }
    chart.setOption(option);
    chartRef.current = chart;

    return cleanup;
  }, [spec, echartsTheme, rect, isPhone, mobileMinWidth]);

  useEffect(() => {
    if (chartRef.current && rect) {
      chartRef.current.resize({ width: rect.width, height: rect.height });
    }
  }, [rect]);

  return (
    <Box
      sx={{
        height: "100%",
        overflowX: mobileMinWidth ? "auto" : "visible",
        overflowY: mobileMinWidth ? "hidden" : "visible",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <Box ref={ref} sx={{ height: "100%", "@media (max-width: 767px)": { minWidth: mobileMinWidth ?? 0 } }} />
    </Box>
  );
}

function loadTheme(theme: EChartsThemeName | object | undefined) {
  if (typeof theme === "string") {
    const resolved = themes[theme];
    if (!resolved) {
      throw Error(`Cannot find theme "${theme}". Available themes: ${Object.keys(themes).join(", ")}`);
    }
    return resolved;
  }
  return theme;
}
