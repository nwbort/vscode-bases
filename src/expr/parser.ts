import { Node } from "./ast";
import { Token } from "./token";
import { tokenize } from "./lexer";

// Pratt-style recursive descent parser for the Bases expression grammar
// (see IMPLEMENTATION_PLAN.md §3). Precedence, low → high:
//   || , && , == != , < <= > >= , + - , * / % , unary ! - ,
//   postfix . [] call , primary.
//
// Parsed nodes are cached by source string since the same formula/filter
// strings are parsed once per render.

const cache = new Map<string, Node>();

export function parseExpression(source: string): Node {
  const cached = cache.get(source);
  if (cached) {
    return cached;
  }
  const node = new Parser(tokenize(source)).parseProgram();
  cache.set(source, node);
  return node;
}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private next(): Token {
    return this.tokens[this.pos++];
  }

  private isOp(value: string): boolean {
    const t = this.peek();
    return t.type === "op" && t.value === value;
  }

  private eatOp(value: string): boolean {
    if (this.isOp(value)) {
      this.pos++;
      return true;
    }
    return false;
  }

  private expectOp(value: string): void {
    if (!this.eatOp(value)) {
      const t = this.peek();
      throw new Error(`Expected '${value}' but found '${t.value || t.type}' at position ${t.pos}`);
    }
  }

  parseProgram(): Node {
    const node = this.parseOr();
    const t = this.peek();
    if (t.type !== "eof") {
      throw new Error(`Unexpected '${t.value || t.type}' at position ${t.pos}`);
    }
    return node;
  }

  private parseOr(): Node {
    let left = this.parseAnd();
    while (this.isOp("||")) {
      this.next();
      const right = this.parseAnd();
      left = { kind: "binary", op: "||", left, right };
    }
    return left;
  }

  private parseAnd(): Node {
    let left = this.parseEquality();
    while (this.isOp("&&")) {
      this.next();
      const right = this.parseEquality();
      left = { kind: "binary", op: "&&", left, right };
    }
    return left;
  }

  private parseEquality(): Node {
    let left = this.parseComparison();
    while (this.isOp("==") || this.isOp("!=")) {
      const op = this.next().value as "==" | "!=";
      const right = this.parseComparison();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseComparison(): Node {
    let left = this.parseAdditive();
    while (this.isOp("<") || this.isOp("<=") || this.isOp(">") || this.isOp(">=")) {
      const op = this.next().value as "<" | "<=" | ">" | ">=";
      const right = this.parseAdditive();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseAdditive(): Node {
    let left = this.parseMultiplicative();
    while (this.isOp("+") || this.isOp("-")) {
      const op = this.next().value as "+" | "-";
      const right = this.parseMultiplicative();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseMultiplicative(): Node {
    let left = this.parseUnary();
    while (this.isOp("*") || this.isOp("/") || this.isOp("%")) {
      const op = this.next().value as "*" | "/" | "%";
      const right = this.parseUnary();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseUnary(): Node {
    if (this.isOp("!") || this.isOp("-")) {
      const op = this.next().value as "!" | "-";
      const operand = this.parseUnary();
      return { kind: "unary", op, operand };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Node {
    let node = this.parsePrimary();
    for (;;) {
      if (this.eatOp(".")) {
        const t = this.next();
        if (t.type !== "ident") {
          throw new Error(`Expected property name after '.' at position ${t.pos}`);
        }
        if (this.isOp("(")) {
          const args = this.parseArgs();
          node = { kind: "call", callee: { kind: "member", object: node, property: t.value }, args };
        } else {
          node = { kind: "member", object: node, property: t.value };
        }
      } else if (this.eatOp("[")) {
        const index = this.parseOr();
        this.expectOp("]");
        node = { kind: "index", object: node, index };
      } else {
        break;
      }
    }
    return node;
  }

  private parseArgs(): Node[] {
    this.expectOp("(");
    const args: Node[] = [];
    if (!this.isOp(")")) {
      args.push(this.parseOr());
      while (this.eatOp(",")) {
        // tolerate trailing comma
        if (this.isOp(")")) break;
        args.push(this.parseOr());
      }
    }
    this.expectOp(")");
    return args;
  }

  private parsePrimary(): Node {
    const t = this.peek();

    switch (t.type) {
      case "number":
        this.next();
        return { kind: "number", value: t.num ?? Number(t.value) };
      case "string":
        this.next();
        return { kind: "string", value: t.str ?? t.value };
      case "true":
        this.next();
        return { kind: "bool", value: true };
      case "false":
        this.next();
        return { kind: "bool", value: false };
      case "null":
        this.next();
        return { kind: "null" };
      case "regex":
        this.next();
        return { kind: "regex", pattern: t.value, flags: t.flags ?? "" };
      case "ident": {
        this.next();
        if (this.isOp("(")) {
          const args = this.parseArgs();
          return { kind: "call", callee: { kind: "ident", name: t.value }, args };
        }
        return { kind: "ident", name: t.value };
      }
      case "op":
        if (t.value === "(") {
          this.next();
          const inner = this.parseOr();
          this.expectOp(")");
          return inner;
        }
        if (t.value === "[") {
          return this.parseListLiteral();
        }
        if (t.value === "{") {
          return this.parseObjectLiteral();
        }
        break;
    }
    throw new Error(`Unexpected token '${t.value || t.type}' at position ${t.pos}`);
  }

  private parseListLiteral(): Node {
    this.expectOp("[");
    const elements: Node[] = [];
    if (!this.isOp("]")) {
      elements.push(this.parseOr());
      while (this.eatOp(",")) {
        if (this.isOp("]")) break;
        elements.push(this.parseOr());
      }
    }
    this.expectOp("]");
    return { kind: "list", elements };
  }

  private parseObjectLiteral(): Node {
    this.expectOp("{");
    const entries: { key: string; value: Node }[] = [];
    if (!this.isOp("}")) {
      do {
        if (this.isOp("}")) break;
        const keyTok = this.next();
        let key: string;
        if (keyTok.type === "string") {
          key = keyTok.str ?? keyTok.value;
        } else if (keyTok.type === "ident") {
          key = keyTok.value;
        } else {
          throw new Error(`Expected object key at position ${keyTok.pos}`);
        }
        this.expectOp(":");
        const value = this.parseOr();
        entries.push({ key, value });
      } while (this.eatOp(","));
    }
    this.expectOp("}");
    return { kind: "object", entries };
  }
}
