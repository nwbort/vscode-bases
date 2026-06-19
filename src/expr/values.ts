// The Bases value model. Filters/formulas evaluate to one of these. Behaviour
// follows JavaScript semantics (see docs/obsidian/Functions.md).

export type ValueType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "duration"
  | "list"
  | "object"
  | "link"
  | "file"
  | "html"
  | "image"
  | "icon"
  | "regexp"
  | "null";

export interface DateValue {
  type: "date";
  epochMs: number;
  /** Whether the value carries a meaningful time component. */
  hasTime: boolean;
}

export interface DurationValue {
  type: "duration";
  /** Sub-month component in milliseconds (weeks/days/hours/minutes/seconds/ms). */
  ms: number;
  /** Calendar months (years are folded in as months * 12). */
  months: number;
}

export interface LinkValue {
  type: "link";
  target: string;
  display?: string;
}

export interface FileValue {
  type: "file";
  path: string;
}

export interface RegexpValue {
  type: "regexp";
  pattern: string;
  flags: string;
}

export type Value =
  | { type: "string"; value: string }
  | { type: "number"; value: number }
  | { type: "boolean"; value: boolean }
  | DateValue
  | DurationValue
  | { type: "list"; value: Value[] }
  | { type: "object"; value: Record<string, Value> }
  | LinkValue
  | FileValue
  | RegexpValue
  | { type: "html"; value: string }
  | { type: "image"; src: string }
  | { type: "icon"; name: string }
  | { type: "null" };

export const NULL: Value = { type: "null" };

export const str = (value: string): Value => ({ type: "string", value });
export const num = (value: number): Value => ({ type: "number", value });
export const bool = (value: boolean): Value => ({ type: "boolean", value });
export const list = (value: Value[]): Value => ({ type: "list", value });
export const obj = (value: Record<string, Value>): Value => ({ type: "object", value });
export const link = (target: string, display?: string): LinkValue => ({ type: "link", target, display });
export const file = (path: string): FileValue => ({ type: "file", path });
export const dateVal = (epochMs: number, hasTime: boolean): DateValue => ({ type: "date", epochMs, hasTime });
export const duration = (ms: number, months = 0): DurationValue => ({ type: "duration", ms, months });

/** Coerce any value to its truthiness (used by `if`, filters, `!`, `&&`, `||`). */
export function isTruthy(v: Value): boolean {
  switch (v.type) {
    case "null":
      return false;
    case "boolean":
      return v.value;
    case "number":
      return v.value !== 0 && !Number.isNaN(v.value);
    case "string":
      return v.value.length > 0;
    case "list":
      return v.value.length > 0;
    case "object":
      return Object.keys(v.value).length > 0;
    default:
      return true;
  }
}

/** Whether a value counts as "empty" for summaries/isEmpty(). */
export function isEmpty(v: Value): boolean {
  switch (v.type) {
    case "null":
      return true;
    case "string":
      return v.value.length === 0;
    case "list":
      return v.value.length === 0;
    case "object":
      return Object.keys(v.value).length === 0;
    default:
      return false;
  }
}

/** Title-cased name of the runtime type, as accepted by isType(). */
export function typeName(v: Value): string {
  return v.type;
}

/** Equality per docs: primitives by value, dates by epoch, links by target. */
export function valueEquals(a: Value, b: Value): boolean {
  if (a.type === "null" || b.type === "null") {
    return a.type === "null" && b.type === "null";
  }
  // Link/file cross comparisons: equal if they resolve to the same target.
  if (a.type === "link" || a.type === "file" || b.type === "link" || b.type === "file") {
    const at = linkTarget(a);
    const bt = linkTarget(b);
    if (at !== null && bt !== null) {
      return normaliseTarget(at) === normaliseTarget(bt);
    }
  }
  if (a.type !== b.type) {
    // number/boolean cross compare like JS loose? Bases follows JS; keep strict
    // on type except number<->string is not auto-coerced for ==.
    return false;
  }
  switch (a.type) {
    case "string":
      return a.value === (b as typeof a).value;
    case "number":
      return a.value === (b as typeof a).value;
    case "boolean":
      return a.value === (b as typeof a).value;
    case "date":
      return a.epochMs === (b as DateValue).epochMs;
    case "duration":
      return a.ms === (b as DurationValue).ms && a.months === (b as DurationValue).months;
    case "list": {
      const bl = (b as typeof a).value;
      return a.value.length === bl.length && a.value.every((x, i) => valueEquals(x, bl[i]));
    }
    case "object": {
      const bo = (b as typeof a).value;
      const ak = Object.keys(a.value);
      const bk = Object.keys(bo);
      return ak.length === bk.length && ak.every((k) => k in bo && valueEquals(a.value[k], bo[k]));
    }
    case "regexp":
      return a.pattern === (b as RegexpValue).pattern && a.flags === (b as RegexpValue).flags;
    default:
      return false;
  }
}

