import { deepStrictEqual, strictEqual } from "node:assert";
import { compileProgram, createFarm, move, runProgram, STEP_DELAY_MS, type Step } from "./program.ts";

Deno.test("accepts all movement commands and preserves source line numbers", () => {
  deepStrictEqual(compileProgram("# A square\r\nmove(right)\r\n\r\nmove(down )\r\nmove(left)\r\nmove(up)"), {
    ok: true,
    instructions: [
      { command: "move", argument: "right", line: 2 },
      { command: "move", argument: "down", line: 4 },
      { command: "move", argument: "left", line: 5 },
      { command: "move", argument: "up", line: 6 },
    ],
  });
});

Deno.test("parses nested indentation and dedents into the correct block", () => {
  deepStrictEqual(compileProgram("while(True):\n    move(right)\n    while(False):\n        reset()\n    move(down)\nmove(left)"), {
    ok: true,
    instructions: [
      { condition: true, line: 1, body: [
        { command: "move", argument: "right", line: 2 },
        { condition: false, line: 3, body: [{ command: "reset", line: 4 }] },
        { command: "move", argument: "down", line: 5 },
      ] },
      { command: "move", argument: "left", line: 6 },
    ],
  });
});

Deno.test("rejects malformed loops and indentation, including unreachable invalid code", () => {
  for (const source of [
    "while(true):\n    move(right)", "while(True)\n    move(right)",
    "while(True):", "while(True):\n    # no body",
    "while(True):\nmove(right)", "while(True):\n  move(right)",
    "while(True):\n\tmove(right)", "    move(right)",
    "while(False):\n    typo()", "while(True):\n        move(right)",
    "while(True):\n    move(right)\n        move(down)",
  ]) {
    strictEqual(compileProgram(source).ok, false, source);
  }
});

Deno.test("false loops skip their bodies and continue with subsequent commands", async () => {
  const program = compileProgram("while(False):\n    move(right)\n    while(True):\n        reset()\nmove(down)");
  if (!program.ok) throw new Error("Expected valid program");
  const farm = createFarm();
  const lines: number[] = [];
  const result = await runProgram(program.instructions, farm, (step) => lines.push(step.instruction.line), () => Promise.resolve());
  strictEqual(result, "complete");
  deepStrictEqual(lines, [5]);
  deepStrictEqual(farm.position, { x: 0, y: 1 });
});

Deno.test("true loops repeat in order until cancelled and leave later code unexecuted", async () => {
  const program = compileProgram("while(True):\n    move(right)\n    move(down)\nreset()");
  if (!program.ok) throw new Error("Expected valid program");
  const farm = createFarm();
  const controller = new AbortController();
  const lines: number[] = [];
  const result = await runProgram(program.instructions, farm, (step) => {
    lines.push(step.instruction.line);
    if (lines.length === 4) controller.abort();
  }, () => Promise.resolve(), controller.signal);
  strictEqual(result, "stopped");
  deepStrictEqual(lines, [2, 3, 2, 3]);
  deepStrictEqual(farm.position, { x: 2, y: 2 });
});

Deno.test("no-op true loops keep yielding and stop without moving", async () => {
  const program = compileProgram("while(True):\n    while(False):\n        move(right)");
  if (!program.ok) throw new Error("Expected valid program");
  const farm = createFarm();
  const controller = new AbortController();
  let ticks = 0;
  const result = await runProgram(program.instructions, farm, () => { throw new Error("Unexpected move"); }, (ms) => {
    strictEqual(ms, STEP_DELAY_MS);
    if (++ticks === 6) controller.abort();
    return Promise.resolve();
  }, controller.signal);
  strictEqual(result, "stopped");
  strictEqual(ticks, 6);
  deepStrictEqual(farm.position, { x: 0, y: 0 });
});

