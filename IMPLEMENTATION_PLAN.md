# VS Code Bases — Implementation Plan

A VS Code extension that brings **Obsidian Bases** to VS Code: database-like
table / cards / list views over a folder of Markdown notes, driven by `.base`
YAML files (and embedded ` ```base ` code blocks).

> This document is the spec for implementing the extension. It is written so a
> follow-up agent (or human) can pick up any milestone and know exactly what to
> build, where it lives, and how to verify it. Read the Obsidian reference docs
> in [`docs/obsidian/`](docs/obsidian/) alongside this plan — they are the
> source of truth for behaviour. The canonical worked example is
> [`examples/People.base`](examples/People.base).

---

## 1. What we are building

Obsidian Bases turns a "vault" (folder of Markdown notes with YAML frontmatter
"properties") into a queryable database. A `.base` file is YAML that declares:

- `filters` — which notes are included (global) — see `docs/obsidian/Bases syntax.md`
- `formulas` — computed properties written in the Bases expression language
- `properties` — per-property display config (e.g. `displayName`)
- `summaries` — named aggregate formulas (e.g. custom average)
- `views` — one or more table / cards / list renderings, each with their own
  `filters`, `order`, `sort`, `groupBy`, `limit`, `summaries`, and view-specific
  settings (`columnSize`, `cardSize`, `image`, etc.)

The VS Code equivalents:

| Obsidian concept            | VS Code equivalent                                            |
| --------------------------- | ------------------------------------------------------------- |
| Vault                       | The workspace folder(s)                                       |
| Note + frontmatter property | `.md` file + YAML frontmatter parsed by the indexer           |
| Opening a `.base` file      | A **Custom Editor** that renders a webview of the views       |
| Embedded base code block    | A **CodeLens / Markdown** integration (stretch goal)          |
| Editing a cell              | Webview edits write back to the note's frontmatter            |

### Scope for v1 (MVP)
- Custom editor for `*.base` files, rendering **table**, **cards**, and **list** views.
- Full vault indexing of Markdown frontmatter + file properties + tags + links.
- The Bases **expression language** (filters, formulas, summaries) with the
  documented type system and functions.
- Sort, group, limit, column display config, and summaries.
- Read-only first, then inline editing of note properties (write-back).

### Explicitly out of scope for v1 (track as stretch goals)
- Map view (Obsidian's requires a Maps plugin).
- The point-and-click filter/sort/property editor UI (we ship the raw-YAML
  editing experience first; the views render live).
- `![[File.base]]` transclusion and ` ```base ` embedded code blocks in Markdown
  preview (M8).
- Full keyboard-grid editing parity (the table shortcut matrix in
  `docs/obsidian/Table view.md`).

---

## 2. Architecture

```
.base file (YAML)  ──parse──►  BaseConfig (typed)
                                     │
Workspace .md files ──index──► VaultIndex (NoteRecord[])
                                     │
                    ┌────────────────┴───────────────────┐
                    ▼                                     ▼
            Expression engine  ◄────used by────  Query engine
         (lex → parse → eval)                 (filter→formula→
                                               sort→group→limit→summarise)
                    │                                     │
                    └─────────────► ViewModel ◄───────────┘
                                     │ postMessage
                                     ▼
                          Webview (table / cards / list)
```

### Module layout (`src/`)
```
src/
  extension.ts              # activate(): register custom editor + commands
  baseEditorProvider.ts     # CustomTextEditorProvider: ties file ⇄ index ⇄ webview

  model/
    baseSchema.ts           # Types for BaseConfig + YAML parse/serialize (js-yaml)
    propertyId.ts           # Parse/normalise property ids: note.x | file.x | formula.x

  expr/                     # The Bases expression language (the hard part)
    token.ts                # Token kinds
    lexer.ts                # string → tokens
    ast.ts                  # AST node types
    parser.ts               # Pratt parser → AST  (precedence: || && == < + * unary . [] call)
    values.ts               # Value model: Str/Num/Bool/Date/Duration/List/Obj/Link/File/Null
    evaluator.ts            # AST + EvalContext → Value
    context.ts              # EvalContext: note/file props, formulas, `this`, today()/now()
    functions/
      index.ts              # registry: name → fn, dispatched by receiver type
      global.ts             # if, date, now, today, link, list, min, max, number, image, icon, ...
      string.ts number.ts date.ts list.ts link.ts file.ts object.ts regexp.ts any.ts
    format.ts               # Value → display string / HTML for the webview

  vault/
    vaultIndex.ts           # Scans workspace, builds + caches NoteRecord[], watches changes
    noteRecord.ts           # NoteRecord: frontmatter, file props, tags, links, embeds
    frontmatter.ts          # Extract + parse YAML frontmatter (gray-matter)
    markdownScan.ts         # Inline #tags, [[wikilinks]], ![[embeds]] extraction
    writeProperty.ts        # Write a property value back into a note's frontmatter

  query/
    queryEngine.ts          # run(view): NoteRecord[] → ViewRows
    filter.ts               # Evaluate filter trees (and/or/not + string statements)
    sort.ts groupBy.ts      # Ordering + grouping
    summaries.ts            # Built-in + custom summary formulas over column values

  view/
    viewModel.ts            # Serialisable model sent to the webview
    messages.ts             # Typed postMessage protocol (extension ⇄ webview)

media/                      # Webview assets (bundled separately by esbuild)
  index.ts                  # Webview entry: receives ViewModel, renders, sends edits
  render/ table.ts cards.ts list.ts toolbar.ts
  style.css                 # Uses VS Code theme CSS variables

test/                       # vitest unit tests (engine-heavy)
```

### Key libraries
- `js-yaml` — parse/serialise `.base` and frontmatter blocks.
- `gray-matter` — split frontmatter from Markdown body.
- `esbuild` — bundle extension (node, cjs) and webview (browser, esm) separately.
- `vitest` — unit tests (the expression engine **must** be heavily tested).
- TypeScript, `@types/vscode`, `eslint`.
- No webview UI framework required for v1; vanilla TS + DOM is enough. (Optional:
  `preact` if the table grows complex — decide at M4, keep it out unless needed.)

---

## 3. The expression language (most important component)

Filters and formulas share one grammar (see `docs/obsidian/Bases syntax.md` and
`docs/obsidian/Functions.md`). Behaviour follows JavaScript semantics.

### Grammar (informal, by precedence low→high)
```
expr      := or
or        := and        ( "||" and )*
and        := equality   ( "&&" equality )*
equality  := comparison ( ("==" | "!=") comparison )*
comparison:= additive   ( ("<" | "<=" | ">" | ">=") additive )*
additive  := multiplic  ( ("+" | "-") multiplic )*
multiplic := unary      ( ("*" | "/" | "%") unary )*
unary     := ("!" | "-") unary | postfix
postfix   := primary ( "." IDENT ( "(" args ")" )?     # member / method call
                     | "[" expr "]"                      # index
                     )*
primary   := NUMBER | STRING | "true" | "false" | "null"
           | IDENT ( "(" args ")" )?                     # var or global call
           | "(" expr ")"
           | "[" args "]"                                # list literal
           | "{" pairs "}"                               # object literal
           | REGEX                                        # /pattern/flags
args      := ( expr ( "," expr )* )?
```
Notes:
- `IDENT` with no prefix resolves as a **note property** (`author` ≡ `note.author`).
- Prefixes `note.`, `file.`, `formula.`, plus `this` and global functions.
- `.method(...)` dispatches on the receiver's runtime **Value type**.
- `.field` access on dates/strings/lists/objects (e.g. `date.year`, `string.length`).
- String literals use single or double quotes; nested quoting matters inside YAML.

### Value model (`expr/values.ts`)
A tagged union with a `type` discriminator. Implement type coercion rules:
- Strings/Numbers/Booleans are primitives.
- `Date` (may or may not carry time) + `Duration`; arithmetic per
  `docs/obsidian/Bases syntax.md` "Date arithmetic" (e.g. `date + "1M"`,
  subtract two dates → milliseconds).
- `List`, `Object`, `Link`, `File`, `Null`. `Null`/missing is "empty".
- Implement `isType`, `isTruthy`, `isEmpty`, `toString` for every type.

### Functions to implement (`expr/functions/`)
Implement **every** function in `docs/obsidian/Functions.md`. Group by receiver:
- **Global**: `escapeHTML date duration file html if image icon link list max min now number today random`
- **Any**: `isTruthy isType toString`
- **Date** (+ fields `year month day hour minute second millisecond`): `date format time relative isEmpty`
- **String** (+ field `length`): `contains containsAll containsAny endsWith isEmpty lower replace repeat reverse slice split startsWith title trim`
- **Number**: `abs ceil floor isEmpty round toFixed`
- **List** (+ field `length`): `contains containsAll containsAny filter flat isEmpty join map reduce reverse slice sort unique`
  - `filter`/`map`/`reduce` take an **expression** evaluated per element with
    `value`, `index`, and (reduce) `acc` bound in scope — implement as lazy
    arguments, not eager values.
- **Link**: `asFile linksTo`
- **File** (+ fields per table): `asLink hasLink hasProperty hasTag inFolder`
- **Object**: `isEmpty keys values`
- **Regexp**: `matches`
- **Date duration formatting** via Moment-style format strings — use `dayjs`
  (with custom-parse + advanced-format plugins) or a small formatter; do NOT
  pull in full Moment.

### Tests (`test/`)
The engine is pure and must be unit-tested in isolation (no VS Code needed).
Cover: operator precedence, every function, type coercion, date arithmetic,
list lambdas (`filter/map/reduce`), null/empty handling, and the exact
expressions in `examples/People.base` (esp. `daysUntilBirthday`).

---

## 4. Vault indexing (`src/vault/`)

`NoteRecord` carries everything the engine needs for one file:
- **File properties** (`docs/obsidian/Bases syntax.md` table & `Functions.md`
  File fields): `name basename path folder ext size ctime mtime tags links embeds`.
  - `ctime`/`mtime`/`size` from `vscode.workspace.fs.stat`.
  - `tags`: frontmatter `tags` + inline `#tag` (incl. nested `#a/b`).
  - `links`: `[[wikilinks]]` in body and frontmatter. `embeds`: `![[...]]`.
- **Note properties**: parsed frontmatter (via gray-matter + js-yaml). Recognise
  `[[wikilink]]` strings in frontmatter as `Link` values (per syntax docs).

Build on activation by globbing `**/*.md` (respect `.gitignore`/`files.exclude`
and a configurable exclude). Keep an in-memory map keyed by path. Refresh
incrementally with a `FileSystemWatcher` (create/change/delete) and re-render
open base editors. Indexing must be async and not block activation.

> Performance: `file.backlinks` is documented as heavy — derive it lazily by
> inverting `file.links` only when referenced.

---

## 5. Query engine (`src/query/`)

For a given view, in order:
1. **Filter**: start from all notes, AND together the global `filters` and the
   view `filters` (per `Bases syntax.md` — global + view are concatenated with
   AND). Evaluate each filter statement/tree with the engine; keep truthy.
2. **Formulas**: lazily evaluate `formula.*` per row (memoise per row; detect
   circular references and surface a clear error).
3. **Sort**: multi-key `sort` (property + ASC/DESC), type-aware comparison.
4. **Group**: `groupBy` (single property + direction) → ordered groups.
5. **Limit**: `limit` (and the view-level results limit).
6. **Summaries**: compute built-in summaries (see table in `Bases syntax.md`)
   and custom `summaries` formulas where `values` is the column's value list;
   per-group summaries when grouped.

Output a `ViewModel` (`src/view/viewModel.ts`): resolved columns (id +
displayName from `properties`), rows of formatted cell values (+ raw value +
edit metadata so the webview can write back), groups, and summary rows.

---

## 6. Custom editor + webview (`src/baseEditorProvider.ts`, `media/`)

- Register `vscode.window.registerCustomEditorProvider` for a `viewType`
  (e.g. `bases.baseEditor`) bound to `*.base` in `package.json` `customEditors`.
- On open: parse the document, ensure the vault index is ready, build the
  `ViewModel` for the active view, `postMessage` it to the webview.
- Webview renders a **toolbar** (view switcher + result count + active view's
  settings summary) and the active view (table/cards/list). Use VS Code theme
  CSS variables for styling; set a strict CSP and use `asWebviewUri` + a nonce.
- Re-post the ViewModel when (a) the `.base` document changes, or (b) the vault
  index changes for relevant files.
- **Editing (after read-only works):** webview sends an edit message → provider
  calls `writeProperty` to update the target note's frontmatter via a
  `WorkspaceEdit`, which re-indexes and re-renders.
- Persist transient UI state (active view, row height) — start by writing view
  changes back into the `.base` YAML through `WorkspaceEdit` so it round-trips,
  matching Obsidian's behaviour of storing view state in the file.

### Message protocol (`src/view/messages.ts`)
Type both directions: `→ webview` (`setViewModel`, `setError`); `→ extension`
(`switchView`, `editCell`, `setSort`, `openNote`, `ready`). Keep it small and typed.

---

## 7. Commands & manifest (`package.json`)
- `customEditors`: `bases.baseEditor` for `{ "filenamePattern": "*.base" }`.
- Commands: `bases.createBase` (new `.base` in a folder, seed with a starter
  template), `bases.openSource` (open raw YAML in a normal text editor),
  `bases.refreshIndex`.
- Configuration: `bases.exclude` (globs), `bases.dateFormat` default, etc.
- Language contribution: associate `*.base` with YAML for raw-source editing +
  schema validation (ship a JSON Schema for the `.base` format and register it
  via `yaml.schemas` if the YAML extension is present — nice-to-have).

---

## 8. Milestones (build in this order)

| #  | Milestone                | Deliverable / "done when…"                                                                 |
| -- | ------------------------ | ------------------------------------------------------------------------------------------ |
| M0 | Scaffold                 | `npm i && npm run build` works; F5 opens a `.base` and shows parsed YAML as JSON in webview |
| M1 | Vault index              | `VaultIndex` lists every `.md` with file props + frontmatter + tags + links; watches changes |
| M2 | Expression engine        | lex/parse/eval + all functions; `test/` green incl. every `Functions.md` example           |
| M3 | Query engine             | filter + formula + sort + group + limit produce correct rows (unit-tested)                  |
| M4 | Table view (read-only)   | `examples/People.base` "Work contacts" renders correctly with display names                |
| M5 | Summaries                | "Firms" view's grouped `People` summary renders; built-in summaries work                    |
| M6 | Cards + List views       | "Allens"/"Birthdays" cards render (incl. image prop); list view renders                     |
| M7 | Editing + view switching | Toolbar switches views; editing a cell writes frontmatter and re-renders                    |
| M8 | Embeds (stretch)         | ` ```base ` code blocks + `![[file.base]]` render in Markdown preview                       |
| M9 | Polish + package         | `bases.createBase`, config, JSON schema, README, `vsce package` produces a `.vsix`          |

Each milestone should land with tests where the logic is pure (M2/M3/M5 especially).

---

## 9. Verification strategy
- **Unit**: vitest over `expr/`, `query/`, `vault/` parsing — no VS Code dependency.
- **Golden file**: assert the full `ViewModel` for each view in
  `examples/People.base` against committed snapshots (create matching sample
  `.md` notes under `examples/People/` so the views actually return rows).
- **Manual**: `F5` Extension Development Host, open `examples/People.base`, click
  through all seven views.

## 10. First steps for the implementing agent
1. `npm install` (scaffold + deps already declared in `package.json`).
2. Create `examples/People/` with ~6 sample person notes (frontmatter:
   `type, company, job title, location, birthday, email`) so the example base
   returns real rows for golden tests.
3. Start at **M2** (the expression engine) behind tests — it's the critical path
   and everything else depends on it. M0/M1 scaffolding stubs are already in
   place; flesh them out as you go.
4. Keep `docs/obsidian/` open as the behavioural source of truth.
