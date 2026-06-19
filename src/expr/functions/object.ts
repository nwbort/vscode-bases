import { Value, str, bool, list } from "../values";

export type MethodFn = (receiver: Value, args: Value[]) => Value;

function entries(v: Value): [string, Value][] {
  return v.type === "object" ? Object.entries(v.value) : [];
}

export const objectMethods: Record<string, MethodFn> = {
  isEmpty: (recv) => bool(entries(recv).length === 0),

  keys: (recv) => list(entries(recv).map(([k]) => str(k))),

  values: (recv) => list(entries(recv).map(([, v]) => v)),
};
