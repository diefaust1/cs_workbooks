import { deepStrictEqual, strictEqual } from "node:assert";
import {
  compileProgram,
  createFarm,
  move,
  runProgram,
  type Step,
  STEP_DELAY_MS,
} from "./program.ts";

Deno.test("movement grammar and source lines distinguish turning from moving", () => {
  deepStrictEqual(
    compileProgram("# start\nmove()\n\ndirection( down )\nmove()"),
    {
      ok: true,
      instructions: [
        { command: "move", line: 2 },
        { command: "direction", argument: "down", line: 4 },
        { command: "move", line: 5 },
      ],
    },
  );
  for (
    const code of [
      "move(right)",
      "direction()",
      "direction(diagonal)",
      "direction(right, left)",
      "right()",
    ]
  ) strictEqual(compileProgram(code).ok, false);
});
Deno.test("whole program validation rejects invalid lines and malformed indentation", () => {
  const result = compileProgram("move()\nwrong()\nmove(right)");
  deepStrictEqual(result, {
    ok: false,
    errors: [{ line: 2, source: "wrong()" }, {
      line: 3,
      source: "move(right)",
    }],
  });
  for (
    const code of [
      "while(True):",
      "while(true):\n    move()",
      "while(True):\nmove()",
      "while(True):\n  move()",
      "while(True):\n\tmove()",
      "    move()",
    ]
  ) strictEqual(compileProgram(code).ok, false);
  deepStrictEqual(compileProgram("# comment\n\n"), {
    ok: true,
    instructions: [],
  });
});
Deno.test("farm starts facing right and clamps all edges", () => {
  const farm = createFarm(5);
  strictEqual(farm.tiles.flat().length, 25);
  deepStrictEqual(farm.position, { x: 0, y: 0 });
  strictEqual(farm.direction, "right");
  for (const direction of ["up", "left", "down", "right"] as const) {
    farm.direction = direction;
    for (let i = 0; i < 5; i++) move(farm);
    strictEqual(move(farm), false);
  }
  deepStrictEqual(farm.position, { x: 4, y: 4 });
});
Deno.test("turns do not move, facing persists between runs, and resets restore right", async () => {
  const farm = createFarm(5);
  const run = async (code: string) => {
    const result = compileProgram(code);
    if (!result.ok) throw new Error("Invalid test program");
    await runProgram(
      result.instructions,
      farm,
      () => {},
      () => Promise.resolve(),
    );
  };
  await run("move()\ndirection(down)");
  deepStrictEqual(farm.position, { x: 1, y: 0 });
  await run("move()\nmove()");
  deepStrictEqual(farm.position, { x: 1, y: 2 });
  for (const reset of ["reset()", "reset_field()"]) {
    for (const direction of ["up", "down", "left"]) {
      await run(`direction(${direction})\n${reset}`);
      deepStrictEqual(farm.position, { x: 0, y: 0 });
      strictEqual(farm.direction, "right");
      await run("move()");
      deepStrictEqual(farm.position, { x: 1, y: 0 });
    }
  }
});
Deno.test("turning and movement each wait one fixed interval", async () => {
  const result = compileProgram("direction(down)\nmove()");
  if (!result.ok) throw new Error("Invalid test program");
  const farm = createFarm(5);
  const steps: Step[] = [];
  let release!: () => void;
  const waits: number[] = [];
  const running = runProgram(
    result.instructions,
    farm,
    (step) => steps.push(step),
    (ms) => {
      waits.push(ms);
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    },
  );
  strictEqual(farm.direction, "right");
  release();
  await Promise.resolve();
  strictEqual(farm.direction, "down");
  deepStrictEqual(farm.position, { x: 0, y: 0 });
  release();
  await running;
  deepStrictEqual(farm.position, { x: 0, y: 1 });
  deepStrictEqual(waits, [STEP_DELAY_MS, STEP_DELAY_MS]);
  strictEqual(steps.length, 2);
});
Deno.test("Stop cancels a pending turn before it changes facing", async () => {
  const result = compileProgram("direction(left)");
  if (!result.ok) throw new Error("Invalid test program");
  const farm = createFarm();
  const controller = new AbortController();
  let release!: () => void;
  const running = runProgram(result.instructions, farm, () => {
    throw new Error("Unexpected turn");
  }, () =>
    new Promise<void>((resolve) => {
      release = resolve;
    }), controller.signal);
  controller.abort();
  release();
  strictEqual(await running, "stopped");
  strictEqual(farm.direction, "right");
});
Deno.test("true loops with only false loops keep yielding and can be stopped", async () => {
  const result = compileProgram(
    "while(True):\n    while(False):\n        move()",
  );
  if (!result.ok) throw new Error("Invalid test program");
  const farm = createFarm();
  const controller = new AbortController();
  let ticks = 0;
  strictEqual(
    await runProgram(result.instructions, farm, () => {
      throw new Error("Unexpected move");
    }, () => {
      if (++ticks === 6) controller.abort();
      return Promise.resolve();
    }, controller.signal),
    "stopped",
  );
  deepStrictEqual(farm.position, { x: 0, y: 0 });
});

Deno.test("for range(count) repeats a body without exposing its loop name", async () => {
  const result = compileProgram("for i in range (3):\n    move()");
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  deepStrictEqual(result.instructions, [{
    kind: "for",
    count: 3,
    body: [{ command: "move", line: 2 }],
    line: 1,
  }]);
  const farm = createFarm(5);
  await runProgram(
    result.instructions,
    farm,
    () => {},
    () => Promise.resolve(),
  );
  deepStrictEqual(farm.position, { x: 3, y: 0 });
  for (
    const source of [
      "for i in range(2, 5):\n    move()",
      "for i in range(10, 0, -2):\n    move()",
      "for i in range(-1):\n    move()",
      "for i in range(2):\n    print(i)",
    ]
  ) strictEqual(compileProgram(source).ok, false, source);
});

Deno.test("break exits the nearest enclosing while or for loop", async () => {
  const result = compileProgram(
    "for i in range(3):\n    while(True):\n        move()\n        break()\n    direction(down)\n    move()\n    if(True):\n        break()\n    move()\ndirection(right)\nmove()",
  );
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  const farm = createFarm(5);
  await runProgram(
    result.instructions,
    farm,
    () => {},
    () => Promise.resolve(),
  );
  deepStrictEqual(farm.position, { x: 2, y: 1 });
  for (
    const source of [
      "break()",
      "if(True):\n    break()",
    ]
  ) strictEqual(compileProgram(source).ok, false, source);
});
