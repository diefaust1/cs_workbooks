import {
  buy,
  createFarm,
  type Direction,
  type Farm,
  harvest,
  move,
  plant,
  type Position,
  resetField,
  sell,
} from "./farm.ts";
import { type PlantName } from "./plants.ts";
import {
  type Condition,
  evaluateCondition,
  evaluateExpression,
  type Expression,
  formatValue,
  type Getter,
  isNumericExpression,
  parseCondition,
  parseExpression,
} from "./expressions.ts";
export { createFarm, move };
export type { Farm, Position };
export const STEP_DELAY_MS = 500;
export type Instruction =
  & (
    | { command: "direction"; argument: Direction }
    | { command: "plant"; argument: PlantName }
    | {
      command: "buy" | "sell";
      argument: PlantName;
      quantity: Expression;
      quantitySource: string;
    }
    | { command: "get_inventory"; argument: PlantName }
    | {
      command: "move" | "harvest" | "reset" | "reset_field" | "break" | Getter;
    }
    | { command: "print"; expression: Expression }
  )
  & { line: number };
export type Statement = Instruction | {
  kind: "while" | "if";
  condition: Condition;
  body: Statement[];
  line: number;
  elseBody?: Statement[];
} | { kind: "for"; count: number; body: Statement[]; line: number };
export type Diagnostic = { line: number; source: string; message?: string };
export type Compilation =
  | { ok: true; instructions: Statement[] }
  | { ok: false; errors: Diagnostic[] };

