import { Node } from "./ast";
import { EvalContext } from "./context";
import { Value, isTruthy } from "./values";
import { parseExpression } from "./parser";

// Walks the AST and produces a Value within an EvalContext.
//
// TODO(M2): implement evaluation for every Node kind:
//   - literals, list/object literals, regex
//   - identifier resolution via EvalContext (note./file./formula./this/locals)
//   - member field access (date.year, string.length, list.length, object.key)
//   - index access (list[i], object["k"])
//   - method calls dispatched on receiver Value type (functions/index.ts)
//   - global function calls
//   - unary ! and -, binary arithmetic/comparison/boolean + date arithmetic
//   - filter/map/reduce must pass argument *expressions* (lazy) plus the
//     value/index/acc locals, not pre-evaluated Values.

export function evaluate(_node: Node, _ctx: EvalContext): Value {
  throw new Error("expr/evaluator: not implemented (M2). See IMPLEMENTATION_PLAN.md §3.");
}

/** Parse + evaluate a source expression. Convenience used by filters/formulas. */
export function evaluateSource(source: string, ctx: EvalContext): Value {
  return evaluate(parseExpression(source), ctx);
}

/** Evaluate a filter statement string to a boolean. */
export function evaluateFilterStatement(source: string, ctx: EvalContext): boolean {
  return isTruthy(evaluateSource(source, ctx));
}
