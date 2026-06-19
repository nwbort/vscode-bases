import { Value } from "../values";
import { EvalContext } from "../context";
import { globals } from "./global";
import { anyMethods } from "./any";
import { stringMethods } from "./string";
import { numberMethods } from "./number";
import { dateMethods } from "./date";
import { listMethods } from "./list";
import { objectMethods } from "./object";
import { regexpMethods } from "./regexp";

// Function registry. Globals are dispatched by name; methods are dispatched by
// the receiver's runtime Value type. The lazy list methods (filter/map/reduce)
// and the context-heavy file/link methods are handled directly in the
// evaluator, not here.

export type GlobalFn = (args: Value[], ctx: EvalContext) => Value;
export type MethodFn = (receiver: Value, args: Value[], ctx: EvalContext) => Value;

export { globals };

/** receiver ValueType -> (method name -> fn) */
export const methods: Record<string, Record<string, MethodFn>> = {
  string: stringMethods,
  number: numberMethods,
  date: dateMethods,
  list: listMethods,
  object: objectMethods,
  regexp: regexpMethods,
};

/** Methods available on every value type ("any"). */
export const universalMethods: Record<string, MethodFn> = anyMethods;
