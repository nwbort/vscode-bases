import { Value, NULL, bool, valueToString } from "../values";

export type MethodFn = (receiver: Value, args: Value[]) => Value;

export const regexpMethods: Record<string, MethodFn> = {
  matches: (recv, args) => {
    if (recv.type !== "regexp") return bool(false);
    const re = new RegExp(recv.pattern, recv.flags);
    return bool(re.test(valueToString(args[0] ?? NULL)));
  },
};
