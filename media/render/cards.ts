import type { ViewModel, RowModel } from "../../src/view/viewModel";
import { renderCellParts, Post } from "./cell";

// Renders rows as a responsive grid of cards. The first column acts as the
// card title; an `image` setting names the property used for the cover image.
export function renderCards(model: ViewModel, post: Post): HTMLElement {
  const rows = allRows(model);
  if (rows.length === 0) {
    return placeholder("No results.");
  }

  const cardSize = typeof model.settings.cardSize === "number" ? model.settings.cardSize : 190;
  const imageProp = typeof model.settings.image === "string" ? model.settings.image : "";

  const grid = document.createElement("div");
  grid.className = "card-grid";
  grid.style.setProperty("--card-size", `${cardSize}px`);

  for (const row of rows) {
    grid.appendChild(renderCard(model, row, imageProp, post));
  }
  return grid;
}

function renderCard(model: ViewModel, row: RowModel, imageProp: string, post: Post): HTMLElement {
  const card = document.createElement("div");
  card.className = "card";

  const titleCol = model.columns[0];
  const imageCol = imageProp
    ? model.columns.find((c) => c.id === imageProp)
    : model.columns.find((c) => {
        const cell = row.cells.find((x) => x.columnId === c.id);
        return cell?.parts.some((p) => p.kind === "image");
      });

  // Cover image (if any).
  if (imageCol) {
    const cell = row.cells.find((c) => c.columnId === imageCol.id);
    const imgPart = cell?.parts.find((p) => p.kind === "image");
    if (imgPart?.src) {
      const cover = document.createElement("div");
      cover.className = "card-cover";
      const img = document.createElement("img");
      img.src = imgPart.src;
      img.loading = "lazy";
      cover.appendChild(img);
      card.appendChild(cover);
    }
  }

  const body = document.createElement("div");
  body.className = "card-body";

  // Title from the first column.
  const titleCell = row.cells.find((c) => c.columnId === titleCol?.id);
  if (titleCell) {
    const title = document.createElement("div");
    title.className = "card-title";
    renderCellParts(title, titleCell, post);
    body.appendChild(title);
  }

  // Remaining fields as label/value rows.
  for (const col of model.columns) {
    if (col.id === titleCol?.id || col.id === imageCol?.id) continue;
    const cell = row.cells.find((c) => c.columnId === col.id);
    if (!cell) continue;
    const isEmpty = cell.parts.every((p) => p.kind === "empty" || (p.kind === "text" && !p.text));
    if (isEmpty) continue;
    const field = document.createElement("div");
    field.className = "card-field";
    const label = document.createElement("span");
    label.className = "card-label";
    label.textContent = col.displayName;
    const value = document.createElement("span");
    value.className = "card-value";
    renderCellParts(value, cell, post);
    field.appendChild(label);
    field.appendChild(value);
    body.appendChild(field);
  }

  card.appendChild(body);
  return card;
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
