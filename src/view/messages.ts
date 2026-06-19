import { ViewModel } from "./viewModel";

// Typed postMessage protocol between the extension host and the webview.

/** Extension -> Webview */
export type HostMessage =
  | { type: "setViewModel"; model: ViewModel }
  | { type: "setError"; message: string };

/** Webview -> Extension */
export type WebviewMessage =
  | { type: "ready" }
  | { type: "switchView"; index: number }
  | { type: "openNote"; notePath: string }
  | { type: "editCell"; notePath: string; columnId: string; value: string }
  | { type: "setSort"; columnId: string; direction: "ASC" | "DESC" };