function linkTarget(v: Value): string | null {
  if (v.type === "link") return v.target;
  if (v.type === "file") return v.path;
  return null;
}

function normaliseTarget(t: string): string {
  // Strip a trailing ".md" and any folder for loose matching by basename.
  let s = t.replace(/\.md$/i, "");
  const slash = s.lastIndexOf("/");
  if (slash >= 0) s = s.slice(slash + 1);
  return s.toLowerCase();
}

/**
 * Three-way comparison used by `< <= > >=` and sorting. Returns -1/0/1, or
 * `null` when the two values are not comparable.
 */
export function compareValues(a: Value, b: Value): number | null {
  // Nulls sort last / are not comparable for </>
  if (a.type === "null" && b.type === "null") return 0;
  if (a.type === "null") return 1;
  if (b.type === "null") return -1;

  if (a.type === "number" && b.type === "number") return cmpNum(a.value, b.value);
  if (a.type === "date" && b.type === "date") return cmpNum(a.epochMs, b.epochMs);
  if (a.type === "duration" && b.type === "duration") {
    return cmpNum(a.months * 2629800000 + a.ms, b.months * 2629800000 + b.ms);
  }
  if (a.type === "boolean" && b.type === "boolean") return cmpNum(a.value ? 1 : 0, b.value ? 1 : 0);
  if (a.type === "string" && b.type === "string") {
    return a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
  }
  if (a.type === "list" && b.type === "list") {
    const len = Math.min(a.value.length, b.value.length);
    for (let i = 0; i < len; i++) {
      const c = compareValues(a.value[i], b.value[i]);
      if (c === null) return null;
      if (c !== 0) return c;
    }
    return cmpNum(a.value.length, b.value.length);
  }
  // Mixed string/number etc.: fall back to string comparison of display.
  if ((a.type === "string" || a.type === "number") && (b.type === "string" || b.type === "number")) {
    const as = valueToString(a);
    const bs = valueToString(b);
    return as < bs ? -1 : as > bs ? 1 : 0;
  }
  return null;
}

function cmpNum(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Best-effort numeric coercion (used by number() and arithmetic). */
export function toNumber(v: Value): number {
  switch (v.type) {
    case "number":
      return v.value;
    case "boolean":
      return v.value ? 1 : 0;
    case "date":
      return v.epochMs;
    case "duration":
      return v.ms + v.months * 2629800000;
    case "string": {
      const n = Number(v.value.trim());
      return n;
    }
    case "null":
      return NaN;
    default:
      return NaN;
  }
}

/** String representation, as returned by `toString()` and used for display. */
export function valueToString(v: Value): string {
  switch (v.type) {
    case "null":
      return "";
    case "string":
      return v.value;
    case "number":
      return numberToString(v.value);
    case "boolean":
      return v.value ? "true" : "false";
    case "list":
      return v.value.map(valueToString).join(", ");
    case "link":
      return v.display ?? v.target;
    case "file":
      return v.path;
    case "date":
      return formatISO(v);
    case "duration":
      return durationToString(v);
    case "regexp":
      return `/${v.pattern}/${v.flags}`;
    case "html":
      return v.value;
    case "image":
      return v.src;
    case "icon":
      return v.name;
    case "object":
      return JSON.stringify(
        Object.fromEntries(Object.entries(v.value).map(([k, val]) => [k, valueToString(val)])),
      );
  }
}

export function numberToString(n: number): string {
  if (Number.isNaN(n)) return "NaN";
  if (!Number.isFinite(n)) return n > 0 ? "Infinity" : "-Infinity";
  return String(n);
}

function formatISO(d: DateValue): string {
  const dt = new Date(d.epochMs);
  const date = dt.toISOString().slice(0, 10);
  if (!d.hasTime) return date;
  return `${date} ${dt.toISOString().slice(11, 19)}`;
}

export function durationToString(d: DurationValue): string {
  const parts: string[] = [];
  if (d.months) {
    const years = Math.trunc(d.months / 12);
    const months = d.months % 12;
    if (years) parts.push(`${years}y`);
    if (months) parts.push(`${months}M`);
  }
  let ms = d.ms;
  const units: [number, string][] = [
    [86400000, "d"],
    [3600000, "h"],
    [60000, "m"],
    [1000, "s"],
  ];
  for (const [size, label] of units) {
    if (Math.abs(ms) >= size) {
      const n = Math.trunc(ms / size);
      ms -= n * size;
      parts.push(`${n}${label}`);
    }
  }
  if (ms !== 0) parts.push(`${ms}ms`);
  return parts.length ? parts.join(" ") : "0s";
}

// ----------------------------------------------------------------------------
// Date construction & arithmetic helpers
// ----------------------------------------------------------------------------

const MS_PER_DAY = 86400000;

/** Parse a `YYYY-MM-DD[ HH:mm:ss]` (or ISO) string into a DateValue (UTC). */
export function parseDate(input: string): DateValue | null {
  const s = input.trim();
  if (!s) return null;
  // Date-only: YYYY-MM-DD
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const epoch = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    if (Number.isNaN(epoch)) return null;
    return { type: "date", epochMs: epoch, hasTime: false };
  }
  // Date + time: YYYY-MM-DD[ T]HH:mm[:ss[.SSS]]
  m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?Z?$/.exec(s);
  if (m) {
    const epoch = Date.UTC(
      +m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0, m[7] ? +m[7].padEnd(3, "0") : 0,
    );
    if (Number.isNaN(epoch)) return null;
    return { type: "date", epochMs: epoch, hasTime: true };
  }
  // Fall back to Date parsing.
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    return { type: "date", epochMs: t, hasTime: /[T ]\d{2}:/.test(s) };
  }
  return null;
}

