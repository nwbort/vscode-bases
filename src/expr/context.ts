import { NoteRecord } from "../vault/noteRecord";
import { Value, DateValue } from "./values";
import { evaluateSource } from "./evaluator";

// Everything the evaluator needs to resolve identifiers while evaluating a
// single note. Property lookups resolve in this order (see Bases syntax docs):
//   - prefixed: note.* / file.* / formula.*
//   - bare identifier: treated as note.*
//   - `this`: the base file (or embedding/active file)
//   - local bindings: `value`, `index`, `acc` inside list lambdas
export interface EvalContext {
  /** The note currently being evaluated (one "row"). */
  note: NoteRecord;
  /** Resolve and memoise a formula property by name; throws on cycles. */
  resolveFormula(name: string): Value;
  /** The value of `this` (a file/object), depending on display location. */
  thisValue?: Value;
  /** Local variables for list lambdas (value/index/acc). */
  locals?: Record<string, Value>;
  /** Current instant in epoch ms (overridable for deterministic tests). */
  now(): number;
  /** Current date at UTC midnight. */
  today(): DateValue;
  /** Resolve another file by path or link target (basename). */
  resolveFile(target: string): NoteRecord | undefined;
  /** All indexed notes (used for backlinks / link resolution). */
  allNotes(): NoteRecord[];
}

export interface ContextDeps {
  notes: NoteRecord[];
  formulas: Record<string, string>;
  /** Optional frozen clock for tests. */
  nowMs?: number;
  thisValue?: Value;
}

/** Build an EvalContext for a single note within a dataset. */
export function makeContext(note: NoteRecord, deps: ContextDeps): EvalContext {
  const formulaCache = new Map<string, Value>();
  const inProgress = new Set<string>();

  const byPath = new Map<string, NoteRecord>();
  const byBasename = new Map<string, NoteRecord>();
  for (const n of deps.notes) {
    byPath.set(n.file.path, n);
    if (!byBasename.has(n.file.basename)) {
      byBasename.set(n.file.basename, n);
    }
  }

  const ctx: EvalContext = {
    note,
    thisValue: deps.thisValue,
    now: () => deps.nowMs ?? Date.now(),
    today: () => {
      const ms = deps.nowMs ?? Date.now();
      const d = new Date(ms);
      const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      return { type: "date", epochMs: midnight, hasTime: false };
    },
    resolveFile: (target: string) => {
      const clean = target.replace(/\.md$/i, "");
      return (
        byPath.get(target) ??
        byPath.get(`${clean}.md`) ??
        byBasename.get(clean) ??
        byBasename.get(target)
      );
    },
    allNotes: () => deps.notes,
    resolveFormula: (name: string): Value => {
      const cached = formulaCache.get(name);
      if (cached) {
        return cached;
      }
      const source = deps.formulas[name];
      if (source === undefined) {
        return { type: "null" };
      }
      if (inProgress.has(name)) {
        throw new Error(`Circular formula reference: ${name}`);
      }
      inProgress.add(name);
      try {
        const value = evaluateSource(source, ctx);
        formulaCache.set(name, value);
        return value;
      } finally {
        inProgress.delete(name);
      }
    },
  };

  return ctx;
}

/** Derive a child context that shares everything but swaps in new locals. */
export function withLocals(ctx: EvalContext, locals: Record<string, Value>): EvalContext {
  return { ...ctx, locals: { ...ctx.locals, ...locals } };
}
