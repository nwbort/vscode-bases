import type { ViewModel, RowModel } from "../../src/view/viewModel";
import { renderCellParts, Post } from "./cell";

// Renders rows as a simple vertical list: the first column is the primary line,
// the remaining columns become a muted secondary line.
export function renderList(model: ViewModel, post: Post): HTMLElement {
  const rows = allRows(model);
  if (rows.length === 0) {
    return placeholder("No results.");
  }

  const container = document.createElement("div");
  container.className = "list-view";

  if (model.groups) {
    for (const group of model.groups) {
      const header = document.createElement("div");
      header.className = "list-group-header";
      header.textContent = `${group.key || "—"} · ${group.rows.length}`;
      container.appendChild(header);
      for (const row of group.rows) {
        container.appendChild(renderItem(model, row, post));
      }
    }
  } else {
    for (const row of rows) {
      container.appendChild(renderItem(model, row, post));
    }
  }
  return container;
}

function renderItem(model: ViewModel, row: RowModel, post: Post): HTMLElement {
  const item = document.createElement("div");
  item.className = "list-item";

  const titleCol = model.columns[0];
  const titleCell = row.cells.find((c) => c.columnId === titleCol?.id);
  const primary = document.createElement("div");
  primary.className = "list-primary";
  if (titleCell) {
    renderCellParts(primary, titleCell, post);
  }
  item.appendChild(primary);

  const secondaryCols = model.columns.slice(1);
  if (secondaryCols.length) {
    const secondary = document.createElement("div");
    secondary.className = "list-secondary";
    secondaryCols.forEach((col, i) => {
      const cell = row.cells.find((c) => c.columnId === col.id);
      if (!cell) return;
      if (i > 0) secondary.appendChild(document.createTextNode(" · "));
      const span = document.createElement("span");
      renderCellParts(span, cell, post);
      secondary.appendChild(span);
    });
    item.appendChild(secondary);
  }
  return item;
}

function allRows(model: ViewModel): RowModel[] {
  if (model.groups) {
    return model.groups.flatMap((g) => g.rows);
  }
  return model.rows;
}

function placeholder(text: string): HTMLElement {
  const div = document.createElement("div");
  div.className = "placeholder";
  div.textContent = text;
  return div;
}
