import { describe, it, expect } from "vitest";
import { parseExpression } from "../src/expr/parser";
import { evaluateSource } from "../src/expr/evaluator";
import { makeContext } from "../src/expr/context";
import { NoteRecord, FileProps } from "../src/vault/noteRecord";
import { Value, valueToString } from "../src/expr/values";

// Frozen clock: 2025-06-15 12:00 UTC for deterministic today()/now().
const NOW_MS = Date.UTC(2025, 5, 15, 12, 0, 0);

function makeNote(frontmatter: Record<string, unknown> = {}, file: Partial<FileProps> = {}): NoteRecord {
  const f: FileProps = {
    name: "Note.md",
    basename: "Note",
    path: "Note.md",
    folder: "",
    ext: "md",
    size: 100,
    ctime: Date.UTC(2024, 0, 1),
    mtime: Date.UTC(2025, 0, 1),
    tags: [],
    links: [],
    embeds: [],
    ...file,
  };
  return { file: f, frontmatter };
}

function evalSrc(
  src: string,
  frontmatter: Record<string, unknown> = {},
  notes: NoteRecord[] = [],
): Value {
  const note = makeNote(frontmatter);
  const all = [note, ...notes];
  const ctx = makeContext(note, { notes: all, formulas: {}, nowMs: NOW_MS });
  return evaluateSource(src, ctx);
}

function n(v: Value): number {
  if (v.type !== "number") throw new Error(`expected number, got ${v.type}`);
  return v.value;
}
function s(v: Value): string {
  return valueToString(v);
}
function b(v: Value): boolean {
  if (v.type !== "boolean") throw new Error(`expected boolean, got ${v.type}`);
  return v.value;
}

describe("parser", () => {
  it("parses without throwing", () => {
    expect(parseExpression("1 + 2 * 3")).toBeTruthy();
    expect(parseExpression('file.hasTag("a", "b") && note.x > 2')).toBeTruthy();
  });
});

describe("arithmetic & precedence", () => {
  it("respects multiplication over addition", () => {
    expect(n(evalSrc("1 + 2 * 3"))).toBe(7);
    expect(n(evalSrc("(1 + 2) * 3"))).toBe(9);
    expect(n(evalSrc("10 % 3"))).toBe(1);
    expect(n(evalSrc("2 - 3 - 4"))).toBe(-5);
  });

  it("handles unary minus and not", () => {
    expect(n(evalSrc("-5 + 2"))).toBe(-3);
    expect(b(evalSrc("!false"))).toBe(true);
    expect(b(evalSrc("!(1 > 2)"))).toBe(true);
  });

  it("compares and combines booleans", () => {
    expect(b(evalSrc("1 < 2 && 3 >= 3"))).toBe(true);
    expect(b(evalSrc("1 > 2 || 2 == 2"))).toBe(true);
    expect(b(evalSrc('"a" == "a"'))).toBe(true);
    expect(b(evalSrc('"a" != "b"'))).toBe(true);
  });
});

describe("string methods", () => {
  it("title/lower/contains/slice/split", () => {
    expect(s(evalSrc('"hello world".title()'))).toBe("Hello World");
    expect(s(evalSrc('"HELLO".lower()'))).toBe("hello");
    expect(b(evalSrc('"hello".contains("ell")'))).toBe(true);
    expect(b(evalSrc('"hello".startsWith("he")'))).toBe(true);
    expect(b(evalSrc('"hello".endsWith("lo")'))).toBe(true);
    expect(s(evalSrc('"hello".slice(1, 4)'))).toBe("ell");
    expect(s(evalSrc('"hello".reverse()'))).toBe("olleh");
    expect(n(evalSrc('"hello".length'))).toBe(5);
    expect(s(evalSrc('"123".repeat(2)'))).toBe("123123");
    expect(b(evalSrc('"".isEmpty()'))).toBe(true);
    expect(b(evalSrc('"hello".containsAll("h", "e")'))).toBe(true);
    expect(b(evalSrc('"hello".containsAny("x", "e")'))).toBe(true);
  });

  it("replace with string and regex", () => {
    expect(s(evalSrc('"a:b:c:d".replace(/:/, "-")'))).toBe("a-b:c:d");
    expect(s(evalSrc('"a:b:c:d".replace(/:/g, "-")'))).toBe("a-b-c-d");
    expect(s(evalSrc('"John Smith".replace(/(\\w+) (\\w+)/, "$2, $1")'))).toBe("Smith, John");
  });

  it("split returns a list", () => {
    const v = evalSrc('"a,b,c,d".split(",", 3)');
    expect(v.type).toBe("list");
    expect(s(v)).toBe("a, b, c");
  });
});

