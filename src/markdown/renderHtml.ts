import { ViewModel, GroupModel, CellModel, CellPart } from "../view/viewModel";

// Static, string-based renderer for a ViewModel. The interactive webview render
// lives in media/render/*; this mirror exists so embedded bases can be shown in
// the (non-scripted) Markdown preview. Table-shaped output for every view type.

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Render a complete ViewModel (header + table) as an HTML fragment string. */
export function renderViewModelHtml(model: ViewModel): string {
  if (model.error) {
    return `<div class="base-embed base-embed-error">${escapeHtml(model.error)}</div>`;
  }

  const header = renderHeader(model);
  const hasRows = model.rows.length > 0 || (model.groups?.some((g) => g.rows.length > 0) ?? false);
  const body = hasRows ? renderTable(model) : `<div class="base-embed-empty">No results.</div>`;
  return `<div class="base-embed">${header}${body}</div>`;
}

function renderHeader(model: ViewModel): string {
  const name = escapeHtml(model.name || "Base");
  const count = `${model.resultCount} ${model.resultCount === 1 ? "result" : "results"}`;
  const others =
    model.viewNames.length > 1
      ? ` <span class="base-embed-views">${model.viewNames
          .map((n, i) => escapeHtml(i === model.activeViewIndex ? `[${n}]` : n))
          .join(" · ")}</span>`
      : "";
  return `<div class="base-embed-header"><span class="base-embed-title">${name}</span> <span class="base-embed-count">${count}</span>${others}</div>`;
}

function renderTable(model: ViewModel): string {
  const cols = model.columns;
  const head = cols.map((c) => `<th>${escapeHtml(c.displayName)}</th>`).join("");

  const groups: GroupModel[] = model.groups ?? [{ key: "", rows: model.rows }];
  const bodyRows: string[] = [];
  for (const group of groups) {
    if (model.groups) {
      bodyRows.push(
        `<tr class="group-header"><td colspan="${cols.length}">${escapeHtml(
          group.key || "—",
        )} · ${group.rows.length}</td></tr>`,
      );
    }
    for (const row of group.rows) {
      const cells = cols
        .map((col) => `<td>${renderCell(row.cells.find((c) => c.columnId === col.id))}</td>`)
        .join("");
      bodyRows.push(`<tr>${cells}</tr>`);
    }
    if (model.groups && group.summaries) {
      bodyRows.push(summaryRow(model, group.summaries, "group-summary"));
    }
  }

  const foot = model.summaries ? `<tfoot>${summaryRow(model, model.summaries, "footer-summary")}</tfoot>` : "";

  return `<table class="base-table"><thead><tr>${head}</tr></thead><tbody>${bodyRows.join(
    "",
  )}</tbody>${foot}</table>`;
}

function summaryRow(model: ViewModel, summaries: Record<string, string>, cls: string): string {
  const cells = model.columns
    .map((col) => `<td>${escapeHtml(summaries[col.id] ?? "")}</td>`)
    .join("");
  return `<tr class="${cls}">${cells}</tr>`;
}

function renderCell(cell: CellModel | undefined): string {
  if (!cell) return "";
  return cell.parts
    .map((part, i) => (i > 0 && part.kind !== "empty" ? ", " : "") + renderPart(part))
    .join("");
}

function renderPart(part: CellPart): string {
  switch (part.kind) {
    case "empty":
      return "";
    case "link":
      return `<span class="cell-link">${escapeHtml(part.text ?? part.target ?? "")}</span>`;
    case "image":
      return `<img class="cell-image" loading="lazy" src="${escapeHtml(part.src ?? "")}" />`;
    case "icon":
      return `<span class="cell-icon">:${escapeHtml(part.icon ?? "")}:</span>`;
    case "checkbox":
      return part.checked ? "☑" : "☐";
    case "html":
      // Already produced by the html() function; trusted to be inline markup.
      return part.html ?? "";
    case "text":
    default:
      return escapeHtml(part.text ?? "");
  }
}
