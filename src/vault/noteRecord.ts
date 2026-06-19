// One indexed Markdown file. Carries everything the expression engine needs to
// evaluate filters/formulas for this note. See docs/obsidian/Bases syntax.md
// (File properties) and docs/obsidian/Functions.md (File fields).

export interface FileProps {
  name: string; // file name incl. extension, e.g. "Alice.md"
  basename: string; // without extension, e.g. "Alice"
  path: string; // vault-relative path
  folder: string; // parent folder path
  ext: string; // extension without dot, e.g. "md"
  size: number; // bytes
  ctime: number; // epoch ms
  mtime: number; // epoch ms
  tags: string[]; // frontmatter + inline #tags (without leading #)
  links: string[]; // [[wikilink]] targets
  embeds: string[]; // ![[embed]] targets
}

export interface NoteRecord {
  file: FileProps;
  /** Parsed YAML frontmatter (note properties). */
  frontmatter: Record<string, unknown>;
}
