import { Value, NULL, str, num, bool } from "../values";

export type MethodFn = (receiver: Value, args: Value[]) => Value;

function n(v: Value): number {
  return v.type === "number" ? v.value : NaN;
}

export const numberMethods: Record<string, MethodFn> = {
  abs: (recv) => num(Math.abs(n(recv))),

  ceil: (recv) => num(Math.ceil(n(recv))),

  floor: (recv) => num(Math.floor(n(recv))),

  isEmpty: (recv) => bool(recv.type === "null" || Number.isNaN(n(recv))),

  round: (recv, args) => {
    const digits = args[0]?.type === "number" ? args[0].value : 0;
    const factor = Math.pow(10, digits);
    return num(Math.round(n(recv) * factor) / factor);
  },

  toFixed: (recv, args) => {
    const precision = args[0]?.type === "number" ? args[0].value : 0;
    const v = n(recv);
    return Number.isNaN(v) ? NULL : str(v.toFixed(precision));
  },
};