describe("number methods", () => {
  it("abs/ceil/floor/round/toFixed", () => {
    expect(n(evalSrc("(-5).abs()"))).toBe(5);
    expect(n(evalSrc("(2.1).ceil()"))).toBe(3);
    expect(n(evalSrc("(2.9).floor()"))).toBe(2);
    expect(n(evalSrc("(2.5).round()"))).toBe(3);
    expect(n(evalSrc("(2.3333).round(2)"))).toBe(2.33);
    expect(s(evalSrc("(3.14159).toFixed(2)"))).toBe("3.14");
  });
});

describe("list methods & lambdas", () => {
  it("contains/flat/unique/sort/join", () => {
    expect(b(evalSrc("[1,2,3].contains(2)"))).toBe(true);
    expect(s(evalSrc("[1,[2,3]].flat()"))).toBe("1, 2, 3");
    expect(s(evalSrc("[1,2,2,3].unique()"))).toBe("1, 2, 3");
    expect(s(evalSrc("[3,1,2].sort()"))).toBe("1, 2, 3");
    expect(s(evalSrc('[1,2,3].join("-")'))).toBe("1-2-3");
    expect(n(evalSrc("[1,2,3].length"))).toBe(3);
  });

  it("filter/map/reduce with value/index/acc", () => {
    expect(s(evalSrc("[1,2,3,4].filter(value > 2)"))).toBe("3, 4");
    expect(s(evalSrc("[1,2,3,4].map(value + 1)"))).toBe("2, 3, 4, 5");
    expect(n(evalSrc("[1,2,3].reduce(acc + value, 0)"))).toBe(6);
    expect(s(evalSrc("[10,20,30].filter(index > 0)"))).toBe("20, 30");
  });

  it("reduce max with null seed", () => {
    expect(n(evalSrc("[3,1,4,1,5].reduce(if(acc == null || value > acc, value, acc), null)"))).toBe(5);
  });
});

describe("any methods", () => {
  it("isType / isTruthy / toString", () => {
    expect(b(evalSrc('"x".isType("string")'))).toBe(true);
    expect(b(evalSrc("true.isType(\"boolean\")"))).toBe(true);
    expect(b(evalSrc("1.isTruthy()"))).toBe(true);
    expect(s(evalSrc("(123).toString()"))).toBe("123");
  });
});

describe("date arithmetic", () => {
  it("constructs and formats dates", () => {
    expect(s(evalSrc('date("2025-05-27").format("YYYY-MM-DD")'))).toBe("2025-05-27");
    expect(n(evalSrc('date("2024-12-01").month'))).toBe(12);
    expect(n(evalSrc('date("2024-12-01").year'))).toBe(2024);
    expect(n(evalSrc('date("2024-12-01").day'))).toBe(1);
  });

  it("adds and subtracts durations", () => {
    expect(s(evalSrc('(date("2024-12-01") + "1M").format("YYYY-MM-DD")'))).toBe("2025-01-01");
    expect(s(evalSrc('(date("2024-12-01") + "1M" + "4h" + "3m").format("YYYY-MM-DD HH:mm:ss")')))
      .toBe("2025-01-01 04:03:00");
    expect(s(evalSrc('(date("2025-01-10") - "7d").format("YYYY-MM-DD")'))).toBe("2025-01-03");
  });

  it("subtracts two dates to a duration", () => {
    expect(n(evalSrc('(date("2025-01-02") - date("2025-01-01")).days'))).toBe(1);
    const dur = evalSrc('date("2025-01-02") - date("2025-01-01")');
    expect(dur.type).toBe("duration");
    expect(n(evalSrc('number(date("2025-01-02") - date("2025-01-01"))'))).toBe(86400000);
  });

  it("today() is frozen midnight", () => {
    expect(s(evalSrc("today().format(\"YYYY-MM-DD\")"))).toBe("2025-06-15");
    expect(n(evalSrc("today().year"))).toBe(2025);
  });
});

