// AST produced by the parser and consumed by the evaluator.

export type Node =
  | NumberLit
  | StringLit
  | BoolLit
  | NullLit
  | RegexLit
  | ListLit
  | ObjectLit
  | Identifier
  | Member // a.b
  | Index // a[b]
  | Call // f(args) or a.f(args)
  | Unary // !a, -a
  | Binary; // a + b, a == b, a && b, ...

export interface NumberLit { kind: "number"; value: number; }
export interface StringLit { kind: "string"; value: string; }
export interface BoolLit { kind: "bool"; value: boolean; }
export interface NullLit { kind: "null"; }
export interface RegexLit { kind: "regex"; pattern: string; flags: string; }
export interface ListLit { kind: "list"; elements: Node[]; }
export interface ObjectLit { kind: "object"; entries: { key: string; value: Node }[]; }
export interface Identifier { kind: "ident"; name: string; }
export interface Member { kind: "member"; object: Node; property: string; }
export interface Index { kind: "index"; object: Node; index: Node; }
/** `callee` is an Identifier (global fn) or a Member (method call). */
export interface Call { kind: "call"; callee: Node; args: Node[]; }
export interface Unary { kind: "unary"; op: "!" | "-"; operand: Node; }
export interface Binary {
  kind: "binary";
  op: "+" | "-" | "*" | "/" | "%" | "==" | "!=" | "<" | "<=" | ">" | ">=" | "&&" | "||";
  left: Node;
  right: Node;
}
