# Embedded bases

Open this file's **Markdown preview** (`Ctrl+Shift+V` / `Cmd+Shift+V`) to see
bases rendered inline.

## Transclude an existing base

The whole `People.base` (its first view) embedded by reference:

![[People.base]]

## Inline base

A `base` code block is parsed and rendered the same way:

```base
views:
  - type: table
    name: Allens
    filters:
      and:
        - 'company == "Allens"'
    order:
      - file.name
      - location
    sort:
      - property: file.name
        direction: ASC
```
