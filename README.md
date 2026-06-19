# Bases for VS Code

A VS Code extension that brings **Obsidian Bases** to VS Code — database-like
**table**, **cards**, and **list** views over a folder of Markdown notes,
driven by Obsidian-compatible `.base` files.

> **Status: scaffold.** The project structure, build, custom editor, vault
> indexer, and a working table renderer are in place. The expression engine and
> query pipeline (the parts that turn `.base` files into rows) are stubbed with
> a detailed spec. See **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)** for
> the full plan and milestones.

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

## What works today (M0/M1)

- Custom editor registered for `*.base`; opens a themed webview with a view
  switcher toolbar and a table renderer.
- Workspace Markdown indexer with file properties, frontmatter, tags, links.

## Next up

The expression engine (`src/expr/`) is the critical path — everything depends on
it. See **IMPLEMENTATION_PLAN.md §3** and `test/expr.test.ts`.
