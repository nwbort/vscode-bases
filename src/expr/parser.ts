import { Node } from "./ast";

// Pratt parser for the Bases expression grammar (see IMPLEMENTATION_PLAN.md §3).
//
// TODO(M2): implement the lexer (token.ts/lexer.ts) and this parser.
// Precedence (low→high): || , && , == != , < <= > >= , + - , * / % ,
// unary ! - , postfix . [] call , primary.
//
// A small LRU/Map cache keyed by source string is worthwhile since the same
// formula/filter strings are parsed once per render.

const cache = new Map<string, Node>();

export function parseExpression(source: string): Node {
  const cached = cache.get(source);
  if (cached) {
    return cached;
  }
  const node = parseFresh(source);
  cache.set(source, node);
  return node;
}

function parseFresh(_source: string): Node {
  throw new Error("expr/parser: not implemented (M2). See IMPLEMENTATION_PLAN.md §3.");
}
