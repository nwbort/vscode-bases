import { Value, NULL, str, num, bool, list, valueEquals, compareValues, valueToString } from "../values";

export type MethodFn = (receiver: Value, args: Value[]) => Value;

// Note: filter / map / reduce are NOT here — they require lazy argument
// expressions and value/index/acc locals, so the evaluator handles them.

function items(v: Value): Value[] {
  return v.type === "list" ? v.value : [];
}

export const listMethods: Record<string, MethodFn> = {
  contains: (recv, args) => bool(items(recv).some((e) => valueEquals(e, args[0] ?? NULL))),

  containsAll: (recv, args) => {
    const arr = items(recv);
    return bool(args.every((a) => arr.some((e) => valueEquals(e, a))));
  },

  containsAny: (recv, args) => {
    const arr = items(recv);
    return bool(args.some((a) => arr.some((e) => valueEquals(e, a))));
  },

  flat: (recv) => {
    const out: Value[] = [];
    for (const e of items(recv)) {
      if (e.type === "list") out.push(...e.value);
      else out.push(e);
    }
    return list(out);
  },

  isEmpty: (recv) => bool(items(recv).length === 0),

  join: (recv, args) => {
    const sep = args[0]?.type === "string" ? args[0].value : valueToString(args[0] ?? str(""));
    return str(items(recv).map(valueToString).join(sep));
  },

  reverse: (recv) => list([...items(recv)].reverse()),

  slice: (recv, args) => {
    const start = args[0]?.type === "number" ? args[0].value : 0;
    const end = args[1]?.type === "number" ? args[1].value : undefined;
    return list(items(recv).slice(start, end));
  },

  sort: (recv) => {
    const arr = [...items(recv)];
    arr.sort((a, b) => compareValues(a, b) ?? 0);
    return list(arr);
  },

  unique: (recv) => {
    const out: Value[] = [];
    for (const e of items(recv)) {
      if (!out.some((x) => valueEquals(x, e))) out.push(e);
    }
    return list(out);
  },

  length: (recv) => num(items(recv).length),

  // Numeric aggregations — handy in summary formulas (e.g. values.mean()).
  sum: (recv) => num(numbersOf(recv).reduce((a, b) => a + b, 0)),

  mean: (recv) => meanValue(recv),

  avg: (recv) => meanValue(recv),

  median: (recv) => {
    const ns = numbersOf(recv).sort((a, b) => a - b);
    if (ns.length === 0) return NULL;
    const mid = Math.floor(ns.length / 2);
    return num(ns.length % 2 ? ns[mid] : (ns[mid - 1] + ns[mid]) / 2);
  },

  min: (recv) => {
    const ns = numbersOf(recv);
    return ns.length ? num(Math.min(...ns)) : NULL;
  },

  max: (recv) => {
    const ns = numbersOf(recv);
    return ns.length ? num(Math.max(...ns)) : NULL;
  },
};

function numbersOf(v: Value): number[] {
  return items(v)
    .filter((e) => e.type === "number")
    .map((e) => (e as { value: number }).value);
}

function meanValue(v: Value): Value {
  const ns = numbersOf(v);
  return ns.length ? num(ns.reduce((a, b) => a + b, 0) / ns.length) : NULL;
}
