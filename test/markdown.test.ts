import { describe, it, expect } from "vitest";
import { formatCellParts, formatPlain } from "../src/view/formatCell";
import { dateVal } from "../src/expr/values";
import { renderViewModelHtml } from "../src/markdown/renderHtml";
import { ViewModel } from "../src/view/viewModel";

describe("date formatting honours the configured pattern", () => {
  const d = dateVal(Date.UTC(2024, 0, 9), false); // 2024-01-09

  it("defaults to YYYY-MM-DD", () => {
    expect(formatCellParts(d)[0].text).toBe("2024-01-09");
    expect(formatPlain(d)).toBe("2024-01-09");
  });

  it("applies a custom date format", () => {
    expect(formatCellParts(d, { dateFormat: "DD/MM/YYYY" })[0].text).toBe("09/01/2024");
    expect(formatPlain(d, { dateFormat: "MMM D, YYYY" })).toBe("Jan 9, 2024");
  });

  it("appends a time component for datetime values", () => {
    const dt = dateVal(Date.UTC(2024, 0, 9, 13, 5, 0), true);
    expect(formatCellParts(dt, { dateFormat: "DD/MM/YYYY" })[0].text).toBe("09/01/2024 13:05:00");
  });
});

describe("renderViewModelHtml (Markdown preview embeds)", () => {
  const model: ViewModel = {
    viewNames: ["Table"],
    activeViewIndex: 0,
    type: "table",
    name: "Table",
    columns: [
      { id: "file.name", displayName: "Name", editable: false },
      { id: "note.role", displayName: "Role", editable: true },
    ],
    rows: [
      {
        notePath: "a.md",
        cells: [
          { columnId: "file.name", parts: [{ kind: "link", text: "Alice", target: "a.md" }] },
          { columnId: "note.role", parts: [{ kind: "text", text: "<dev>" }] },
        ],
      },
    ],
    resultCount: 1,
    settings: {},
  };

  it("renders a table with the header and rows", () => {
    const html = renderViewModelHtml(model);
    expect(html).toContain("base-table");
    expect(html).toContain("<th>Name</th>");
    expect(html).toContain("Alice");
    expect(html).toContain("1 result");
  });

  it("escapes cell content", () => {
    const html = renderViewModelHtml(model);
    expect(html).toContain("&lt;dev&gt;");
    expect(html).not.toContain("<dev>");
  });

  it("shows an empty state when there are no rows", () => {
    const empty: ViewModel = { ...model, rows: [], resultCount: 0 };
    expect(renderViewModelHtml(empty)).toContain("No results.");
  });

  it("surfaces errors", () => {
    const errored: ViewModel = { ...model, error: "boom" };
    expect(renderViewModelHtml(errored)).toContain("base-embed-error");
  });
});
