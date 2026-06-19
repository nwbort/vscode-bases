# Bases for VS Code

A VS Code extension that brings **Obsidian Bases** to VS Code — database-like
**table**, **cards**, and **list** views over a folder of Markdown notes,
driven by Obsidian-compatible `.base` files.

> **Status: functional MVP.** The expression engine, query pipeline, and the
> table / cards / list renderers are implemented and tested against the
> `examples/People.base` worked example. Inline editing of note properties
> writes back to frontmatter. See
> **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)** for the full plan.

## Repo layout

| Path                       | What it is                                                      |
| -------------------------- | -------------------------------------------------------------- |
| `IMPLEMENTATION_PLAN.md`   | The spec / build plan. **Start here.**                         |
| `docs/obsidian/`           | Obsidian's Bases reference docs (behavioural source of truth). |
| `examples/People.base`     | A real, non-trivial example base used for golden tests.        |
| `src/`                     | Extension host code (editor, indexer, engine, query).          |
| `media/`                   | Webview UI (table/cards/list renderers).                       |
| `test/`                    | vitest unit tests for the pure engine code.                    |

## Develop

```bash
npm install
npm run build       # bundles dist/extension.js and dist/webview.js
npm run watch       # rebuild on change
npm test            # vitest
npm run typecheck   # tsc --noEmit
```

Press <kbd>F5</kbd> in VS Code to launch an Extension Development Host. It opens
the `examples/` folder; open `examples/People.base` to see the custom editor.

## What works today

- **Custom editor** for `*.base` with a view-switcher toolbar and result count.
- **Workspace Markdown indexer** — file properties, frontmatter, tags, links;
  refreshes on change via a file watcher.
- **Expression engine** (`src/expr/`) — lexer, Pratt parser, and evaluator
  implementing the Bases value model, operator precedence, date/duration
  arithmetic, list lambdas (`filter`/`map`/`reduce`), and the full
  `docs/obsidian/Functions.md` function set.
- **Query pipeline** (`src/query/`) — global + view filters, formulas (lazy,
  cycle-detected), multi-key sort, group-by, limit, and built-in + custom
  summaries.
- **Renderers** (`media/`) — table (with grouping, column widths, summary
  rows), cards (with cover images), and list views.
- **Inline editing** — double-click a note-property cell to write the value
  back into the note's YAML frontmatter.

## Tested

`test/expr.test.ts` covers the engine (precedence, every function group, date
arithmetic, list lambdas, formulas). `test/query.test.ts` asserts the rows,
sort order, grouping, and summaries for each view in `examples/People.base`
against the sample notes in `examples/People/`.

## Not yet implemented

Embedded ` ```base ` code blocks and `![[file.base]]` transclusion in Markdown
preview (M8), the point-and-click filter/sort editor UI, map view, and
persisting UI-driven sort changes back into the `.base` file.
