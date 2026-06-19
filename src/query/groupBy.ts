import { GroupBy } from "../model/baseSchema";
import { EvalContext } from "../expr/context";
import { Value, compareValues, valueToString, isEmpty } from "../expr/values";
import { resolveProperty } from "./resolveProperty";

export interface GroupableRow {
  ctx: EvalContext;
}

export interface Group<T> {
  /** Display key for the group header. */
  key: string;
  /** The raw value the group was keyed on (for summaries / sorting). */
  keyValue: Value;
  rows: T[];
}

/** Partition rows into ordered groups by a single property. */
export function groupRows<T extends GroupableRow>(rows: T[], groupBy: GroupBy): Group<T>[] {
  const groups = new Map<string, Group<T>>();
  for (const row of rows) {
    const value = resolveProperty(groupBy.property, row.ctx);
    const key = isEmpty(value) ? "" : valueToString(value);
    let group = groups.get(key);
    if (!group) {
      group = { key, keyValue: value, rows: [] };
      groups.set(key, group);
    }
    group.rows.push(row);
  }

  const ordered = [...groups.values()];
  ordered.sort((a, b) => {
    // Empty group sorts last regardless of direction.
    if (a.key === "" && b.key !== "") return 1;
    if (b.key === "" && a.key !== "") return -1;
    let c = compareValues(a.keyValue, b.keyValue);
    if (c === null) c = a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    return groupBy.direction === "DESC" ? -c : c;
  });
  return ordered;
}
