// Property ids appear throughout a .base file: `file.name`, `note.company`,
// `formula.ppu`, or a bare `company` (which is shorthand for `note.company`).

export type PropertyScope = "file" | "note" | "formula";

export interface PropertyId {
  scope: PropertyScope;
  /** The key within the scope, e.g. "name" or "company". May contain spaces. */
  key: string;
  /** The original id as written in the .base file. */
  raw: string;
}

export function parsePropertyId(raw: string): PropertyId {
  const trimmed = raw.trim();
  const dot = trimmed.indexOf(".");
  if (dot > 0) {
    const prefix = trimmed.slice(0, dot);
    if (prefix === "file" || prefix === "note" || prefix === "formula") {
      return { scope: prefix, key: trimmed.slice(dot + 1), raw };
    }
  }
  // No recognised prefix -> note property shorthand.
  return { scope: "note", key: trimmed, raw };
}

/** Default display name when `properties[id].displayName` is not set. */
export function defaultDisplayName(id: PropertyId): string {
  return id.key;
}
