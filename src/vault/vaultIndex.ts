import * as vscode from "vscode";
import matter from "gray-matter";
import { NoteRecord, FileProps } from "./noteRecord";
import { scanTags, scanLinks, scanEmbeds } from "./markdownScan";

// Indexes every Markdown file in the workspace and keeps it fresh via a file
// watcher. The index is the dataset that every base view queries against.
//
// Scaffold status: builds a full index on demand and watches for changes.
// TODO(M1): incremental re-index granularity, .gitignore/files.exclude
// respect, frontmatter [[wikilink]] -> Link recognition, backlinks inversion.

export class VaultIndex implements vscode.Disposable {
  private notes = new Map<string, NoteRecord>();
  private watcher?: vscode.FileSystemWatcher;
  private ready: Promise<void>;

  private readonly _onDidChange = new vscode.EventEmitter<void>();
  /** Fires whenever the index changes (any file created/changed/deleted). */
  readonly onDidChange = this._onDidChange.event;

  constructor() {
    this.ready = this.rebuild();
    this.watcher = vscode.workspace.createFileSystemWatcher("**/*.md");
    this.watcher.onDidCreate((uri) => this.updateOne(uri));
    this.watcher.onDidChange((uri) => this.updateOne(uri));
    this.watcher.onDidDelete((uri) => this.deleteOne(uri));
  }

  /** Resolves once the initial index has been built. */
  whenReady(): Promise<void> {
    return this.ready;
  }

  all(): NoteRecord[] {
    return [...this.notes.values()];
  }

  async rebuild(): Promise<void> {
    this.notes.clear();
    const exclude = getExcludeGlob();
    const uris = await vscode.workspace.findFiles("**/*.md", exclude);
    await Promise.all(uris.map((uri) => this.updateOne(uri, /*silent*/ true)));
    this._onDidChange.fire();
  }

  private async updateOne(uri: vscode.Uri, silent = false): Promise<void> {
    try {
      const record = await this.readNote(uri);
      this.notes.set(uri.fsPath, record);
    } catch {
      // Skip unreadable files.
    }
    if (!silent) {
      this._onDidChange.fire();
    }
  }

  private deleteOne(uri: vscode.Uri): void {
    if (this.notes.delete(uri.fsPath)) {
      this._onDidChange.fire();
    }
  }

  private async readNote(uri: vscode.Uri): Promise<NoteRecord> {
    const stat = await vscode.workspace.fs.stat(uri);
    const bytes = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(bytes).toString("utf8");
    const parsed = matter(text);
    const frontmatter = (parsed.data ?? {}) as Record<string, unknown>;
    const body = parsed.content;

    const fmTags = normaliseTags(frontmatter["tags"]);
    const file: FileProps = {
      ...fileNameParts(uri),
      size: stat.size,
      ctime: stat.ctime,
      mtime: stat.mtime,
      tags: [...new Set([...fmTags, ...scanTags(body)])],
      links: scanLinks(body),
      embeds: scanEmbeds(body),
    };

    return { file, frontmatter };
  }

  dispose(): void {
    this.watcher?.dispose();
    this._onDidChange.dispose();
  }
}

function fileNameParts(uri: vscode.Uri): Pick<
  FileProps,
  "name" | "basename" | "path" | "folder" | "ext"
> {
  const rel = vscode.workspace.asRelativePath(uri, false);
  const slash = rel.lastIndexOf("/");
  const name = slash >= 0 ? rel.slice(slash + 1) : rel;
  const folder = slash >= 0 ? rel.slice(0, slash) : "";
  const dot = name.lastIndexOf(".");
  const basename = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1) : "";
  return { name, basename, path: rel, folder, ext };
}

function normaliseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).replace(/^#/, ""));
  }
  if (typeof value === "string") {
    return value
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((v) => v.replace(/^#/, ""));
  }
  return [];
}

function getExcludeGlob(): string | null {
  const extra = vscode.workspace
    .getConfiguration("bases")
    .get<string[]>("exclude", []);
  const patterns = ["**/node_modules/**", ...extra];
  return patterns.length ? `{${patterns.join(",")}}` : null;
}
