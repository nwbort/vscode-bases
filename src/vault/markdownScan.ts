// Lightweight extraction of inline #tags, [[wikilinks]] and ![[embeds]] from a
// Markdown body. Frontmatter has already been stripped by the caller.
//
// NOTE: these are intentionally simple regexes for the scaffold. A fuller
// implementation should skip code blocks/inline code and handle aliases
// (`[[target|alias]]`) and headings/blocks (`[[target#heading]]`). See M1 in
// IMPLEMENTATION_PLAN.md.

const TAG_RE = /(?:^|\s)#([A-Za-z0-9_\-/]+)/g;
const EMBED_RE = /!\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;
const LINK_RE = /(?<!!)\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;

export function scanTags(body: string): string[] {
  return unique(matchAll(body, TAG_RE));
}

export function scanLinks(body: string): string[] {
  return unique(matchAll(body, LINK_RE));
}

export function scanEmbeds(body: string): string[] {
  return unique(matchAll(body, EMBED_RE));
}

function matchAll(text: string, re: RegExp): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(re)) {
    out.push(m[1].trim());
  }
  return out;
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
