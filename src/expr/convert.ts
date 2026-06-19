import { NoteRecord } from "../vault/noteRecord";
import {
  Value, NULL, str, num, bool, list, link, file, dateVal, obj,
} from "./values";

// Bridges the untyped world (YAML frontmatter, file metadata) into the typed
// Value model the evaluator works with.

const WIKILINK_RE = /^\s*\[\[([^\]]+)\]\]\s*$/;

/** Convert a raw JS value (from parsed YAML) into a Bases Value. */
export function fromRaw(raw: unknown): Value {
  if (raw === null || raw === undefined) {
    return NULL;
  }
  if (typeof raw === "string") {
    const m = WIKILINK_RE.exec(raw);
    if (m) {
      const [target, display] = splitAlias(m[1]);
      return link(target, display);
    }
    return str(raw);
  }
  if (typeof raw === "number") {
    return num(raw);
  }
  if (typeof raw === "boolean") {
    return bool(raw);
  }
  if (raw instanceof Date) {
    const ms = raw.getTime();
    // YAML date-only values land on a UTC midnight; treat those as date-only.
    const hasTime = ms % 86400000 !== 0;
    return dateVal(ms, hasTime);
  }
  if (Array.isArray(raw)) {
    return list(raw.map(fromRaw));
  }
  if (typeof raw === "object") {
    const out: Record<string, Value> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      out[k] = fromRaw(v);
    }
    return obj(out);
  }
  return str(String(raw));
}

function splitAlias(target: string): [string, string | undefined] {
  const bar = target.indexOf("|");
  if (bar >= 0) {
    return [target.slice(0, bar).trim(), target.slice(bar + 1).trim()];
  }
  return [target.trim(), undefined];
}

/** Look up a note property by key (bare identifier or note.* member). */
export function noteProperty(note: NoteRecord, key: string): Value {
  if (Object.prototype.hasOwnProperty.call(note.frontmatter, key)) {
    return fromRaw(note.frontmatter[key]);
  }
  return NULL;
}

/** All note properties as an object Value (used for `note` and file.properties). */
export function notePropertiesObject(note: NoteRecord): Value {
  const out: Record<string, Value> = {};
  for (const [k, v] of Object.entries(note.frontmatter)) {
    out[k] = fromRaw(v);
  }
  return obj(out);
}

/** Resolve a `file.<field>` access for a given note. */
export function fileField(note: NoteRecord, field: string): Value | null {
  const f = note.file;
  switch (field) {
    case "name": return str(f.name);
    case "basename": return str(f.basename);
    case "path": return str(f.path);
    case "folder": return str(f.folder);
    case "ext": return str(f.ext);
    case "size": return num(f.size);
    case "ctime": return dateVal(f.ctime, true);
    case "mtime": return dateVal(f.mtime, true);
    case "tags": return list(f.tags.map(str));
    case "links": return list(f.links.map((t) => link(t)));
    case "embeds": return list(f.embeds.map((t) => link(t)));
    case "properties": return notePropertiesObject(note);
    case "file": return file(f.path);
    default: return null;
  }
}