// Validate the entire source, including unreachable loop bodies, before execution.
export function compileProgram(source: string): Compilation {
  const instructions: Statement[] = [];
  const errors: Diagnostic[] = [];
  const blocks: {
    body: Statement[];
    loopDepth: number;
    owner?: { line: number; source: string };
  }[] = [{ body: instructions, loopDepth: 0 }];
  let pending: {
    kind: "while" | "if" | "else" | "for";
    body: Statement[];
    loopDepth: number;
    owner: { line: number; source: string };
  } | undefined;

  source.split(/\r?\n/).forEach((sourceLine, index) => {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) return;
    const error = (message: string) =>
      errors.push({ line: index + 1, source: sourceLine, message });
    const whitespace = sourceLine.match(/^\s*/)?.[0] ?? "";
    if (/[^ ]/.test(whitespace) || whitespace.length % 4 !== 0) {
      error("Use four spaces per indentation level; tabs are not supported.");
      return;
    }
    const depth = whitespace.length / 4;
    if (pending) {
      if (depth === blocks.length) blocks.push(pending);
      else {errors.push({
          ...pending.owner,
          message: `Expected ${
            pending.kind === "while"
              ? "a loop"
              : pending.kind === "for"
              ? "a for loop"
              : pending.kind === "if"
              ? "an if"
              : "an else"
          } body indented by four spaces.`,
        });}
      pending = undefined;
    }
    if (depth >= blocks.length) {
      error(
        "Unexpected indentation. Only a while, for, if, or else block introduces an indented body.",
      );
      return;
    }
    blocks.length = depth + 1;
    const body = blocks[depth].body;
    if (/^else\s*:$/.test(line)) {
      const previous = body[body.length - 1];
      if (
        !previous || "command" in previous || previous.kind !== "if" ||
        previous.elseBody
      ) {
        error(
          "else must follow an if block at the same indentation, with only one else per if.",
        );
        return;
      }
      previous.elseBody = [];
      pending = {
        kind: "else",
        body: previous.elseBody,
        loopDepth: blocks[depth].loopDepth,
        owner: { line: index + 1, source: sourceLine },
      };
      return;
    }
    const movement = /^direction\(\s*(up|down|left|right)\s*\)$/.exec(line);
    const transaction =
      /^(buy|sell)\(\s*(wheat|tomato|cucumber|watermelon)\s*,\s*(.+)\s*\)$/
        .exec(line);
    const quantity = transaction ? parseExpression(transaction[3]) : undefined;
    const planting = /^plant\(\s*(wheat|tomato|cucumber|watermelon)\s*\)$/.exec(
      line,
    );
    const inventoryGetter =
      /^get_inventory\(\s*(wheat|tomato|cucumber|watermelon)\s*\)$/.exec(line);
    const command =
      /^(move|harvest|reset|reset_field|break|get_position|get_x_cord|get_y_cord|get_direction|is_harvestable)\(\s*\)$/
        .exec(line);
    const block = /^(while|if)\s*\((.*)\)\s*:$/.exec(line);
    const condition = block ? parseCondition(block[2]) : undefined;
    const forLoop = /^for\s+[A-Za-z_]\w*\s+in\s+range\s*\(\s*(\d+)\s*\)\s*:$/
      .exec(line);
    const printing = /^print\((.*)\)$/.exec(line);
    const expression = printing ? parseExpression(printing[1]) : undefined;
    if (movement) {
      body.push({
        command: "direction",
        argument: movement[1] as Direction,
        line: index + 1,
      });
    } else if (transaction && isNumericExpression(quantity)) {
      body.push({
        command: transaction[1] as "buy" | "sell",
        argument: transaction[2] as PlantName,
        quantity,
        quantitySource: transaction[3].trim(),
        line: index + 1,
      });
    } else if (planting) {
      body.push({
        command: "plant",
        argument: planting[1] as PlantName,
        line: index + 1,
      });
    } else if (inventoryGetter) {
      body.push({
        command: "get_inventory",
        argument: inventoryGetter[1] as PlantName,
        line: index + 1,
      });
    } else if (command) {
      if (command[1] === "break" && blocks[depth].loopDepth === 0) {
        error("break() can only be used inside a while or for loop.");
        return;
      }
      body.push({
        command: command[1] as
          | "move"
          | "harvest"
          | "reset"
          | "reset_field"
          | "break"
          | Getter,
        line: index + 1,
      });
    } else if (printing && expression) {
      body.push({ command: "print", expression, line: index + 1 });
    } else if (forLoop && Number.isSafeInteger(Number(forLoop[1]))) {
      const statement = {
        kind: "for" as const,
        count: Number(forLoop[1]),
        body: [] as Statement[],
        line: index + 1,
      };
      body.push(statement);
      pending = {
        kind: "for",
        body: statement.body,
        loopDepth: blocks[depth].loopDepth + 1,
        owner: { line: index + 1, source: sourceLine },
      };
    } else if (block && condition !== undefined) {
      const statement = {
        kind: block[1] as "while" | "if",
        condition,
        body: [] as Statement[],
        line: index + 1,
      };
      body.push(statement);
      pending = {
        kind: statement.kind,
        body: statement.body,
        loopDepth: blocks[depth].loopDepth +
          (statement.kind === "while" ? 1 : 0),
        owner: { line: index + 1, source: sourceLine },
      };
    } else {
      errors.push({ line: index + 1, source: sourceLine });
    }
  });
  if (pending) {
    errors.push({
      ...pending.owner,
      message: `Expected ${
        pending.kind === "while"
          ? "a loop"
          : pending.kind === "for"
          ? "a for loop"
          : pending.kind === "if"
          ? "an if"
          : "an else"
      } body indented by four spaces.`,
    });
  }
  return errors.length ? { ok: false, errors } : { ok: true, instructions };
}

export type Step = {
  instruction: Instruction;
  position: Position;
  moved: boolean;
  message: string;
  success: boolean;
  output?: string;
};
type Pause = (milliseconds: number) => Promise<void>;
const pause: Pause = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

