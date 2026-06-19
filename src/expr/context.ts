import { NoteRecord } from "../vault/noteRecord";
import { Value } from "./values";

// Everything the evaluator needs to resolve identifiers while evaluating a
// single note. Property lookups resolve in this order (see Bases syntax docs):
//   - prefixed: note.* / file.* / formula.*
//   - bare identifier: treated as note.*
//   - `this`: the base file (or embedding/active file) — see syntax docs
//   - local bindings: `value`, `index`, `acc` inside list lambdas
export interface EvalContext {
  /** The note currently being evaluated (one "row"). */
  note: NoteRecord;
  /** Resolve and memoise a formula property by name; throws on cycles. */
  resolveFormula(name: string): Value;
  /** The `this` target's properties, depending on display location. */
  thisNote?: NoteRecord;
  /** Local variables for list lambdas (value/index/acc). */
  locals?: Record<string, Value>;
}