Deno.test("cancelling a pending command prevents that command from moving", async () => {
  const program = compileProgram("move(right)");
  if (!program.ok) throw new Error("Expected valid program");
  const farm = createFarm();
  const controller = new AbortController();
  let resume!: () => void;
  const running = runProgram(program.instructions, farm, () => { throw new Error("Unexpected move"); },
    () => new Promise<void>((resolve) => { resume = resolve; }), controller.signal);
  controller.abort();
  resume();
  strictEqual(await running, "stopped");
  deepStrictEqual(farm.position, { x: 0, y: 0 });
});

Deno.test("rejects the whole program and reports every invalid line", () => {
  const result = compileProgram("move(right)\ndwon()\nmove(left);\nmove(up); move(down)\nwhile true\nalert('hello')");
  strictEqual(result.ok, false);
  deepStrictEqual(result, {
    ok: false,
    errors: [
      { line: 2, source: "dwon()" },
      { line: 3, source: "move(left);" },
      { line: 4, source: "move(up); move(down)" },
      { line: 5, source: "while true" },
      { line: 6, source: "alert('hello')" },
    ],
  });
});

Deno.test("blank and comment-only programs contain no actions", () => {
  deepStrictEqual(compileProgram("\n # nothing yet\n"), { ok: true, instructions: [] });
});

Deno.test("farm has 25 coordinate tiles and starts at the upper left", () => {
  const farm = createFarm();
  strictEqual(farm.tiles.length, 5);
  strictEqual(farm.tiles.flat().length, 25);
  deepStrictEqual(farm.tiles[4][4], { x: 4, y: 4, plant: null });
  deepStrictEqual(farm.position, { x: 0, y: 0 });
});

Deno.test("all four edges clamp movement without preventing subsequent commands", () => {
  const farm = createFarm();
  strictEqual(move(farm, "up"), false);
  strictEqual(move(farm, "left"), false);
  for (let i = 0; i < 4; i++) {
    strictEqual(move(farm, "right"), true);
    strictEqual(move(farm, "down"), true);
  }
  deepStrictEqual(farm.position, { x: 4, y: 4 });
  strictEqual(move(farm, "right"), false);
  strictEqual(move(farm, "down"), false);
  strictEqual(move(farm, "left"), true);
  strictEqual(move(farm, "up"), true);
  deepStrictEqual(farm.position, { x: 3, y: 3 });
});

Deno.test("runner waits for each fixed interval and executes commands in order", async () => {
  const result = compileProgram("move(right)\nmove(down)\nmove(up)");
  if (!result.ok) throw new Error("Expected valid program");
  const farm = createFarm();
  const steps: Step[] = [];
  const waits: number[] = [];
  let release: (() => void) | undefined;
  const running = runProgram(result.instructions, farm, (step) => steps.push(step), (ms) => {
    waits.push(ms);
    return new Promise<void>((resolve) => { release = resolve; });
  });
  deepStrictEqual(farm.position, { x: 0, y: 0 });
  strictEqual(steps.length, 0);
  for (let index = 0; index < 3; index++) {
    strictEqual(waits.length, index + 1);
    release!();
    await Promise.resolve();
    strictEqual(steps.length, index + 1);
  }
  await running;
  deepStrictEqual(waits, [STEP_DELAY_MS, STEP_DELAY_MS, STEP_DELAY_MS]);
  deepStrictEqual(steps.map((step) => step.position), [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }]);
});

Deno.test("successive programs continue from the last position and reset executes in sequence", async () => {
  const farm = createFarm();
  const positions: { x: number; y: number }[] = [];
  const run = async (source: string) => {
    const program = compileProgram(source);
    if (!program.ok) throw new Error("Expected valid program");
    await runProgram(program.instructions, farm, (step) => positions.push(step.position), () => Promise.resolve());
  };
  await run("move(right)\nmove(down)");
  await run("move(right)\nreset()\nmove(down)\nreset()\nreset()");
  deepStrictEqual(positions, [
    { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 },
    { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 0 }, { x: 0, y: 0 },
  ]);
});

