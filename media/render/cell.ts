import type { WebviewMessage } from "../../src/view/messages";
import type { CellModel, CellPart } from "../../src/view/viewModel";

export type Post = (msg: WebviewMessage) => void;

const EXTERNAL_RE = /^[a-z]+:\/\//i;

/** Render a cell's parts into a container element. */
export function renderCellParts(container: HTMLElement, cell: CellModel, post: Post): void {
  cell.parts.forEach((part, i) => {
    if (i > 0 && part.kind !== "empty") {
      container.appendChild(document.createTextNode(", "));
    }
    container.appendChild(renderPart(part, post));
  });
}

function renderPart(part: CellPart, post: Post): Node {
  switch (part.kind) {
    case "empty":
      return document.createTextNode("");

    case "link": {
      const a = document.createElement("a");
      a.className = "cell-link";
      a.textContent = part.text ?? part.target ?? "";
      a.href = "#";
      const target = part.target ?? "";
      a.addEventListener("click", (e) => {
        e.preventDefault();
        if (EXTERNAL_RE.test(target)) {
          post({ type: "openExternal", url: target });
        } else {
          post({ type: "openNote", notePath: target });
        }
      });
      return a;
    }

    case "image": {
      const img = document.createElement("img");
      img.className = "cell-image";
      img.src = part.src ?? "";
      img.loading = "lazy";
      return img;
    }

    case "icon": {
      const span = document.createElement("span");
      span.className = "cell-icon";
      span.dataset.icon = part.icon ?? "";
      span.textContent = `:${part.icon}:`;
      return span;
    }

    case "checkbox": {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!part.checked;
      input.disabled = true;
      return input;
    }

    case "html": {
      const span = document.createElement("span");
      span.innerHTML = part.html ?? "";
      return span;
    }

    case "text":
    default: {
      return document.createTextNode(part.text ?? "");
    }
  }
}
