import * as vscode from "vscode";
import { parseBase } from "./model/baseSchema";
import { parsePropertyId } from "./model/propertyId";
import { VaultIndex } from "./vault/vaultIndex";
import { writeProperty } from "./vault/writeProperty";
import { buildViewModel } from "./query/queryEngine";
import { HostMessage, WebviewMessage } from "./view/messages";

// CustomTextEditorProvider for `.base` files. Owns the webview lifecycle and
// keeps it in sync with both the document and the vault index.
export class BaseEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = "bases.baseEditor";

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly index: VaultIndex,
  ) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    let activeViewIndex = 0;

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "dist"), vscode.Uri.joinPath(this.context.extensionUri, "media")],
    };
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

    const post = (msg: HostMessage) => webviewPanel.webview.postMessage(msg);

    const render = async () => {
      await this.index.whenReady();
      try {
        const config = parseBase(document.getText());
        const model = buildViewModel(config, activeViewIndex, this.index);
        post({ type: "setViewModel", model });
      } catch (err) {
        post({ type: "setError", message: String(err) });
      }
    };

    const subscriptions: vscode.Disposable[] = [];

    subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          void render();
        }
      }),
    );
    subscriptions.push(this.index.onDidChange(() => void render()));

    webviewPanel.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      switch (msg.type) {
        case "ready":
          void render();
          break;
        case "switchView":
          activeViewIndex = msg.index;
          void render();
          break;
        case "openNote": {
          const uri = vscode.Uri.joinPath(workspaceRoot() ?? document.uri, msg.notePath);
          void vscode.window.showTextDocument(uri, { preview: true });
          break;
        }
        case "openExternal":
          void vscode.env.openExternal(vscode.Uri.parse(msg.url));
          break;
        case "editCell": {
          const id = parsePropertyId(msg.columnId);
          if (id.scope !== "note") {
            break; // only note properties are writable
          }
          const uri = vscode.Uri.joinPath(workspaceRoot() ?? document.uri, msg.notePath);
          void writeProperty(uri, id.key, msg.value).then(
            () => undefined,
            (err) => post({ type: "setError", message: `Failed to save: ${String(err)}` }),
          );
          break;
        }
        case "setSort":
          // Persisting sort into the .base view config is a future enhancement.
          break;
      }
    });

    webviewPanel.onDidDispose(() => {
      for (const s of subscriptions) {
        s.dispose();
      }
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = makeNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.js"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "style.css"),
    );
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`,
      `img-src ${webview.cspSource} https: data:`,
    ].join("; ");

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Base</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function workspaceRoot(): vscode.Uri | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri;
}

function makeNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
