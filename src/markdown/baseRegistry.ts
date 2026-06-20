import * as vscode from "vscode";

// Tracks the `.base` files in the workspace so the Markdown preview can resolve
// `![[Some.base]]` embeds synchronously (the markdown-it render pass cannot
// await). Built on activation and kept fresh with a file watcher.
export class BaseFileRegistry implements vscode.Disposable {
  private byPath = new Map<string, string>(); // relative path -> fsPath
  private byBasename = new Map<string, string>(); // basename -> fsPath
  private watcher?: vscode.FileSystemWatcher;

  constructor() {
    void this.rebuild();
    this.watcher = vscode.workspace.createFileSystemWatcher("**/*.base");
    this.watcher.onDidCreate((uri) => this.add(uri));
    this.watcher.onDidChange((uri) => this.add(uri));
    this.watcher.onDidDelete((uri) => this.remove(uri));
  }

  async rebuild(): Promise<void> {
    this.byPath.clear();
    this.byBasename.clear();
    const uris = await vscode.workspace.findFiles("**/*.base", "**/node_modules/**");
    for (const uri of uris) {
      this.add(uri);
    }
  }

  /** Resolve an embed target (e.g. "People.base", "dir/People", "People") to a path. */
  resolve(target: string): string | undefined {
    const clean = target.replace(/#.*$/, "").trim();
    const withExt = clean.toLowerCase().endsWith(".base") ? clean : `${clean}.base`;
    const base = withExt.replace(/\.base$/i, "");
    return (
      this.byPath.get(withExt) ??
      this.byBasename.get(base) ??
      this.byBasename.get(clean)
    );
  }

  private add(uri: vscode.Uri): void {
    const rel = vscode.workspace.asRelativePath(uri, false);
    this.byPath.set(rel, uri.fsPath);
    const name = rel.slice(rel.lastIndexOf("/") + 1);
    const basename = name.replace(/\.base$/i, "");
    if (!this.byBasename.has(basename)) {
      this.byBasename.set(basename, uri.fsPath);
    }
  }

  private remove(uri: vscode.Uri): void {
    const rel = vscode.workspace.asRelativePath(uri, false);
    this.byPath.delete(rel);
    const name = rel.slice(rel.lastIndexOf("/") + 1);
    this.byBasename.delete(name.replace(/\.base$/i, ""));
  }

  dispose(): void {
    this.watcher?.dispose();
  }
}
