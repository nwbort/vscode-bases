import * as vscode from "vscode";
import { BaseEditorProvider } from "./baseEditorProvider";
import { VaultIndex } from "./vault/vaultIndex";

export function activate(context: vscode.ExtensionContext): void {
  const index = new VaultIndex();
  context.subscriptions.push(index);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      BaseEditorProvider.viewType,
      new BaseEditorProvider(context, index),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("bases.refreshIndex", () => index.rebuild()),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("bases.openSource", async () => {
      const uri = vscode.window.activeTextEditor?.document.uri;
      if (uri) {
        await vscode.commands.executeCommand(
          "vscode.openWith",
          uri,
          "default",
        );
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("bases.createBase", () =>
      createBase(context),
    ),
  );
}

export function deactivate(): void {
  // Disposables are cleaned up via context.subscriptions.
}

const STARTER_BASE = `views:
  - type: table
    name: Table
    order:
      - file.name
`;

async function createBase(_context: vscode.ExtensionContext): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    void vscode.window.showErrorMessage("Open a folder to create a base.");
    return;
  }
  const name = await vscode.window.showInputBox({
    prompt: "Base file name",
    value: "Untitled.base",
  });
  if (!name) {
    return;
  }
  const uri = vscode.Uri.joinPath(folder.uri, name);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(STARTER_BASE, "utf8"));
  await vscode.commands.executeCommand(
    "vscode.openWith",
    uri,
    BaseEditorProvider.viewType,
  );
}
