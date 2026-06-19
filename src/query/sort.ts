import { SortSpec } from "../model/baseSchema";
import { EvalContext } from "../expr/context";
import { compareValues } from "../expr/values";
import { resolveProperty } from "./resolveProperty";

// Multi-key, type-aware sort. Each row carries its EvalContext so property
// values (including formulas) are resolved per the note being compared.

export interface SortableRow {
  ctx: EvalContext;
}

export function sortRows<T extends SortableRow>(rows: T[], sort: SortSpec[] | undefined): T[] {
  if (!sort || sort.length === 0) {
    return rows;
  }
  const decorated = rows.map((row, index) => ({ row, index }));
  decorated.sort((a, b) => {
    for (const spec of sort) {
      const av = resolveProperty(spec.property, a.row.ctx);
      const bv = resolveProperty(spec.property, b.row.ctx);
      let c = compareValues(av, bv);
      if (c === null) c = 0;
      if (c !== 0) {
        return spec.direction === "DESC" ? -c : c;
      }
    }
    // Stable fallback on original order.
    return a.index - b.index;
  });
  return decorated.map((d) => d.row);
}
