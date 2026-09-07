import { createFarm, move, plant, harvest, FIELD_SIZE, type Farm, type Position, type Direction } from "./farm.ts";
import { type PlantName } from "./plants.ts";
export { createFarm, move, FIELD_SIZE };
export type { Farm, Position };
export const STEP_DELAY_MS = 500;
export type Instruction = (
  | { command: "move"; argument: Direction }
  | { command: "plant"; argument: PlantName }
  | { command: "harvest" | "reset" }
) & { line: number };
export type Statement = Instruction | { condition: boolean; body: Statement[]; line: number };
export type Diagnostic = { line: number; source: string; message?: string };
export type Compilation =
  | { ok: true; instructions: Statement[] }
  | { ok: false; errors: Diagnostic[] };

// Validate the entire source, including unreachable loop bodies, before execution.
export function compileProgram(source: string): Compilation {
  const instructions: Statement[] = [];
  const errors: Diagnostic[] = [];
  const blocks: { body: Statement[]; owner?: { line: number; source: string } }[] = [{ body: instructions }];
  let pending: { body: Statement[]; owner: { line: number; source: string } } | undefined;

  source.split(/\r?\n/).forEach((sourceLine, index) => {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) return;
    const error = (message: string) => errors.push({ line: index + 1, source: sourceLine, message });
    const whitespace = sourceLine.match(/^\s*/)?.[0] ?? "";
    if (/[^ ]/.test(whitespace) || whitespace.length % 4 !== 0) {
      error("Use four spaces per indentation level; tabs are not supported.");
      return;
    }
    const depth = whitespace.length / 4;
    if (pending) {
      if (depth === blocks.length) blocks.push(pending);
      else errors.push({ ...pending.owner, message: "Expected a loop body indented by four spaces." });
      pending = undefined;
    }
    if (depth >= blocks.length) {
      error("Unexpected indentation. Only a while block introduces an indented body.");
      return;
    }
    blocks.length = depth + 1;
    const body = blocks[depth].body;
    const movement = /^move\(\s*(up|down|left|right)?\s*\)$/.exec(line);
    const planting = /^plant\(\s*(wheat|tomato|cucumber)\s*\)$/.exec(line);
    const command = /^(harvest|reset)\(\s*\)$/.exec(line);
    const loop = /^while\s*\(\s*(True|False)\s*\)\s*:$/.exec(line);
    if (movement) {
      body.push({ command: "move", argument: (movement[1] || "right") as Direction, line: index + 1 });
    } else if (planting) {
      body.push({ command: "plant", argument: planting[1] as PlantName, line: index + 1 });
    } else if (command) {
      body.push({ command: command[1] as "harvest" | "reset", line: index + 1 });
    } else if (loop) {
      const statement = { condition: loop[1] === "True", body: [] as Statement[], line: index + 1 };
      body.push(statement);
      pending = { body: statement.body, owner: { line: index + 1, source: sourceLine } };
    } else {
      errors.push({ line: index + 1, source: sourceLine });
    }
  });
  if (pending) errors.push({ ...pending.owner, message: "Expected a loop body indented by four spaces." });
  return errors.length ? { ok: false, errors } : { ok: true, instructions };
}

export type Step = { instruction: Instruction; position: Position; moved: boolean; message: string; success: boolean };
type Pause = (milliseconds: number) => Promise<void>;
const pause: Pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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
  const stack = [{ body: instructions, index: 0 }];
  while (stack.length) {
    if (signal?.aborted) return "stopped";
    const frame = stack[stack.length - 1];
    if (frame.index >= frame.body.length) {
      stack.pop();
      continue;
    }
    const statement = frame.body[frame.index];
    await wait(STEP_DELAY_MS);
    if (signal?.aborted) return "stopped";
    if ("command" in statement) {
      frame.index++;
      let moved = false;
      let result = { success: true, message: "" };
      if (statement.command === "move") {
        moved = move(farm, statement.argument);
        result.message = moved ? "Moved." : "Edge reached; staying here.";
      } else if (statement.command === "reset") {
        farm.position = { x: 0, y: 0 };
        result.message = "Position reset.";
      } else if (statement.command === "plant") result = plant(farm, statement.argument, now());
      else result = harvest(farm, now());
      onStep({ instruction: statement, position: { ...farm.position }, moved, ...result });
    } else if (statement.condition) {
      // Leave the parent on this while statement to recheck after the body.
      stack.push({ body: statement.body, index: 0 });
    } else {
      frame.index++;
    }
  }
  return "complete";
}

