// Token kinds produced by the lexer (src/expr/lexer.ts) and consumed by the
// Pratt parser (src/expr/parser.ts).

export type TokenType =
  | "number"
  | "string"
  | "regex"
  | "ident"
  | "true"
  | "false"
  | "null"
  | "op" // operator or punctuation, see `value`
  | "eof";

export interface Token {
  type: TokenType;
  /** The literal text (for op/ident) or the parsed payload below. */
  value: string;
  /** Parsed number for number tokens. */
  num?: number;
  /** Parsed string contents (unescaped) for string tokens. */
  str?: string;
  /** Regex flags for regex tokens (value holds the pattern). */
  flags?: string;
  /** Source offset, for error messages. */
  pos: number;
}
