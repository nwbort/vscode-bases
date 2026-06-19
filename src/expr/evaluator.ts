import { Node } from "./ast";
import { EvalContext, withLocals } from "./context";
import {
  Value, NULL, str, num, bool, list, obj,
  isTruthy, isEmpty, valueEquals, compareValues, toNumber, valueToString,
  dateField, durationField, addDuration, parseDuration, duration,
  DateValue, DurationValue,
} from "./values";
import { parseExpression } from "./parser";
import { globals } from "./functions/global";
import { methods, universalMethods } from "./functions/index";
import { fileMethods, linkMethods, fileValueField } from "./functions/fileLink";
import { noteProperty, notePropertiesObject, fileField } from "./convert";
import { file as fileValue } from "./values";

// Walks the AST and produces a Value within an EvalContext.

const LAZY_LIST_METHODS = new Set(["filter", "map", "reduce"]);

export function evaluate(node: Node, ctx: EvalContext): Value {
  switch (node.kind) {
    case "number":
      return num(node.value);
    case "string":
      return str(node.value);
    case "bool":
      return bool(node.value);
    case "null":
      return NULL;
    case "regex":
      return { type: "regexp", pattern: node.pattern, flags: node.flags };
    case "list":
      return list(node.elements.map((e) => evaluate(e, ctx)));
    case "object": {
      const out: Record<string, Value> = {};
      for (const { key, value } of node.entries) {
        out[key] = evaluate(value, ctx);
      }
      return obj(out);
    }
    case "ident":
      return evalIdent(node.name, ctx);
    case "member":
      return evalMember(node.object, node.property, ctx);
    case "index":
      return evalIndex(evaluate(node.object, ctx), evaluate(node.index, ctx));
    case "unary":
      return evalUnary(node.op, evaluate(node.operand, ctx));
    case "binary":
      return evalBinary(node, ctx);
    case "call":
      return evalCall(node.callee, node.args, ctx);
  }
}

function evalIdent(name: string, ctx: EvalContext): Value {
  if (ctx.locals && name in ctx.locals) {
    return ctx.locals[name];
  }
  switch (name) {
    case "this":
      return ctx.thisValue ?? NULL;
    case "note":
      return notePropertiesObject(ctx.note);
    case "file":
      return fileValue(ctx.note.file.path);
    case "formula":
      return NULL;
    default:
      return noteProperty(ctx.note, name);
  }
}

function evalMember(objectNode: Node, property: string, ctx: EvalContext): Value {
  // formula.<name> is resolved against the base config, not as object access.
  if (objectNode.kind === "ident") {
    if (objectNode.name === "formula") {
      return ctx.resolveFormula(property);
    }
    if (objectNode.name === "file" && !(ctx.locals && "file" in ctx.locals)) {
      const direct = fileField(ctx.note, property);
      if (direct !== null) return direct;
    }
  }
  return memberOf(evaluate(objectNode, ctx), property, ctx);
}

function memberOf(value: Value, property: string, ctx: EvalContext): Value {
  switch (value.type) {
    case "date": {
      const f = dateField(value, property);
      return f ?? NULL;
    }
    case "duration": {
      const f = durationField(value, property);
      return f ?? NULL;
    }
    case "string":
      return property === "length" ? num(value.value.length) : NULL;
    case "list":
      return property === "length" ? num(value.value.length) : NULL;
    case "object":
      return own(value.value, property) ? value.value[property] : NULL;
    case "file": {
      const f = fileValueField(value, property, ctx);
      return f ?? NULL;
    }
    default:
      return NULL;
  }
}

function evalIndex(value: Value, index: Value): Value {
  if (value.type === "list" && index.type === "number") {
    const i = index.value < 0 ? value.value.length + index.value : index.value;
    return value.value[i] ?? NULL;
  }
  if (value.type === "object") {
    const key = valueToString(index);
    return own(value.value, key) ? value.value[key] : NULL;
  }
  if (value.type === "string" && index.type === "number") {
    return str(value.value[index.value] ?? "");
  }
  return NULL;
}

function evalUnary(op: "!" | "-", operand: Value): Value {
  if (op === "!") {
    return bool(!isTruthy(operand));
  }
  if (operand.type === "duration") {
    return duration(-operand.ms, -operand.months);
  }
  return num(-toNumber(operand));
}

function evalCall(callee: Node, argNodes: Node[], ctx: EvalContext): Value {
  if (callee.kind === "ident") {
    const fn = globals[callee.name];
    if (!fn) {
      throw new Error(`Unknown function: ${callee.name}()`);
    }
    const args = argNodes.map((a) => evaluate(a, ctx));
    return fn(args, ctx);
  }

  if (callee.kind === "member") {
    const property = callee.property;

    // Lazy list methods evaluate their argument expression per element.
    if (LAZY_LIST_METHODS.has(property)) {
      const recv = evaluate(callee.object, ctx);
      return evalListLambda(property, coerceList(recv), argNodes, ctx);
    }

    const recv = evaluate(callee.object, ctx);
    const args = argNodes.map((a) => evaluate(a, ctx));

    if (recv.type === "file" && own(fileMethods, property)) {
      return fileMethods[property](recv, args, ctx);
    }
    if (recv.type === "link" && own(linkMethods, property)) {
      return linkMethods[property](recv, args, ctx);
    }

    const typeMap = methods[recv.type];
    if (typeMap && own(typeMap, property)) {
      return typeMap[property](recv, args, ctx);
    }
    if (own(universalMethods, property)) {
      return universalMethods[property](recv, args, ctx);
    }
    if (property === "isEmpty") {
      return bool(isEmpty(recv));
    }
    throw new Error(`Unknown method: ${recv.type}.${property}()`);
  }

  throw new Error("Invalid call target");
}

