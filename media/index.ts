import type { HostMessage, WebviewMessage } from "../src/view/messages";
import type { ViewModel } from "../src/view/viewModel";
import { renderTable } from "./render/table";

// Webview entry point. Receives a ViewModel from the extension and renders the
// active view. M0 ships a working table renderer; cards/list are M6.

interface VsCodeApi {
  postMessage(msg: WebviewMessage): void;
}
declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();
const app = document.getElementById("app")!;

function post(msg: WebviewMessage) {
  vscode.postMessage(msg);
}

window.addEventListener("message", (event: MessageEvent<HostMessage>) => {
  const msg = event.data;
  if (msg.type === "setError") {
    app.innerHTML = "";
    const pre = document.createElement("pre");
    pre.className = "error";
    pre.textContent = msg.message;
    app.appendChild(pre);
    return;
  }
  if (msg.type === "setViewModel") {
    render(msg.model);
  }
});

function render(model: ViewModel) {
  app.innerHTML = "";
  app.appendChild(renderToolbar(model));

  if (model.error) {
    const pre = document.createElement("pre");
    pre.className = "error";
    pre.textContent = model.error;
    app.appendChild(pre);
    return;
  }

  switch (model.type) {
    case "table":
      app.appendChild(renderTable(model, post));
      break;
    // TODO(M6): case "cards": renderCards; case "list": renderList.
    default:
      app.appendChild(placeholder(`View type "${model.type}" not yet implemented.`));
  }
}

function renderToolbar(model: ViewModel): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "toolbar";

  const tabs = document.createElement("div");
  tabs.className = "view-tabs";
  model.viewNames.forEach((name, i) => {
    const tab = document.createElement("button");
    tab.className = "view-tab" + (i === model.activeViewIndex ? " active" : "");
    tab.textContent = name;
    tab.addEventListener("click", () => post({ type: "switchView", index: i }));
    tabs.appendChild(tab);
  });
  bar.appendChild(tabs);

  const count = document.createElement("span");
  count.className = "result-count";
  count.textContent = `${model.resultCount} result${model.resultCount === 1 ? "" : "s"}`;
  bar.appendChild(count);

  return bar;
}

function placeholder(text: string): HTMLElement {
  const div = document.createElement("div");
  div.className = "placeholder";
  div.textContent = text;
  return div;
}

// Tell the extension we're ready to receive the first ViewModel.
post({ type: "ready" });
