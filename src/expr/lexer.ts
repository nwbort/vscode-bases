import { Token, TokenType } from "./token";

// Converts a Bases expression source string into a flat list of tokens.
//
// The grammar (see IMPLEMENTATION_PLAN.md §3) needs: numbers, single/double
// quoted strings (with escapes), /regex/flags literals, identifiers (which may
// contain spaces when they name a property — but we only lex the simple
// identifier here; spaced property names are handled by the parser via member
// access or by the host quoting them), the keywords true/false/null, and the
// operator/punctuation set.

const SINGLE_CHAR_OPS = new Set([
  "(", ")", "[", "]", "{", "}", ",", ".", ":", "+", "-", "*", "/", "%",
  "<", ">", "!",
]);

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = source.length;

  const peek = (o = 0) => source[i + o];

  while (i < n) {
    const c = source[i];

    // Whitespace
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }

    const start = i;

    // Numbers: 123, 1.5, .5
    if (isDigit(c) || (c === "." && isDigit(peek(1)))) {
      let j = i;
      while (j < n && isDigit(source[j])) j++;
      // Only treat a dot as a decimal point when a digit follows it; otherwise
      // it is member access (e.g. `1.isTruthy()` or `123.toString()`).
      if (source[j] === "." && isDigit(source[j + 1])) {
        j++;
        while (j < n && isDigit(source[j])) j++;
      }
      // exponent
      if (source[j] === "e" || source[j] === "E") {
        let k = j + 1;
        if (source[k] === "+" || source[k] === "-") k++;
        if (isDigit(source[k])) {
          k++;
          while (k < n && isDigit(source[k])) k++;
          j = k;
        }
      }
      const text = source.slice(i, j);
      tokens.push({ type: "number", value: text, num: Number(text), pos: start });
      i = j;
      continue;
    }

    // Strings
    if (c === '"' || c === "'") {
      const { value, next } = readString(source, i);
      tokens.push({ type: "string", value, str: value, pos: start });
      i = next;
      continue;
    }

    // Regex literal — only when `/` cannot be a division operator. It is a
    // regex when the previous meaningful token is not a value (number/string/
    // ident/closing bracket).
    if (c === "/" && regexAllowed(tokens)) {
      const re = tryReadRegex(source, i);
      if (re) {
        tokens.push({ type: "regex", value: re.pattern, flags: re.flags, pos: start });
        i = re.next;
        continue;
      }
    }

    // Identifiers / keywords
    if (isIdentStart(c)) {
      let j = i;
      while (j < n && isIdentPart(source[j])) j++;
      const text = source.slice(i, j);
      const kw = keyword(text);
      tokens.push({ type: kw ?? "ident", value: text, pos: start });
      i = j;
      continue;
    }

    // Multi-char operators
    const two = source.slice(i, i + 2);
    if (two === "==" || two === "!=" || two === "<=" || two === ">=" || two === "&&" || two === "||") {
      tokens.push({ type: "op", value: two, pos: start });
      i += 2;
      continue;
    }

    // Single-char operators / punctuation
    if (SINGLE_CHAR_OPS.has(c)) {
      tokens.push({ type: "op", value: c, pos: start });
      i++;
      continue;
    }

    throw new Error(`Unexpected character '${c}' at position ${i}`);
  }

  tokens.push({ type: "eof", value: "", pos: i });
  return tokens;
}

function keyword(text: string): TokenType | null {
  if (text === "true") return "true";
  if (text === "false") return "false";
  if (text === "null") return "null";
  return null;
}

function isDigit(c: string | undefined): boolean {
  return c !== undefined && c >= "0" && c <= "9";
}

function isIdentStart(c: string): boolean {
  return /[A-Za-z_$]/.test(c);
}

function isIdentPart(c: string): boolean {
  return /[A-Za-z0-9_$]/.test(c);
}

function readString(source: string, start: number): { value: string; next: number } {
  const quote = source[start];
  let i = start + 1;
  let out = "";
  while (i < source.length) {
    const c = source[i];
    if (c === "\\") {
      const e = source[i + 1];
      switch (e) {
        case "n": out += "\n"; break;
        case "t": out += "\t"; break;
        case "r": out += "\r"; break;
        case "\\": out += "\\"; break;
        case "'": out += "'"; break;
        case '"': out += '"'; break;
        case "`": out += "`"; break;
        default: out += e ?? ""; break;
      }
      i += 2;
      continue;
    }
    if (c === quote) {
      return { value: out, next: i + 1 };
    }
    out += c;
    i++;
  }
  throw new Error(`Unterminated string starting at position ${start}`);
}

function regexAllowed(tokens: Token[]): boolean {
  const prev = tokens[tokens.length - 1];
  if (!prev) return true;
  if (prev.type === "number" || prev.type === "string" || prev.type === "ident" || prev.type === "regex") {
    return false;
  }
  if (prev.type === "true" || prev.type === "false" || prev.type === "null") {
    return false;
  }
  if (prev.type === "op" && (prev.value === ")" || prev.value === "]")) {
    return false;
  }
  return true;
}

function tryReadRegex(
  source: string,
  start: number,
): { pattern: string; flags: string; next: number } | null {
  let i = start + 1;
  let pattern = "";
  let inClass = false;
  while (i < source.length) {
    const c = source[i];
    if (c === "\\") {
      pattern += c + (source[i + 1] ?? "");
      i += 2;
      continue;
    }
    if (c === "[") inClass = true;
    else if (c === "]") inClass = false;
    else if (c === "/" && !inClass) {
      // end of pattern
      i++;
      let flags = "";
      while (i < source.length && /[a-z]/i.test(source[i])) {
        flags += source[i];
        i++;
      }
      return { pattern, flags, next: i };
    } else if (c === "\n") {
      return null;
    }
    pattern += c;
    i++;
  }
  return null;
}
