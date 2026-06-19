import * as yaml from "js-yaml";

// Typed representation of a `.base` file. See docs/obsidian/Bases syntax.md.

/** A filter is either a single statement string or a recursive and/or/not group. */
export type Filter = string | FilterGroup;
export interface FilterGroup {
  and?: Filter[];
  or?: Filter[];
  not?: Filter[];
}

export interface SortSpec {
  property: string;
  direction: "ASC" | "DESC";
}

export interface GroupBy {
  property: string;
  direction: "ASC" | "DESC";
}

export interface PropertyConfig {
  displayName?: string;
  // Views may store additional per-property config here.
  [key: string]: unknown;
}

export type ViewType = "table" | "cards" | "list" | string;

export interface ViewConfig {
  type: ViewType;
  name?: string;
  limit?: number;
  filters?: Filter;
  /** Property ids, in display order. */
  order?: string[];
  sort?: SortSpec[];
  groupBy?: GroupBy;
  /** property id -> summary name */
  summaries?: Record<string, string>;
  // View-specific extras (columnSize, cardSize, image, rowHeight, ...).
  [key: string]: unknown;
}

export interface BaseConfig {
  filters?: Filter;
  /** name -> formula expression string */
  formulas?: Record<string, string>;
  /** property id -> config */
  properties?: Record<string, PropertyConfig>;
  /** name -> summary expression string */
  summaries?: Record<string, string>;
  views: ViewConfig[];
}

/** Parse the YAML text of a `.base` file into a BaseConfig. Throws on invalid YAML. */
export function parseBase(text: string): BaseConfig {
  const raw = (yaml.load(text) ?? {}) as Partial<BaseConfig>;
  return {
    filters: raw.filters,
    formulas: raw.formulas ?? {},
    properties: raw.properties ?? {},
    summaries: raw.summaries ?? {},
    views: Array.isArray(raw.views) ? raw.views : [],
  };
}

/** Serialise a BaseConfig back to YAML text (used when the UI mutates view state). */
export function serializeBase(config: BaseConfig): string {
  return yaml.dump(config, { lineWidth: -1, quotingType: '"' });
}