function own(map: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, key);
}

function coerceList(v: Value): Value[] {
  if (v.type === "list") return v.value;
  if (v.type === "null") return [];
  return [v];
}

function evalListLambda(
  method: string,
  elements: Value[],
  argNodes: Node[],
  ctx: EvalContext,
): Value {
  if (method === "filter") {
    const out: Value[] = [];
    elements.forEach((value, index) => {
      const child = withLocals(ctx, { value, index: num(index) });
      if (isTruthy(evaluate(argNodes[0], child))) {
        out.push(value);
      }
    });
    return list(out);
  }
  if (method === "map") {
    return list(
      elements.map((value, index) =>
        evaluate(argNodes[0], withLocals(ctx, { value, index: num(index) })),
      ),
    );
  }
  // reduce(expression, acc)
  let acc: Value = argNodes[1] ? evaluate(argNodes[1], ctx) : NULL;
  elements.forEach((value, index) => {
    acc = evaluate(argNodes[0], withLocals(ctx, { value, index: num(index), acc }));
  });
  return acc;
}

function evalBinary(node: Extract<Node, { kind: "binary" }>, ctx: EvalContext): Value {
  const { op } = node;

  // Short-circuit boolean operators (JS semantics: return an operand).
  if (op === "&&") {
    const left = evaluate(node.left, ctx);
    return isTruthy(left) ? evaluate(node.right, ctx) : left;
  }
  if (op === "||") {
    const left = evaluate(node.left, ctx);
    return isTruthy(left) ? left : evaluate(node.right, ctx);
  }

  const a = evaluate(node.left, ctx);
  const b = evaluate(node.right, ctx);

  switch (op) {
    case "==":
      return bool(valueEquals(a, b));
    case "!=":
      return bool(!valueEquals(a, b));
    case "<":
    case "<=":
    case ">":
    case ">=": {
      const c = compareValues(a, b);
      if (c === null) return bool(false);
      if (op === "<") return bool(c < 0);
      if (op === "<=") return bool(c <= 0);
      if (op === ">") return bool(c > 0);
      return bool(c >= 0);
    }
    case "+":
      return evalAdd(a, b);
    case "-":
      return evalSub(a, b);
    case "*":
      return evalMul(a, b);
    case "/":
      return num(toNumber(a) / toNumber(b));
    case "%":
      return num(toNumber(a) % toNumber(b));
  }
}

function asDurationFromString(v: Value): DurationValue | null {
  if (v.type === "duration") return v;
  if (v.type === "string") return parseDuration(v.value);
  return null;
}

function evalAdd(a: Value, b: Value): Value {
  // Date + duration (string or duration value).
  if (a.type === "date") {
    const d = asDurationFromString(b);
    if (d) return addDuration(a, d, 1);
  }
  if (b.type === "date") {
    const d = asDurationFromString(a);
    if (d) return addDuration(b as DateValue, d, 1);
  }
  // Duration + duration.
  if (a.type === "duration" && b.type === "duration") {
    return duration(a.ms + b.ms, a.months + b.months);
  }
  // String concatenation when either side is a string.
  if (a.type === "string" || b.type === "string") {
    return str(valueToString(a) + valueToString(b));
  }
  // Numeric addition.
  return num(toNumber(a) + toNumber(b));
}

function evalSub(a: Value, b: Value): Value {
  if (a.type === "date" && b.type === "date") {
    return duration(a.epochMs - b.epochMs, 0);
  }
  if (a.type === "date") {
    const d = asDurationFromString(b);
    if (d) return addDuration(a, d, -1);
  }
  if (a.type === "duration" && b.type === "duration") {
    return duration(a.ms - b.ms, a.months - b.months);
  }
  return num(toNumber(a) - toNumber(b));
}

function evalMul(a: Value, b: Value): Value {
  if (a.type === "duration" && b.type === "number") {
    return duration(a.ms * b.value, a.months * b.value);
  }
  if (a.type === "number" && b.type === "duration") {
    return duration(b.ms * a.value, b.months * a.value);
  }
  return num(toNumber(a) * toNumber(b));
}

/** Parse + evaluate a source expression. Convenience used by filters/formulas. */
export function evaluateSource(source: string, ctx: EvalContext): Value {
  return evaluate(parseExpression(source), ctx);
}

/** Evaluate a filter statement string to a boolean. */
export function evaluateFilterStatement(source: string, ctx: EvalContext): boolean {
  return isTruthy(evaluateSource(source, ctx));
}
