import {
  type Farm,
  getDirection,
  getInventory,
  getPosition,
  getXCord,
  getYCord,
  isHarvestable,
} from "./farm.ts";
import type { PlantName } from "./plants.ts";
export type Getter =
  | "get_position"
  | "get_x_cord"
  | "get_y_cord"
  | "get_direction"
  | "is_harvestable";
export type Value = string | number | boolean | [number, number];
export type Expression =
  | { kind: "literal"; value: string | number | boolean }
  | { kind: "getter"; name: Getter }
  | { kind: "inventory"; plant: PlantName };

export function isNumericExpression(
  expression: Expression | undefined,
): expression is Expression {
  if (!expression) return false;
  if (expression.kind === "literal") {
    return typeof expression.value === "number";
  }
  if (expression.kind === "inventory") return true;
  return expression.name === "get_x_cord" || expression.name === "get_y_cord";
}

function isStringExpression(
  expression: Expression | undefined,
): expression is Expression {
  if (!expression) return false;
  if (expression.kind === "literal") {
    return typeof expression.value === "string";
  }
  return expression.kind === "getter" && expression.name === "get_direction";
}

// Only literals and named, read-only getters are accepted. Never evaluate JS.
export function parseExpression(source: string): Expression | undefined {
  const text = source.trim();
  const inventory =
    /^get_inventory\(\s*(wheat|tomato|cucumber|watermelon)\s*\)$/.exec(text);
  if (inventory) return { kind: "inventory", plant: inventory[1] as PlantName };
  const getter =
    /^(get_position|get_x_cord|get_y_cord|get_direction|is_harvestable)\(\s*\)$/
      .exec(text);
  if (getter) return { kind: "getter", name: getter[1] as Getter };
  if (text === "True" || text === "False") {
    return { kind: "literal", value: text === "True" };
  }
  if (/^-?\d+(?:\.\d+)?$/.test(text) && Number.isFinite(Number(text))) {
    return { kind: "literal", value: Number(text) };
  }
  const quoted = /^(?:"((?:[^"\\]|\\["'\\nrt])*)"|'((?:[^'\\]|\\["'\\nrt])*)')$/
    .exec(text);
  if (!quoted) return undefined;
  const escapes: Record<string, string> = {
    n: "\n",
    r: "\r",
    t: "\t",
    "\\": "\\",
    "'": "'",
    '"': '"',
  };
  return {
    kind: "literal",
    value: (quoted[1] ?? quoted[2]).replace(
      /\\(["'\\nrt])/g,
      (_, key: string) => escapes[key],
    ),
  };
}
export function evaluateExpression(
  expression: Expression,
  farm: Farm,
  now = performance.now(),
): Value {
  if (expression.kind === "literal") return expression.value;
  if (expression.kind === "inventory") {
    return getInventory(farm, expression.plant);
  }
  if (expression.name === "is_harvestable") return isHarvestable(farm, now);
  if (expression.name === "get_position") return getPosition(farm);
  if (expression.name === "get_direction") return getDirection(farm);
  return expression.name === "get_x_cord" ? getXCord(farm) : getYCord(farm);
}
export function formatValue(value: Value): string {
  if (Array.isArray(value)) return `(${value[0]}, ${value[1]})`;
  if (typeof value === "boolean") return value ? "True" : "False";
  return String(value);
}
export type ComparisonOperator = "==" | "!=" | "<" | "<=" | ">" | ">=";
export type Condition = boolean | { kind: "harvestable" } | {
  left: Expression;
  operator: ComparisonOperator;
  right: Expression;
} | { kind: "and" | "or"; operands: Condition[] };

function findComparison(
  text: string,
): { index: number; operator: ComparisonOperator } | undefined {
  let depth = 0;
  let quote: '"' | "'" | undefined;
  let escaped = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(") {
      depth++;
      continue;
    }
    if (character === ")") {
      depth--;
      continue;
    }
    if (depth !== 0) continue;
    const operator = ["==", "!=", "<=", ">=", "<", ">"].find((candidate) =>
      text.startsWith(candidate, index)
    ) as ComparisonOperator | undefined;
    if (operator) return { index, operator };
  }
  return undefined;
}

export function parseCondition(
  source: string,
  nesting = 0,
): Condition | undefined {
  const text = source.trim();
  if (!text || nesting > 64) return undefined;
  // Split only outside parentheses, first OR then AND, giving AND priority.
  for (const kind of ["or", "and"] as const) {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    let outerClosesAt = -1;
    let quote: '"' | "'" | undefined;
    let escaped = false;
    for (let index = 0; index < text.length; index++) {
      const character = text[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = undefined;
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
        continue;
      }
      if (character === "(") depth++;
      else if (character === ")") {
        if (--depth < 0) return undefined;
        if (depth === 0 && outerClosesAt === -1) outerClosesAt = index;
      }
      if (depth !== 0) continue;
      const symbol = kind === "or" ? "|" : "&";
      const word = text.slice(index, index + kind.length) === kind &&
        !/[a-zA-Z0-9_]/.test(text[index - 1] ?? "") &&
        !/[a-zA-Z0-9_]/.test(text[index + kind.length] ?? "");
      if (character === symbol || word) {
        parts.push(text.slice(start, index));
        index += word ? kind.length - 1 : 0;
        start = index + 1;
      }
    }
    if (depth !== 0 || quote) return undefined;
    if (parts.length) {
      parts.push(text.slice(start));
      const operands = parts.map((part) => parseCondition(part, nesting + 1));
      if (operands.some((part) => part === undefined)) return undefined;
      return { kind, operands: operands as Condition[] };
    }
    if (text.startsWith("(") && outerClosesAt === text.length - 1) {
      return parseCondition(text.slice(1, -1), nesting + 1);
    }
  }
  if (text === "True" || text === "False") return text === "True";
  if (/^is_harvestable\(\s*\)$/.test(text)) return { kind: "harvestable" };
  const comparison = findComparison(text);
  if (!comparison) return undefined;
  const left = parseExpression(text.slice(0, comparison.index));
  const right = parseExpression(
    text.slice(comparison.index + comparison.operator.length),
  );
  const operator = comparison.operator;
  const numericComparison = isNumericExpression(left) &&
    isNumericExpression(right);
  const stringComparison = isStringExpression(left) &&
    isStringExpression(right) &&
    (operator === "==" || operator === "!=");
  if (!numericComparison && !stringComparison) return undefined;
  return { left, operator, right };
}
export function evaluateCondition(
  condition: Condition,
  farm: Farm,
  now = performance.now(),
): boolean {
  if (typeof condition === "boolean") return condition;
  if ("kind" in condition) {
    if (condition.kind === "harvestable") return isHarvestable(farm, now);
    return condition.kind === "and"
      ? condition.operands.every((operand) =>
        evaluateCondition(operand, farm, now)
      )
      : condition.operands.some((operand) =>
        evaluateCondition(operand, farm, now)
      );
  }
  const left = evaluateExpression(condition.left, farm, now);
  const right = evaluateExpression(condition.right, farm, now);
  if (typeof left === "string" && typeof right === "string") {
    if (condition.operator === "==") return left === right;
    if (condition.operator === "!=") return left !== right;
    throw new Error("Strings only support == and != comparisons.");
  }
  if (typeof left !== "number" || typeof right !== "number") {
    throw new Error("Comparison operands must have matching supported types.");
  }
  switch (condition.operator) {
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case ">":
      return left > right;
    case ">=":
      return left >= right;
  }
}
