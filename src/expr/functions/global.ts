import { EvalContext } from "../context";
import {
  Value, NULL, str, num, bool, list, link, file, dateVal,
  parseDate, parseDuration, toNumber, valueToString, isTruthy,
} from "../values";

// Global functions — called without a receiver, e.g. `if(...)`, `date(...)`.

export type GlobalFn = (args: Value[], ctx: EvalContext) => Value;

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const globals: Record<string, GlobalFn> = {
  escapeHTML: (args) => str(escapeHTML(valueToString(args[0] ?? NULL))),

  date: (args) => {
    const a = args[0] ?? NULL;
    if (a.type === "date") return a;
    if (a.type === "number") return dateVal(a.value, true);
    const parsed = parseDate(valueToString(a));
    return parsed ?? NULL;
  },

  duration: (args) => {
    const a = args[0] ?? NULL;
    if (a.type === "duration") return a;
    const parsed = parseDuration(valueToString(a));
    return parsed ?? NULL;
  },

  file: (args, ctx) => {
    const a = args[0] ?? NULL;
    let target: string;
    if (a.type === "link") target = a.target;
    else if (a.type === "file") return a;
    else target = valueToString(a);
    const rec = ctx.resolveFile(target);
    return file(rec ? rec.file.path : target);
  },

  html: (args) => ({ type: "html", value: valueToString(args[0] ?? NULL) }),

  if: (args) => {
    const cond = args[0] ?? NULL;
    if (isTruthy(cond)) return args[1] ?? NULL;
    return args[2] ?? NULL;
  },

  image: (args) => {
    const a = args[0] ?? NULL;
    const src = a.type === "file" ? a.path : a.type === "link" ? a.target : valueToString(a);
    return { type: "image", src };
  },

  icon: (args) => ({ type: "icon", name: valueToString(args[0] ?? NULL) }),

  link: (args) => {
    const a = args[0] ?? NULL;
    let target: string;
    if (a.type === "file") target = a.path;
    else if (a.type === "link") target = a.target;
    else target = valueToString(a);
    const display = args[1] !== undefined && args[1].type !== "null" ? valueToString(args[1]) : undefined;
    return link(target, display);
  },

  list: (args) => {
    const a = args[0] ?? NULL;
    if (a.type === "list") return a;
    if (a.type === "null") return list([]);
    return list([a]);
  },

  max: (args) => {
    const nums = args.map(toNumber).filter((n) => !Number.isNaN(n));
    return nums.length ? num(Math.max(...nums)) : NULL;
  },

  min: (args) => {
    const nums = args.map(toNumber).filter((n) => !Number.isNaN(n));
    return nums.length ? num(Math.min(...nums)) : NULL;
  },

  now: (_args, ctx) => dateVal(ctx.now(), true),

  number: (args) => {
    const n = toNumber(args[0] ?? NULL);
    return Number.isNaN(n) ? NULL : num(n);
  },

  today: (_args, ctx) => ctx.today(),

  random: () => num(Math.random()),

  // `if` truthiness helper exposed as a global too in some bases.
  bool: (args) => bool(isTruthy(args[0] ?? NULL)),
};
