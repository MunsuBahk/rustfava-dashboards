import { DataGrid, DataGridProps, GridValidRowModel, useGridApiRef } from "@mui/x-data-grid";
import { useEffect } from "react";
import { PanelProps } from "./registry";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TableSpec<R extends GridValidRowModel = any> = DataGridProps<R>;

export function TablePanel({ spec }: PanelProps<TableSpec>) {
  const internalApiRef = useGridApiRef();
  const apiRef = spec.apiRef ?? internalApiRef;
  const { autosizeOnMount, ...gridSpec } = spec;

  // Opted-in tables also resize when a period/filter changes their data.
  useEffect(() => {
    if (!autosizeOnMount) return;
    const frame = requestAnimationFrame(() => {
      void apiRef.current?.autosizeColumns(spec.autosizeOptions);
    });
    return () => cancelAnimationFrame(frame);
  }, [apiRef, autosizeOnMount, spec.autosizeOptions, spec.columns, spec.rows]);

  return (
    <DataGrid
      {...gridSpec}
      apiRef={apiRef}
      sx={{
        ...spec.sx,
        "& p": {
          // Override Fava's global <p> style to fix footer alignment
          margin: 0,
        },
      }}
    />
  );
}
