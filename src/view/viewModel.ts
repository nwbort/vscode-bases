// The serialisable model the extension sends to the webview to render a view.

export interface ColumnModel {
  /** Property id, e.g. "file.name" or "formula.ppu". */
  id: string;
  displayName: string;
  /** Pixel width hint from the view's columnSize, if any. */
  width?: number;
  /** Whether the webview may edit this cell (note properties only). */
  editable: boolean;
}

export type CellKind = "text" | "link" | "image" | "icon" | "checkbox" | "html" | "empty";

export interface CellPart {
  kind: CellKind;
  text?: string;
  /** Link target (for kind "link"). */
  target?: string;
  /** Image source (for kind "image"). */
  src?: string;
  /** Icon name (for kind "icon"). */
  icon?: string;
  /** Checkbox state (for kind "checkbox"). */
  checked?: boolean;
  /** Raw HTML (for kind "html"). */
  html?: string;
}

export interface CellModel {
  /** Property id this cell belongs to (for write-back editing). */
  columnId: string;
  /** One or more renderable parts (lists produce several). */
  parts: CellPart[];
  /** The raw editable string (note properties only). */
  editValue?: string;
}

export interface RowModel {
  /** Source note path, used to open the note / write properties back. */
  notePath: string;
  cells: CellModel[];
}

export interface GroupModel {
  key: string;
  rows: RowModel[];
  /** Per-group summary display strings keyed by column id. */
  summaries?: Record<string, string>;
}

export interface ViewModel {
  /** Names of all views in the base, for the toolbar switcher. */
  viewNames: string[];
  activeViewIndex: number;
  type: string; // table | cards | list | ...
  name: string;
  columns: ColumnModel[];
  /** Ungrouped rows (when no groupBy). */
  rows: RowModel[];
  /** Present when the view has a groupBy. */
  groups?: GroupModel[];
  /** Footer summaries keyed by column id. */
  summaries?: Record<string, string>;
  resultCount: number;
  /** View-specific settings passed through for the renderer (cardSize, image, ...). */
  settings: Record<string, unknown>;
  error?: string;
}
