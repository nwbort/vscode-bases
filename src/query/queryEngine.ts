import { BaseConfig, ViewConfig } from "../model/baseSchema";
import { parsePropertyId, defaultDisplayName } from "../model/propertyId";
import { NoteRecord } from "../vault/noteRecord";
import { EvalContext, makeContext } from "../expr/context";
import { Value, valueToString } from "../expr/values";
import { resolveProperty } from "./resolveProperty";
import { passesCombined } from "./filter";
import { sortRows } from "./sort";
import { groupRows } from "./groupBy";
import { computeSummary } from "./summaries";
import {
  formatCellParts, formatPlain, FormatOptions, DEFAULT_FORMAT_OPTIONS,
} from "../view/formatCell";
import {
  ViewModel, ColumnModel, RowModel, GroupModel, CellModel,
} from "../view/viewModel";

interface DataSource {
  all(): NoteRecord[];
}

/** Display options threaded into the formatting layer (e.g. `bases.dateFormat`). */
export interface BuildOptions extends Partial<FormatOptions> {
  /** The value of `this` in filter/formula expressions — typically the file containing the base. */
  thisValue?: Value;
}

interface QueryRow {
  ctx: EvalContext;
  note: NoteRecord;
}

// Turns a base config + view + dataset into a renderable ViewModel by running
// the full pipeline: filter (global AND view) → sort → limit → group →
// summaries, formatting each cell for the webview.
export function buildViewModel(
  config: BaseConfig,
  viewIndex: number,
  index: DataSource,
  options: BuildOptions = {},
): ViewModel {
  const fmt: FormatOptions = { ...DEFAULT_FORMAT_OPTIONS, ...options };
  const views = config.views;
  const view: ViewConfig | undefined = views[viewIndex];
  const viewNames = views.map((v, i) => v.name ?? `View ${i + 1}`);

  if (!view) {
    return emptyModel(viewNames, viewIndex, "No view defined in this base.");
  }

  const columns = resolveColumns(view, config);
  const notes = index.all();
  const formulas = config.formulas ?? {};
  const { thisValue } = options;

  // 1. Build a context per note and filter.
  let rows: QueryRow[] = [];
  for (const note of notes) {
    const ctx = makeContext(note, { notes, formulas, thisValue });
    if (passesCombined(config.filters, view.filters, ctx)) {
      rows.push({ ctx, note });
    }
  }

  // 2. Sort.
  rows = sortRows(rows, view.sort);

  // 3. Limit (caps total result rows).
  if (typeof view.limit === "number" && view.limit >= 0) {
    rows = rows.slice(0, view.limit);
  }

  const resultCount = rows.length;

  // 4. Group (optional) and 5. summaries.
  const customSummaries = config.summaries ?? {};
  const summaryMap = (view.summaries ?? {}) as Record<string, string>;
  const sampleCtx = rows[0]?.ctx;

  let groups: GroupModel[] | undefined;
  let flatRows: RowModel[] = [];

  if (view.groupBy) {
    const grouped = groupRows(rows, view.groupBy);
    groups = grouped.map((g) => ({
      key: g.key,
      rows: g.rows.map((r) => buildRow(r, columns, fmt)),
      summaries: computeSummaries(summaryMap, columns, g.rows, customSummaries, g.rows[0]?.ctx, fmt),
    }));
  } else {
    flatRows = rows.map((r) => buildRow(r, columns, fmt));
  }

  const footerSummaries =
    Object.keys(summaryMap).length > 0
      ? computeSummaries(summaryMap, columns, rows, customSummaries, sampleCtx, fmt)
      : undefined;

  return {
    viewNames,
    activeViewIndex: viewIndex,
    type: view.type,
    name: view.name ?? `View ${viewIndex + 1}`,
    columns,
    rows: flatRows,
    groups,
    summaries: footerSummaries,
    resultCount,
    settings: extractSettings(view),
  };
}

function resolveColumns(view: ViewConfig, config: BaseConfig): ColumnModel[] {
  const order = view.order ?? [];
  const columnSize = (view.columnSize ?? {}) as Record<string, number>;
  return order.map((raw) => {
    const id = parsePropertyId(raw);
    const props = config.properties ?? {};
    const qualified = `${id.scope}.${id.key}`;
    const configured =
      props[raw]?.displayName ?? props[qualified]?.displayName ?? props[id.key]?.displayName;
    return {
      id: raw,
      displayName: configured ?? defaultDisplayName(id),
      width: columnSize[raw] ?? columnSize[qualified],
      editable: id.scope === "note",
    };
  });
}

function buildRow(row: QueryRow, columns: ColumnModel[], fmt: FormatOptions): RowModel {
  const cells: CellModel[] = columns.map((col) => {
    const id = parsePropertyId(col.id);
    // The note-title column renders as a clickable link showing the basename,
    // matching Obsidian (the underlying file.name value keeps its extension).
    if (id.scope === "file" && id.key === "name") {
      return {
        columnId: col.id,
        parts: [{ kind: "link", text: row.note.file.basename, target: row.note.file.path }],
      };
    }
    const value = resolveProperty(col.id, row.ctx);
    return {
      columnId: col.id,
      parts: formatCellParts(value, fmt),
      editValue: col.editable ? valueToString(value) : undefined,
    };
  });
  return { notePath: row.note.file.path, cells };
}

function computeSummaries(
  summaryMap: Record<string, string>,
  columns: ColumnModel[],
  rows: QueryRow[],
  customSummaries: Record<string, string>,
  ctx: EvalContext | undefined,
  fmt: FormatOptions,
): Record<string, string> | undefined {
  const entries = Object.entries(summaryMap);
  if (entries.length === 0 || !ctx) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [columnId, summaryName] of entries) {
    const values: Value[] = rows.map((r) => resolveProperty(columnId, r.ctx));
    const result = computeSummary(summaryName, values, customSummaries, ctx);
    out[columnId] = formatPlain(result, fmt);
  }
  return out;
}

function extractSettings(view: ViewConfig): Record<string, unknown> {
  const known = new Set([
    "type", "name", "limit", "filters", "order", "sort", "groupBy", "summaries",
  ]);
  const settings: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(view)) {
    if (!known.has(k)) {
      settings[k] = v;
    }
  }
  return settings;
}

function emptyModel(viewNames: string[], viewIndex: number, error: string): ViewModel {
  return {
    viewNames,
    activeViewIndex: viewIndex,
    type: "table",
    name: "",
    columns: [],
    rows: [],
    resultCount: 0,
    settings: {},
    error,
  };
}
