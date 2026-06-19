// The serialisable model the extension sends to the webview to render a view.

export interface ColumnModel {
  /** Property id, e.g. "file.name" or "formula.ppu". */
  id: string;
  displayName: string;
}

export interface CellModel {
  /** Display string. (M4+: extend with structured kind for links/images/etc.) */
  text: string;
  /** Property id this cell belongs to (for write-back editing). */
  columnId: string;
}

export interface RowModel {
  /** Source note path, used to open the note / write properties back. */
  notePath: string;
  cells: CellModel[];
}

export interface GroupModel {
  key: string;
  rows: RowModel[];
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
