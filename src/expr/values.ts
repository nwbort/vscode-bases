// The Bases value model. Filters/formulas evaluate to one of these. Behaviour
// follows JavaScript semantics (see docs/obsidian/Functions.md).
//
// TODO(M2): implement coercion, equality, comparison, and the per-type
// method/field tables described in docs/obsidian/Functions.md.

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
  | "null";

export interface DateValue {
  type: "date";
  epochMs: number;
  /** Whether the value carries a meaningful time component. */
  hasTime: boolean;
}

export interface DurationValue {
  type: "duration";
  ms: number;
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
  | { type: "null" };

export const NULL: Value = { type: "null" };

export const str = (value: string): Value => ({ type: "string", value });
export const num = (value: number): Value => ({ type: "number", value });
export const bool = (value: boolean): Value => ({ type: "boolean", value });
export const list = (value: Value[]): Value => ({ type: "list", value });

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
