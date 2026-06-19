import { Filter, FilterGroup } from "../model/baseSchema";
import { EvalContext } from "../expr/context";
import { evaluateFilterStatement } from "../expr/evaluator";

// Evaluates a filter (a statement string or a recursive and/or/not group)
// against a note's EvalContext. A malformed statement is treated as `false`
// rather than aborting the whole view.

export function passesFilter(filter: Filter | undefined, ctx: EvalContext): boolean {
  if (filter === undefined) {
    return true;
  }
  if (typeof filter === "string") {
    try {
      return evaluateFilterStatement(filter, ctx);
    } catch {
      return false;
    }
  }
  return passesGroup(filter, ctx);
}

function passesGroup(group: FilterGroup, ctx: EvalContext): boolean {
  if (group.and) {
    if (!group.and.every((f) => passesFilter(f, ctx))) return false;
  }
  if (group.or) {
    if (!group.or.some((f) => passesFilter(f, ctx))) return false;
  }
  if (group.not) {
    // `not` passes when none of its child statements match.
    if (group.not.some((f) => passesFilter(f, ctx))) return false;
  }
  return true;
}

/** Combine the global and view filters with an implicit AND. */
export function passesCombined(
  globalFilter: Filter | undefined,
  viewFilter: Filter | undefined,
  ctx: EvalContext,
): boolean {
  return passesFilter(globalFilter, ctx) && passesFilter(viewFilter, ctx);
}
