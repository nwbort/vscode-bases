import * as fs from "fs";
import { NoteRecord } from "../vault/noteRecord";
import { parseBase } from "../model/baseSchema";
import { buildViewModel } from "../query/queryEngine";
import { renderViewModelHtml, escapeHtml } from "./renderHtml";
import { Value } from "../expr/values";

// Renders embedded bases in the built-in Markdown preview, both as fenced
// ```base code blocks and as ![[File.base]] embeds. Registered via the
// extension's `extendMarkdownIt` export (see extension.ts + package.json's
// markdown.markdownItPlugins contribution).
//
// The markdown-it render pass is synchronous, so this relies on the vault index
// and base registry already being populated (they build on activation).

export interface MarkdownDeps {
  /** Current indexed notes (the dataset embedded bases query against). */
  getNotes(): NoteRecord[];
  /** Resolve a `![[X.base]]` target to an absolute file path, if known. */
  resolveBaseFile(target: string): string | undefined;
  /** The configured default date format (bases.dateFormat). */
  dateFormat(): string;
  /** Convert an absolute fsPath to a workspace-relative path (for `this` context). */
  relPath(fsPath: string): string;
}

// markdown-it isn't a dependency of this extension; it's provided by the
// Markdown preview at runtime and passed to extendMarkdownIt. Keep it untyped.
type MarkdownIt = any;

export function extendMarkdownIt(md: MarkdownIt, deps: MarkdownDeps): MarkdownIt {
  patchFence(md, deps);
  addEmbedRule(md, deps);
  return md;
}

function thisFromEnv(env: any, deps: MarkdownDeps): Value | undefined {
  const fsPath = env?.document?.uri?.fsPath as string | undefined;
  if (!fsPath) return undefined;
  return { type: "file", path: deps.relPath(fsPath) };
}

function patchFence(md: MarkdownIt, deps: MarkdownDeps): void {
  const fallback =
    md.renderer.rules.fence ??
    ((tokens: any, idx: number, options: any, _env: any, self: any) =>
      self.renderToken(tokens, idx, options));

  md.renderer.rules.fence = (tokens: any, idx: number, options: any, env: any, self: any) => {
    const token = tokens[idx];
    if ((token.info || "").trim().toLowerCase() === "base") {
      return renderBaseSource(token.content, deps, thisFromEnv(env, deps));
    }
    return fallback(tokens, idx, options, env, self);
  };
}

const EMBED_RE = /^!\[\[\s*([^[\]]+?\.base)(?:#[^[\]]*)?\s*\]\]$/i;

function addEmbedRule(md: MarkdownIt, deps: MarkdownDeps): void {
  md.block.ruler.before(
    "fence",
    "base_embed",
    (state: any, startLine: number, _endLine: number, silent: boolean) => {
      const start = state.bMarks[startLine] + state.tShift[startLine];
      const max = state.eMarks[startLine];
      const line = state.src.slice(start, max).trim();
      const m = EMBED_RE.exec(line);
      if (!m) {
        return false;
      }
      if (silent) {
        return true;
      }
      const token = state.push("html_block", "", 0);
      token.map = [startLine, startLine + 1];
      token.content = renderBaseEmbed(m[1], deps, thisFromEnv(state.env, deps));
      state.line = startLine + 1;
      return true;
    },
  );
}

function renderBaseEmbed(target: string, deps: MarkdownDeps, thisValue?: Value): string {
  const fsPath = deps.resolveBaseFile(target);
  if (!fsPath) {
    return errorHtml(`Base not found: ${target}`);
  }
  let source: string;
  try {
    source = fs.readFileSync(fsPath, "utf8");
  } catch (err) {
    return errorHtml(`Could not read ${target}: ${String(err)}`);
  }
  return renderBaseSource(source, deps, thisValue);
}

function renderBaseSource(source: string, deps: MarkdownDeps, thisValue?: Value): string {
  let config;
  try {
    config = parseBase(source);
  } catch (err) {
    return errorHtml(`Invalid base: ${String(err)}`);
  }
  const dataSource = { all: () => deps.getNotes() };
  const model = buildViewModel(config, 0, dataSource, { dateFormat: deps.dateFormat(), thisValue });
  return renderViewModelHtml(model);
}

function errorHtml(message: string): string {
  return `<div class="base-embed base-embed-error">${escapeHtml(message)}</div>`;
}
