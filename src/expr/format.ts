import { Value } from "./values";

// Render a Value to a plain display string for the webview. A richer variant
// should return structured cell data (links as clickable, images, icons,
// checkboxes) — see IMPLEMENTATION_PLAN.md §6.
//
// TODO(M4): expand to structured cell rendering.
export function formatValue(v: Value): string {
  switch (v.type) {
    case "null":
      return "";
    case "string":
      return v.value;
    case "number":
      return String(v.value);
    case "boolean":
      return v.value ? "true" : "false";
    case "list":
      return v.value.map(formatValue).join(", ");
    case "link":
      return v.display ?? v.target;
    case "file":
      return v.path;
    case "date":
      return new Date(v.epochMs).toISOString();
    case "duration":
      return `${v.ms}ms`;
    case "object":
      return JSON.stringify(
        Object.fromEntries(Object.entries(v.value).map(([k, val]) => [k, formatValue(val)])),
      );
  }
}
