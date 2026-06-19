import type { WebviewMessage } from "../../src/view/messages";
import type { ViewModel, RowModel, ColumnModel, GroupModel } from "../../src/view/viewModel";
import { renderCellParts, Post } from "./cell";

// Renders a ViewModel as an HTML table with optional grouping, column widths,
// per-group and footer summaries, and inline editing of note properties.
export function renderTable(model: ViewModel, post: Post): HTMLElement {
  if (model.rows.length === 0 && (!model.groups || model.groups.length === 0)) {
    return emptyState();
  }

  const table = document.createElement("table");
  table.className = "base-table";

  const colgroup = document.createElement("colgroup");
  for (const col of model.columns) {
    const c = document.createElement("col");
    if (col.width) {
      c.style.width = `${col.width}px`;
    }
    colgroup.appendChild(c);
  }
  table.appendChild(colgroup);

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const col of model.columns) {
    const th = document.createElement("th");
    th.textContent = col.displayName;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const groups: GroupModel[] = model.groups ?? [{ key: "", rows: model.rows }];
  for (const group of groups) {
    if (model.groups) {
      tbody.appendChild(groupHeaderRow(model, group));
    }
    for (const row of group.rows) {
      tbody.appendChild(renderRow(model, row, post));
    }
    if (model.groups && group.summaries) {
      tbody.appendChild(summaryRow(model, group.summaries, "group-summary"));
    }
  }
  table.appendChild(tbody);

  if (model.summaries) {
    const tfoot = document.createElement("tfoot");
    tfoot.appendChild(summaryRow(model, model.summaries, "footer-summary"));
    table.appendChild(tfoot);
  }

  return table;
}

function groupHeaderRow(model: ViewModel, group: GroupModel): HTMLElement {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = model.columns.length;
  td.className = "group-header";
  const count = group.rows.length;
  td.textContent = `${group.key || "—"} · ${count}`;
  tr.appendChild(td);
  return tr;
}

function summaryRow(
  model: ViewModel,
  summaries: Record<string, string>,
  className: string,
): HTMLElement {
  const tr = document.createElement("tr");
  tr.className = className;
  for (const col of model.columns) {
    const td = document.createElement("td");
    td.textContent = summaries[col.id] ?? "";
    tr.appendChild(td);
  }
  return tr;
}

function renderRow(model: ViewModel, row: RowModel, post: Post): HTMLElement {
  const tr = document.createElement("tr");
  for (const col of model.columns) {
    const cell = row.cells.find((c) => c.columnId === col.id);
    const td = document.createElement("td");
    if (cell) {
      renderCellParts(td, cell, post);
      if (col.editable && cell.editValue !== undefined) {
        makeEditable(td, row, col, cell.editValue, post);
      }
    }
    tr.appendChild(td);
  }
  return tr;
}

function makeEditable(
  td: HTMLElement,
  row: RowModel,
  col: ColumnModel,
  current: string,
  post: Post,
): void {
  td.classList.add("editable");
  td.addEventListener("dblclick", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "cell-edit";
    input.value = current;
    td.textContent = "";
    td.appendChild(input);
    input.focus();
    input.select();

    const commit = () => {
      const value = input.value;
      if (value !== current) {
        post({ type: "editCell", notePath: row.notePath, columnId: col.id, value });
      } else {
        td.textContent = current;
      }
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        input.value = current;
        input.blur();
      }
    });
  });
}

function emptyState(): HTMLElement {
  const div = document.createElement("div");
  div.className = "placeholder";
  div.textContent = "No results.";
  return div;
}
