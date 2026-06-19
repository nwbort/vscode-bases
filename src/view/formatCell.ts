import { Value, valueToString } from "../expr/values";
import { CellPart } from "./viewModel";

// Converts a resolved Value into the renderable parts the webview understands.
// Lists expand into one part per element (so links/images stay interactive).

export function formatCellParts(value: Value): CellPart[] {
  switch (value.type) {
    case "null":
      return [{ kind: "empty" }];
    case "boolean":
      return [{ kind: "checkbox", checked: value.value }];
    case "link":
      return [{ kind: "link", text: value.display ?? value.target, target: value.target }];
    case "file":
      return [{ kind: "link", text: value.path.replace(/\.md$/i, ""), target: value.path }];
    case "image":
      return [{ kind: "image", src: value.src }];
    case "icon":
      return [{ kind: "icon", icon: value.name }];
    case "html":
      return [{ kind: "html", html: value.value }];
    case "list": {
      if (value.value.length === 0) return [{ kind: "empty" }];
      return value.value.flatMap(formatCellParts);
    }
    default:
      return [{ kind: "text", text: valueToString(value) }];
  }
}

/** A flat plain-text rendering, used for summaries and titles. */
export function formatPlain(value: Value): string {
  return valueToString(value);
}
