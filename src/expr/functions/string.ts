import { Value, NULL, str, num, bool, list, valueToString, isEmpty } from "../values";

export type MethodFn = (receiver: Value, args: Value[]) => Value;

function s(v: Value): string {
  return v.type === "string" ? v.value : valueToString(v);
}

function regexFromArg(v: Value): RegExp | null {
  if (v.type === "regexp") return new RegExp(v.pattern, v.flags);
  return null;
}

export const stringMethods: Record<string, MethodFn> = {
  contains: (recv, args) => bool(s(recv).includes(valueToString(args[0] ?? NULL))),

  containsAll: (recv, args) => {
    const hay = s(recv);
    return bool(args.every((a) => hay.includes(valueToString(a))));
  },

  containsAny: (recv, args) => {
    const hay = s(recv);
    return bool(args.some((a) => hay.includes(valueToString(a))));
  },

  endsWith: (recv, args) => bool(s(recv).endsWith(valueToString(args[0] ?? NULL))),

  isEmpty: (recv) => bool(isEmpty(recv)),

  lower: (recv) => str(s(recv).toLowerCase()),

  upper: (recv) => str(s(recv).toUpperCase()),

  replace: (recv, args) => {
    const hay = s(recv);
    const pattern = args[0] ?? NULL;
    const replacement = valueToString(args[1] ?? NULL);
    const re = regexFromArg(pattern);
    if (re) {
      return str(hay.replace(re, replacement));
    }
    return str(hay.split(valueToString(pattern)).join(replacement));
  },

  repeat: (recv, args) => {
    const count = args[0]?.type === "number" ? args[0].value : 0;
    return str(count > 0 ? s(recv).repeat(Math.floor(count)) : "");
  },

  reverse: (recv) => str([...s(recv)].reverse().join("")),

  slice: (recv, args) => {
    const start = args[0]?.type === "number" ? args[0].value : 0;
    const end = args[1]?.type === "number" ? args[1].value : undefined;
    return str(s(recv).slice(start, end));
  },

  split: (recv, args) => {
    const sep = args[0] ?? NULL;
    const n = args[1]?.type === "number" ? args[1].value : undefined;
    const re = regexFromArg(sep);
    const parts = re ? s(recv).split(re) : s(recv).split(valueToString(sep));
    const sliced = n !== undefined ? parts.slice(0, n) : parts;
    return list(sliced.map(str));
  },

  startsWith: (recv, args) => bool(s(recv).startsWith(valueToString(args[0] ?? NULL))),

  title: (recv) => str(s(recv).replace(/\b\w/g, (c) => c.toUpperCase())),

  trim: (recv) => str(s(recv).trim()),

  length: (recv) => num(s(recv).length),
};
