import { EvalContext, withLocals } from "../expr/context";
import { evaluateSource } from "../expr/evaluator";
import {
  Value, NULL, num, list, dateVal, duration,
  isEmpty, valueEquals,
} from "../expr/values";

// Computes the value of a named summary over a column's value list. Names refer
// either to a built-in summary (see docs/obsidian/Bases syntax.md) or a custom
// summary formula defined in the base's top-level `summaries` map, where the
// keyword `values` is bound to the list of column values.

function numbers(values: Value[]): number[] {
  return values.filter((v) => v.type === "number").map((v) => (v as { value: number }).value);
}

function dates(values: Value[]): number[] {
  return values.filter((v) => v.type === "date").map((v) => (v as { epochMs: number }).epochMs);
}

const BUILTINS: Record<string, (values: Value[]) => Value> = {
  Average: (v) => {
    const ns = numbers(v);
    return ns.length ? num(ns.reduce((a, b) => a + b, 0) / ns.length) : NULL;
  },
  Sum: (v) => num(numbers(v).reduce((a, b) => a + b, 0)),
  Min: (v) => {
    const ns = numbers(v);
    return ns.length ? num(Math.min(...ns)) : NULL;
  },
  Max: (v) => {
    const ns = numbers(v);
    return ns.length ? num(Math.max(...ns)) : NULL;
  },
  Median: (v) => {
    const ns = numbers(v).sort((a, b) => a - b);
    if (!ns.length) return NULL;
    const mid = Math.floor(ns.length / 2);
    return num(ns.length % 2 ? ns[mid] : (ns[mid - 1] + ns[mid]) / 2);
  },
  Stddev: (v) => {
    const ns = numbers(v);
    if (ns.length < 1) return NULL;
    const mean = ns.reduce((a, b) => a + b, 0) / ns.length;
    const variance = ns.reduce((a, b) => a + (b - mean) ** 2, 0) / ns.length;
    return num(Math.sqrt(variance));
  },
  Range: (v) => {
    const ns = numbers(v);
    if (ns.length) return num(Math.max(...ns) - Math.min(...ns));
    const ds = dates(v);
    if (ds.length) return duration(Math.max(...ds) - Math.min(...ds), 0);
    return NULL;
  },
  Earliest: (v) => {
    const ds = dates(v);
    return ds.length ? dateVal(Math.min(...ds), true) : NULL;
  },
  Latest: (v) => {
    const ds = dates(v);
    return ds.length ? dateVal(Math.max(...ds), true) : NULL;
  },
  Checked: (v) => num(v.filter((x) => x.type === "boolean" && x.value).length),
  Unchecked: (v) => num(v.filter((x) => x.type === "boolean" && !x.value).length),
  Empty: (v) => num(v.filter(isEmpty).length),
  Filled: (v) => num(v.filter((x) => !isEmpty(x)).length),
  Unique: (v) => {
    const seen: Value[] = [];
    for (const x of v) {
      if (!seen.some((s) => valueEquals(s, x))) seen.push(x);
    }
    return num(seen.length);
  },
};

export function computeSummary(
  name: string,
  values: Value[],
  customSummaries: Record<string, string>,
  ctx: EvalContext,
): Value {
  const builtin = BUILTINS[name];
  if (builtin) {
    return builtin(values);
  }
  const formula = customSummaries[name];
  if (formula !== undefined) {
    try {
      return evaluateSource(formula, withLocals(ctx, { values: list(values) }));
    } catch {
      return NULL;
    }
  }
  return NULL;
}

export function isKnownSummary(name: string, customSummaries: Record<string, string>): boolean {
  return name in BUILTINS || name in customSummaries;
}
