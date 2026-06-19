import type { WebviewMessage } from "../../src/view/messages";
import type { ViewModel, RowModel } from "../../src/view/viewModel";

type Post = (msg: WebviewMessage) => void;

// Renders a ViewModel as an HTML table. Read-only for now.
// TODO(M5): summary footer row. TODO(M7): inline editing + sort-on-header-click.
export function renderTable(model: ViewModel, post: Post): HTMLElement {
  const table = document.createElement("table");
  table.className = "base-table";

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
  const groups = model.groups ?? [{ key: "", rows: model.rows }];
  for (const group of groups) {
    if (group.key) {
      const groupRow = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = model.columns.length;
      td.className = "group-header";
      td.textContent = group.key;
      groupRow.appendChild(td);
      tbody.appendChild(groupRow);
    }
    for (const row of group.rows) {
      tbody.appendChild(renderRow(model, row, post));
    }
  }
  table.appendChild(tbody);

  if (model.rows.length === 0 && !model.groups) {
    const empty = document.createElement("div");
    empty.className = "placeholder";
    empty.textContent = "No results.";
    const wrap = document.createElement("div");
    wrap.appendChild(table);
    wrap.appendChild(empty);
    return wrap;
  }

  return table;
}

function renderRow(model: ViewModel, row: RowModel, post: Post): HTMLElement {
  const tr = document.createElement("tr");
  for (const col of model.columns) {
    const cell = row.cells.find((c) => c.columnId === col.id);
    const td = document.createElement("td");
    td.textContent = cell?.text ?? "";
    if (col.id === "file.name") {
      td.className = "link-cell";
      td.addEventListener("click", () =>
        post({ type: "openNote", notePath: row.notePath }),
      );
    }
    tr.appendChild(td);
  }
  return tr;
}
