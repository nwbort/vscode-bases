import { describe, it, expect } from "vitest";
import { parseExpression } from "../src/expr/parser";

// These tests pin the behaviour the expression engine must satisfy. They are
// expected to FAIL until M2 is implemented — they are the executable spec.
// Expand them with one case per function in docs/obsidian/Functions.md and the
// exact expressions used in examples/People.base.

describe.skip("expression engine (M2)", () => {
  it("parses and evaluates arithmetic with precedence", () => {
    // expect(evalSrc("1 + 2 * 3")).toBe(7);
    expect(parseExpression("1 + 2 * 3")).toBeTruthy();
  });

  it("evaluates string methods", () => {
    // expect(evalSrc('"hello".title()')).toBe("Hello");
  });

  it("evaluates list lambdas with value/index/acc", () => {
    // expect(evalSrc("[1,2,3].reduce(acc + value, 0)")).toBe(6);
  });

  it("handles date arithmetic", () => {
    // expect(evalSrc('date("2024-12-01") + "1M"')).toEqual(date 2025-01-01)
  });
});