describe("note & file properties", () => {
  it("resolves bare and prefixed note properties", () => {
    expect(s(evalSrc("type", { type: "work" }))).toBe("work");
    expect(s(evalSrc("note.company", { company: "Allens" }))).toBe("Allens");
    expect(b(evalSrc('type == "work"', { type: "work" }))).toBe(true);
  });

  it("file fields and methods", () => {
    const fm = {};
    const note = makeNote(fm, { folder: "People", tags: ["work/au"], name: "Alice.md", basename: "Alice" });
    const ctx = makeContext(note, { notes: [note], formulas: {}, nowMs: NOW_MS });
    expect(s(evaluateSource("file.name", ctx))).toBe("Alice.md");
    expect(b(evaluateSource('file.inFolder("People")', ctx))).toBe(true);
    expect(b(evaluateSource('file.hasTag("work")', ctx))).toBe(true);
  });

  it("recognises frontmatter wikilinks as links", () => {
    const v = evalSrc("note.company", { company: "[[Allens]]" });
    expect(v.type).toBe("link");
  });
});

describe("formulas & summaries expressions", () => {
  it("evaluates a formula referencing note props", () => {
    const note = makeNote({ price: 10, age: 2 });
    const ctx = makeContext(note, {
      notes: [note],
      formulas: { ppu: "(price / age).toFixed(2)" },
      nowMs: NOW_MS,
    });
    expect(s(evaluateSource("formula.ppu", ctx))).toBe("5.00");
  });

  it("detects circular formula references", () => {
    const note = makeNote({});
    const ctx = makeContext(note, {
      notes: [note],
      formulas: { a: "formula.b", b: "formula.a" },
      nowMs: NOW_MS,
    });
    expect(() => evaluateSource("formula.a", ctx)).toThrow(/[Cc]ircular/);
  });

  it("People summary expression counts non-null", () => {
    expect(n(evalSrc('values.filter(!value.isType("null")).length', { values: ["a", null, "b"] }))).toBe(2);
  });

  it("daysUntilBirthday formula returns a number in range", () => {
    const note = makeNote({ birthday: new Date(Date.UTC(1990, 6, 1)) });
    const ctx = makeContext(note, {
      notes: [note],
      formulas: {
        daysUntilBirthday:
          '(if(date(today().year + "-" + if(note.birthday.month > 10, "" + note.birthday.month, "0" + note.birthday.month) + "-" + note.birthday.day) < today(), date(today().year + 1 + "-" + if(note.birthday.month > 10, "" + note.birthday.month, "0" + note.birthday.month) + "-" + note.birthday.day), date(today().year + "-" + if(note.birthday.month > 10, "" + note.birthday.month, "0" + note.birthday.month) + "-" + note.birthday.day)) - today()).days',
      },
      nowMs: NOW_MS,
    });
    const v = evaluateSource("formula.daysUntilBirthday", ctx);
    expect(v.type).toBe("number");
    const days = n(v);
    expect(days).toBeGreaterThanOrEqual(0);
    expect(days).toBeLessThanOrEqual(366);
    // 2025-06-15 -> next 07-01 is 16 days away.
    expect(days).toBe(16);
  });
});
