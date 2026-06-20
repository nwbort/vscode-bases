import { EvalContext } from "../context";
import { NoteRecord } from "../../vault/noteRecord";
import { Value, NULL, bool, link, file, valueToString } from "../values";
import { fileField } from "../convert";

// File and Link methods. These need the EvalContext (to resolve other files in
// the vault), so they are dispatched from the evaluator rather than the plain
// method registry.

export type CtxMethodFn = (receiver: Value, args: Value[], ctx: EvalContext) => Value;

function recordFor(v: Value, ctx: EvalContext): NoteRecord | undefined {
  if (v.type === "file") return ctx.resolveFile(v.path);
  if (v.type === "link") return ctx.resolveFile(v.target);
  return undefined;
}

function targetOf(v: Value): string {
  if (v.type === "file") return v.path;
  if (v.type === "link") return v.target;
  return valueToString(v);
}

export const fileMethods: Record<string, CtxMethodFn> = {
  asLink: (recv, args) => {
    const path = recv.type === "file" ? recv.path : valueToString(recv);
    const display = args[0] && args[0].type !== "null" ? valueToString(args[0]) : undefined;
    return link(path, display);
  },

  hasLink: (recv, args, ctx) => {
    const rec = recordFor(recv, ctx);
    if (!rec) return bool(false);
    const other = targetOf(args[0] ?? NULL).replace(/\.(md|base)$/i, "");
    const otherBase = other.split("/").pop() ?? other;
    return bool(
      rec.file.links.some((l) => {
        const lb = l.replace(/\.(md|base)$/i, "").split("/").pop() ?? l;
        return lb === otherBase || l === other;
      }),
    );
  },

  hasProperty: (recv, args, ctx) => {
    const rec = recordFor(recv, ctx);
    if (!rec) return bool(false);
    const name = valueToString(args[0] ?? NULL);
    return bool(Object.prototype.hasOwnProperty.call(rec.frontmatter, name));
  },

  hasTag: (recv, args, ctx) => {
    const rec = recordFor(recv, ctx);
    if (!rec) return bool(false);
    const wanted = args.map(valueToString);
    return bool(
      wanted.some((w) =>
        rec.file.tags.some((t) => t === w || t.startsWith(`${w}/`)),
      ),
    );
  },

  inFolder: (recv, args, ctx) => {
    const rec = recordFor(recv, ctx);
    if (!rec) return bool(false);
    const folder = valueToString(args[0] ?? NULL).replace(/\/$/, "");
    const f = rec.file.folder;
    return bool(f === folder || f.startsWith(`${folder}/`) || f.split("/").includes(folder));
  },
};

export const linkMethods: Record<string, CtxMethodFn> = {
  asFile: (recv, _args, ctx) => {
    const rec = recordFor(recv, ctx);
    return rec ? file(rec.file.path) : NULL;
  },

  linksTo: (recv, args, ctx) => {
    const rec = recordFor(recv, ctx);
    if (!rec) return bool(false);
    const other = targetOf(args[0] ?? NULL).replace(/\.(md|base)$/i, "").split("/").pop();
    return bool(
      rec.file.links.some((l) => (l.replace(/\.(md|base)$/i, "").split("/").pop() ?? l) === other),
    );
  },
};

/** Field access for file-typed values that need the record (file.size, etc.). */
export function fileValueField(recv: Value, field: string, ctx: EvalContext): Value | null {
  const rec = recordFor(recv, ctx);
  if (!rec) return NULL;
  return fileField(rec, field);
}