// An explicit stack avoids recursion and never expands infinite loops in memory.
// Loop checks also pause, so a true loop containing only false loops can be stopped.
export async function runProgram(
  instructions: readonly Statement[],
  farm: Farm,
  onStep: (step: Step) => void,
  wait: Pause = pause,
  signal?: AbortSignal,
  now: () => number = () => performance.now(),
): Promise<"complete" | "stopped"> {
  type ExecutionFrame = {
    body: readonly Statement[];
    index: number;
    loopKind?: "while" | "for";
    remainingIterations?: number;
  };
  const stack: ExecutionFrame[] = [{ body: instructions, index: 0 }];
  while (stack.length) {
    if (signal?.aborted) return "stopped";
    const frame = stack[stack.length - 1];
    if (frame.index >= frame.body.length) {
      if (frame.loopKind === "for" && frame.remainingIterations! > 1) {
        await wait(STEP_DELAY_MS);
        if (signal?.aborted) return "stopped";
        frame.remainingIterations!--;
        frame.index = 0;
        continue;
      }
      stack.pop();
      continue;
    }
    const statement = frame.body[frame.index];
    await wait(STEP_DELAY_MS);
    if (signal?.aborted) return "stopped";
    if ("command" in statement) {
      frame.index++;
      let moved = false;
      let result: { success: boolean; message: string; output?: string } = {
        success: true,
        message: "",
      };
      if (statement.command === "move") {
        moved = move(farm);
        result.message = moved ? "Moved." : "Edge reached; staying here.";
      } else if (statement.command === "direction") {
        farm.direction = statement.argument;
        result.message = `Facing ${farm.direction}.`;
      } else if (statement.command === "reset") {
        farm.position = { x: 0, y: 0 };
        farm.direction = "right";
        result.message = "Position reset.";
      } else if (statement.command === "reset_field") {
        resetField(farm);
        result.message = "Field cleared. Position reset to (0, 0).";
      } else if (statement.command === "plant") {
        result = plant(farm, statement.argument, now());
      } else if (statement.command === "buy") {
        const quantity = evaluateExpression(statement.quantity, farm, now());
        result = buy(farm, statement.argument, quantity as number);
      } else if (statement.command === "sell") {
        const quantity = evaluateExpression(statement.quantity, farm, now());
        result = sell(farm, statement.argument, quantity as number);
      } else if (statement.command === "break") {
        const loopIndex = stack.findLastIndex((candidate) =>
          candidate.loopKind !== undefined
        );
        if (loopIndex < 0) {
          result = { success: false, message: "No loop to interrupt." };
        } else {
          const loopFrame = stack[loopIndex];
          stack.length = loopIndex;
          if (loopFrame.loopKind === "while") stack[loopIndex - 1].index++;
          result.message = "Loop interrupted.";
        }
      } else if (statement.command === "harvest") result = harvest(farm, now());
      else {
        const expression: Expression = statement.command === "print"
          ? statement.expression
          : statement.command === "get_inventory"
          ? { kind: "inventory", plant: statement.argument }
          : { kind: "getter", name: statement.command };
        const value = formatValue(evaluateExpression(expression, farm, now()));
        result = {
          success: true,
          message: value,
          ...(statement.command === "print" ? { output: value } : {}),
        };
      }
      onStep({
        instruction: statement,
        position: { ...farm.position },
        moved,
        ...result,
      });
    } else if (statement.kind === "for") {
      frame.index++;
      if (statement.count > 0) {
        stack.push({
          body: statement.body,
          index: 0,
          loopKind: "for",
          remainingIterations: statement.count,
        });
      }
    } else if (evaluateCondition(statement.condition, farm, now())) {
      // If runs once; while stays on the parent statement and rechecks.
      if (statement.kind === "if") frame.index++;
      stack.push({
        body: statement.body,
        index: 0,
        ...(statement.kind === "while" ? { loopKind: "while" as const } : {}),
      });
    } else {
      frame.index++;
      if (statement.kind === "if" && statement.elseBody) {
        stack.push({ body: statement.elseBody, index: 0 });
      }
    }
  }
  return "complete";
}
