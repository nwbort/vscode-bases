import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import advancedFormat from "dayjs/plugin/advancedFormat";
import { Value, DateValue, valueToString } from "../expr/values";
import { CellPart } from "./viewModel";

dayjs.extend(utc);
dayjs.extend(advancedFormat);

// Converts a resolved Value into the renderable parts the webview understands.
// Lists expand into one part per element (so links/images stay interactive).

/** Display-time formatting options (sourced from the `bases.*` settings). */
export interface FormatOptions {
  /** Moment-style pattern for bare date values (the `bases.dateFormat` setting). */
  dateFormat: string;
}

export const DEFAULT_FORMAT_OPTIONS: FormatOptions = { dateFormat: "YYYY-MM-DD" };

export function formatCellParts(
  value: Value,
  options: FormatOptions = DEFAULT_FORMAT_OPTIONS,
): CellPart[] {
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
    case "date":
      return [{ kind: "text", text: formatDate(value, options) }];
    case "list": {
      if (value.value.length === 0) return [{ kind: "empty" }];
      return value.value.flatMap((v) => formatCellParts(v, options));
    }
    default:
      return [{ kind: "text", text: valueToString(value) }];
  }
}

/** A flat plain-text rendering, used for summaries and titles. */
export function formatPlain(
  value: Value,
  options: FormatOptions = DEFAULT_FORMAT_OPTIONS,
): string {
  if (value.type === "date") {
    return formatDate(value, options);
  }
  if (value.type === "list") {
    return value.value.map((v) => formatPlain(v, options)).join(", ");
  }
  return valueToString(value);
}

/** Render a date with the configured pattern, appending a time when present. */
function formatDate(d: DateValue, options: FormatOptions): string {
  const pattern = d.hasTime ? `${options.dateFormat} HH:mm:ss` : options.dateFormat;
  return dayjs.utc(d.epochMs).format(pattern);
}
