import { BaseConfig, ViewConfig } from "../model/baseSchema";
import { parsePropertyId, defaultDisplayName } from "../model/propertyId";
import { VaultIndex } from "../vault/vaultIndex";
import { ViewModel, ColumnModel } from "../view/viewModel";

// Turns a base config + view + vault index into a renderable ViewModel.
//
// Scaffold status: builds the columns/toolbar shell and an empty result set so
// the webview renders. The actual data pipeline is M3+ work:
//
//   TODO(M3): filter (global AND view) via expr/evaluator
//   TODO(M3): evaluate formula.* columns per row (memoised, cycle-detected)
//   TODO(M3): sort (multi-key, type-aware) and groupBy
//   TODO(M3): limit
//   TODO(M5): built-in + custom summaries (footer + per-group)
//   TODO(M4): format each cell value (expr/format) incl. links/images
export function buildViewModel(
  config: BaseConfig,
  viewIndex: number,
  index: VaultIndex,
): ViewModel {
  const views = config.views;
  const view: ViewConfig | undefined = views[viewIndex];
  const viewNames = views.map((v, i) => v.name ?? `View ${i + 1}`);

  if (!view) {
    return emptyModel(viewNames, viewIndex, "No view defined in this base.");
  }

  const columns = resolveColumns(view, config);

  // TODO(M3): replace with the real query pipeline over index.all().
  void index;

  return {
    viewNames,
    activeViewIndex: viewIndex,
    type: view.type,
    name: view.name ?? `View ${viewIndex + 1}`,
    columns,
    rows: [],
    resultCount: 0,
    settings: extractSettings(view),
  };
}

function resolveColumns(view: ViewConfig, config: BaseConfig): ColumnModel[] {
  const order = view.order ?? [];
  return order.map((raw) => {
    const id = parsePropertyId(raw);
    const configured = config.properties?.[raw]?.displayName;
    return {
      id: raw,
      displayName: configured ?? defaultDisplayName(id),
    };
  });
}

function extractSettings(view: ViewConfig): Record<string, unknown> {
  const known = new Set([
    "type",
    "name",
    "limit",
    "filters",
    "order",
    "sort",
    "groupBy",
    "summaries",
  ]);
  const settings: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(view)) {
    if (!known.has(k)) {
      settings[k] = v;
    }
  }
  return settings;
}

function emptyModel(
  viewNames: string[],
  viewIndex: number,
  error: string,
): ViewModel {
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
