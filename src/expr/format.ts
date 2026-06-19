import { Value, valueToString } from "./values";

// Render a Value to a plain display string. Structured, view-aware rendering
// (links, images, icons, checkboxes) lives in src/view/formatCell.ts; this
// thin wrapper exists for callers that only need a flat string.
export function formatValue(v: Value): string {
  return valueToString(v);
}