const DURATION_UNITS: Record<string, "y" | "M" | "w" | "d" | "h" | "m" | "s"> = {
  y: "y", year: "y", years: "y",
  M: "M", month: "M", months: "M",
  w: "w", week: "w", weeks: "w",
  d: "d", day: "d", days: "d",
  h: "h", hour: "h", hours: "h",
  m: "m", minute: "m", minutes: "m",
  s: "s", second: "s", seconds: "s",
};

/** Parse a duration string such as `"1M"`, `"2 hours"`, `"7d"`. */
export function parseDuration(input: string): DurationValue | null {
  const s = input.trim();
  // Allow several concatenated components: "1M 4h 3m" or "1M4h3m".
  const re = /(-?\d+(?:\.\d+)?)\s*([A-Za-z]+)/g;
  let months = 0;
  let ms = 0;
  let matched = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const n = Number(m[1]);
    const unit = DURATION_UNITS[m[2]];
    if (!unit) return null;
    matched = true;
    switch (unit) {
      case "y": months += n * 12; break;
      case "M": months += n; break;
      case "w": ms += n * 7 * MS_PER_DAY; break;
      case "d": ms += n * MS_PER_DAY; break;
      case "h": ms += n * 3600000; break;
      case "m": ms += n * 60000; break;
      case "s": ms += n * 1000; break;
    }
  }
  if (!matched) return null;
  return { type: "duration", ms, months };
}

/** Add a duration to a date, applying calendar months/years correctly. */
export function addDuration(date: DateValue, dur: DurationValue, sign = 1): DateValue {
  let epoch = date.epochMs;
  if (dur.months) {
    const d = new Date(epoch);
    d.setUTCMonth(d.getUTCMonth() + sign * dur.months);
    epoch = d.getTime();
  }
  epoch += sign * dur.ms;
  return { type: "date", epochMs: epoch, hasTime: date.hasTime || dur.ms % MS_PER_DAY !== 0 };
}

/** Field accessor for dates (year/month/day/hour/minute/second/millisecond). */
export function dateField(d: DateValue, field: string): Value | null {
  const dt = new Date(d.epochMs);
  switch (field) {
    case "year": return num(dt.getUTCFullYear());
    case "month": return num(dt.getUTCMonth() + 1);
    case "day": return num(dt.getUTCDate());
    case "hour": return num(dt.getUTCHours());
    case "minute": return num(dt.getUTCMinutes());
    case "second": return num(dt.getUTCSeconds());
    case "millisecond": return num(dt.getUTCMilliseconds());
    default: return null;
  }
}

/** Field accessor for durations (days/hours/... and total variants). */
export function durationField(d: DurationValue, field: string): Value | null {
  const total = d.ms + d.months * 2629800000;
  switch (field) {
    case "years": return num(Math.trunc(d.months / 12));
    case "months": return num(d.months);
    case "weeks": return num(total / (7 * MS_PER_DAY));
    case "days": return num(total / MS_PER_DAY);
    case "hours": return num(total / 3600000);
    case "minutes": return num(total / 60000);
    case "seconds": return num(total / 1000);
    case "milliseconds": return num(total);
    default: return null;
  }
}

export { MS_PER_DAY };
