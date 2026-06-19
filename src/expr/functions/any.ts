import { Value, bool, str, isTruthy, valueToString, typeName } from "../values";

export type MethodFn = (receiver: Value, args: Value[]) => Value;

// Methods available on any value type.
export const anyMethods: Record<string, MethodFn> = {
  isTruthy: (recv: Value) => bool(isTruthy(recv)),

  isType: (recv: Value, args: Value[]) => {
    const wanted = args[0]?.type === "string" ? args[0].value : "";
    return bool(typeName(recv) === wanted);
  },

  toString: (recv: Value) => str(valueToString(recv)),
};
