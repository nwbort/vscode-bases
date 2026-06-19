import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { parseBase } from "../src/model/baseSchema";
import { buildViewModel } from "../src/query/queryEngine";
import { NoteRecord, FileProps } from "../src/vault/noteRecord";
import { scanTags, scanLinks, scanEmbeds } from "../src/vault/markdownScan";
import { CellModel } from "../src/view/viewModel";

const ROOT = path.resolve(__dirname, "..");
const PEOPLE_DIR = path.join(ROOT, "examples", "People");

function loadNote(relPath: string): NoteRecord {
  const abs = path.join(ROOT, relPath);
  const text = fs.readFileSync(abs, "utf8");
  const parsed = matter(text);
  const frontmatter = (parsed.data ?? {}) as Record<string, unknown>;
  const body = parsed.content;
  const stat = fs.statSync(abs);
  const name = path.basename(relPath);
  const dot = name.lastIndexOf(".");
  const basename = dot > 0 ? name.slice(0, dot) : name;
  const folder = path.dirname(relPath).replace(/\\/g, "/");
  const fmTags = Array.isArray(frontmatter.tags)
    ? frontmatter.tags.map((t) => String(t).replace(/^#/, ""))
    : [];
  const file: FileProps = {
    name,
    basename,
    path: relPath.replace(/\\/g, "/"),
    folder: folder === "." ? "" : folder,
    ext: dot > 0 ? name.slice(dot + 1) : "",
    size: stat.size,
    ctime: stat.ctimeMs,
    mtime: stat.mtimeMs,
    tags: [...new Set([...fmTags, ...scanTags(body)])],
    links: scanLinks(body),
    embeds: scanEmbeds(body),
  };
  return { file, frontmatter };
}

function loadPeople(): NoteRecord[] {
  return fs
    .readdirSync(PEOPLE_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => loadNote(path.join("examples", "People", f)));
}

function index(notes: NoteRecord[]) {
  return { all: () => notes };
}

const config = parseBase(fs.readFileSync(path.join(ROOT, "examples", "People.base"), "utf8"));
const people = loadPeople();

function cellText(cell: CellModel): string {
  return cell.parts
    .map((p) => p.text ?? p.target ?? p.src ?? p.icon ?? (p.checked ? "true" : ""))
    .join(", ");
}

function viewByName(name: string): number {
  return config.views.findIndex((v) => v.name === name);
}

describe("query engine over examples/People.base", () => {
  it("Work contacts: only type==work, sorted by company then name", () => {
    const vm = buildViewModel(config, viewByName("Work contacts"), index(people));
    expect(vm.error).toBeUndefined();
    const names = vm.rows.map((r) => cellText(r.cells[0]));
    // 5 work people (everyone except Eve who is a friend).
    expect(vm.resultCount).toBe(5);
    // Sorted by company ASC (Allens before HoustonKemp), then file.name ASC.
    expect(names).toEqual([
      "Alice Smith",
      "Bob Jones",
      "Frank Green",
      "Carol White",
      "Dave Brown",
    ]);
  });

  it("uses configured display names for columns", () => {
    const vm = buildViewModel(config, viewByName("Work contacts"), index(people));
    expect(vm.columns[0].displayName).toBe("Name");
    expect(vm.columns[1].displayName).toBe("Company");
  });

  it("Personal contacts: type != work", () => {
    const vm = buildViewModel(config, viewByName("Personal contacts"), index(people));
    const names = vm.rows.map((r) => cellText(r.cells[0]));
    expect(names).toEqual(["Eve Black"]);
  });

  it("Allens cards: company == Allens", () => {
    const vm = buildViewModel(config, viewByName("Allens"), index(people));
    expect(vm.type).toBe("cards");
    const names = vm.rows.map((r) => cellText(r.cells[0])).sort();
    expect(names).toEqual(["Alice Smith", "Bob Jones", "Frank Green"]);
  });

  it("HK: type==work AND company==HoustonKemp", () => {
    const vm = buildViewModel(config, viewByName("HK"), index(people));
    const names = vm.rows.map((r) => cellText(r.cells[0])).sort();
    expect(names).toEqual(["Carol White", "Dave Brown"]);
  });

  it("Work Melbourne: location==Melbourne AND type==work, sorted by company", () => {
    const vm = buildViewModel(config, viewByName("Work Melbourne"), index(people));
    const names = vm.rows.map((r) => cellText(r.cells[0]));
    expect(names).toEqual(["Bob Jones", "Frank Green", "Dave Brown"]);
  });

  it("Firms: grouped by company with a People summary count", () => {
    const vm = buildViewModel(config, viewByName("Firms"), index(people));
    expect(vm.groups).toBeDefined();
    const groups = vm.groups ?? [];
    const allens = groups.find((g) => g.key === "Allens");
    const hk = groups.find((g) => g.key === "HoustonKemp");
    expect(allens?.rows.length).toBe(3);
    expect(hk?.rows.length).toBe(2);
    // The People summary counts non-null file.name values per group.
    expect(allens?.summaries?.["file.name"]).toBe("3");
    expect(hk?.summaries?.["file.name"]).toBe("2");
  });

  it("Birthdays: sorted by formula.daysUntilBirthday", () => {
    const vm = buildViewModel(config, viewByName("Birthdays"), index(people));
    // Everyone has a birthday, so all 6 appear.
    expect(vm.resultCount).toBe(6);
  });
});
