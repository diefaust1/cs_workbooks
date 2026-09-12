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
    for (let index = 0; index < text.length; index++) {
      if (text[index] === "(") depth++;
      else if (text[index] === ")") {
        if (--depth < 0) return undefined;
        if (depth === 0 && outerClosesAt === -1) outerClosesAt = index;
      }
      if (depth !== 0) continue;
      const symbol = kind === "or" ? "|" : "&";
      const word = text.slice(index, index + kind.length) === kind &&
        !/[a-zA-Z0-9_]/.test(text[index - 1] ?? "") &&
        !/[a-zA-Z0-9_]/.test(text[index + kind.length] ?? "");
      if (text[index] === symbol || word) {
        parts.push(text.slice(start, index));
        index += word ? kind.length - 1 : 0;
        start = index + 1;
      }
    }
    if (depth !== 0) return undefined;
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
  const comparison = /^(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)$/.exec(text);
  if (!comparison) return undefined;
  const left = parseExpression(comparison[1]);
  const right = parseExpression(comparison[3]);
  const numeric = (value: Expression | undefined): value is Expression =>
    !!value &&
    (value.kind === "literal"
      ? typeof value.value === "number"
      : value.kind === "inventory" || value.name === "get_x_cord" ||
        value.name === "get_y_cord");
  if (!numeric(left) || !numeric(right)) return undefined;
  return { left, operator: comparison[2] as ComparisonOperator, right };
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
  const left = evaluateExpression(condition.left, farm);
  const right = evaluateExpression(condition.right, farm);
  if (typeof left !== "number" || typeof right !== "number") {
    throw new Error("Comparison operands must be numbers.");
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
