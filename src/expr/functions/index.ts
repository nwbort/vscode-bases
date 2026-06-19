import { Value } from "../values";

// Function registry. Functions are dispatched by the receiver Value type for
// methods (e.g. string.lower()), and by name for globals (e.g. if(), date()).
//
// Implement every function in docs/obsidian/Functions.md, grouped into sibling
// files: global.ts, any.ts, string.ts, number.ts, date.ts, list.ts, link.ts,
// file.ts, object.ts, regexp.ts.
//
// list.filter/map/reduce need access to lazily-evaluated argument expressions
// and the value/index/acc locals, so their signatures differ from plain
// functions — model them specially in the evaluator. See IMPLEMENTATION_PLAN §3.

export type GlobalFn = (args: Value[]) => Value;
export type MethodFn = (receiver: Value, args: Value[]) => Value;

export const globals: Record<string, GlobalFn> = {
  // TODO(M2): if, date, duration, now, today, link, list, min, max, number,
  // file, html, image, icon, escapeHTML, random
};

/** receiver ValueType -> (method name -> fn) */
export const methods: Record<string, Record<string, MethodFn>> = {
  // TODO(M2): populate from string.ts/number.ts/date.ts/list.ts/...
};
