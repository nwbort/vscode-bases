import { parsePropertyId } from "../model/propertyId";
import { EvalContext } from "../expr/context";
import { Value, NULL } from "../expr/values";
import { noteProperty, fileField } from "../expr/convert";

// Resolves a property id (e.g. "file.name", "company", "formula.ppu") to a
// Value for the note bound in `ctx`. Used by columns, sort, groupBy and
// summaries — none of which go through the expression parser since property
// ids may contain spaces (e.g. "job title").
export function resolveProperty(rawId: string, ctx: EvalContext): Value {
  const id = parsePropertyId(rawId);
  switch (id.scope) {
    case "file":
      return fileField(ctx.note, id.key) ?? NULL;
    case "formula":
      try {
        return ctx.resolveFormula(id.key);
      } catch {
        return NULL;
      }
    case "note":
    default:
      return noteProperty(ctx.note, id.key);
  }
}
