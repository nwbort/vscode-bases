import * as vscode from "vscode";
import matter from "gray-matter";

// Writes a single note property back into a Markdown file's YAML frontmatter
// via a WorkspaceEdit (so the change participates in undo/redo and triggers a
// re-index). The edited value is a plain string from the webview; we coerce it
// to a sensible YAML scalar (number / boolean / null / string).

export async function writeProperty(
  fileUri: vscode.Uri,
  key: string,
  rawValue: string,
): Promise<void> {
  const bytes = await vscode.workspace.fs.readFile(fileUri);
  const text = Buffer.from(bytes).toString("utf8");
  const parsed = matter(text);

  const data = { ...(parsed.data ?? {}) } as Record<string, unknown>;
  const coerced = coerceScalar(rawValue);
  if (coerced === null || coerced === "") {
    delete data[key];
  } else {
    data[key] = coerced;
  }

  const updated = matter.stringify(parsed.content, data);

  const doc = await vscode.workspace.openTextDocument(fileUri);
  const fullRange = new vscode.Range(
    doc.positionAt(0),
    doc.positionAt(doc.getText().length),
  );
  const edit = new vscode.WorkspaceEdit();
  edit.replace(fileUri, fullRange, updated);
  await vscode.workspace.applyEdit(edit);
  await doc.save();
}

function coerceScalar(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  // Numeric (but keep things like "01" or phone numbers as strings).
  if (/^-?\d+(\.\d+)?$/.test(trimmed) && !/^0\d/.test(trimmed)) {
    const n = Number(trimmed);
    if (!Number.isNaN(n)) return n;
  }
  return value;
}
