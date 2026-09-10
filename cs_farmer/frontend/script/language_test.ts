import { deepStrictEqual, strictEqual, match } from "node:assert";
import { compileProgram, runProgram, createFarm, type Step } from "./program.ts";
import { resetField, plant, getDirection, getPosition, getXCord, getYCord } from "./farm.ts";
import { parseExpression, evaluateExpression, formatValue } from "./expressions.ts";

Deno.test("reset_field clears every crop and position without changing inventories or balance", () => {
  const farm = createFarm();
  farm.balance = 2.5;
  farm.seeds.tomato = 3;
  farm.harvest.wheat = 7;
  for (const row of farm.tiles) for (const tile of row) {
    farm.position = { x: tile.x, y: tile.y };
    plant(farm, "wheat", 0);
  }
  resetField(farm);
  strictEqual(farm.tiles.flat().every((tile) => tile.plant === null), true);
  deepStrictEqual(farm.position, { x: 0, y: 0 });
  strictEqual(farm.balance, 2.5);
  strictEqual(farm.seeds.tomato, 3);
  strictEqual(farm.seeds.wheat, Infinity);
  strictEqual(farm.harvest.wheat, 7);
  resetField(farm);
  strictEqual(farm.harvest.wheat, 7);
});

Deno.test("position getters return values without exposing mutable position state", () => {
  const farm = createFarm();
  farm.position = { x: 2, y: 3 };
  const coordinates = getPosition(farm);
  deepStrictEqual(coordinates, [2, 3]);
  strictEqual(getXCord(farm), 2);
  strictEqual(getYCord(farm), 3);
  farm.direction = "up";
  strictEqual(getDirection(farm), "up");
  coordinates[0] = 0;
  strictEqual(farm.position.x, 2);
});

Deno.test("if true runs once, if false skips, and nested blocks dedent correctly", async () => {
  const result = compileProgram('if(True):\n    move()\n    if(False):\n        reset_field()\n    if(True):\n        direction(down)\n        move()\nif(False):\n    while(True):\n        reset()\nmove()');
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  const farm = createFarm(5);
  const lines: number[] = [];
  let ticks = 0;
  const outcome = await runProgram(result.instructions, farm, (step) => lines.push(step.instruction.line), () => {
    if (++ticks > 20) throw new Error("if must not repeat");
    return Promise.resolve();
  });
  strictEqual(outcome, "complete");
  deepStrictEqual(lines, [2, 6, 7, 11]);
  deepStrictEqual(farm.position, { x: 1, y: 2 });
});

Deno.test("if inside while repeats per iteration and remains cancellable", async () => {
  const result = compileProgram('while(True):\n    if(True):\n        move()\n    if(False):\n        reset_field()');
  if (!result.ok) throw new Error("Expected valid program");
  const farm = createFarm(5);
  const controller = new AbortController();
  let moves = 0;
  const outcome = await runProgram(result.instructions, farm, () => {
    if (++moves === 3) controller.abort();
  }, () => Promise.resolve(), controller.signal);
  strictEqual(outcome, "stopped");
  deepStrictEqual(farm.position, { x: 3, y: 0 });
});

Deno.test("print accepts both quote styles, escapes, empty strings, and literal data", () => {
  const farm = createFarm();
  for (const [source, expected] of [
    ['"hello"', 'hello'], ["'hello'", 'hello'], ['""', ''],
    ['"a\\nb\\tc"', 'a\nb\tc'], ['"a \\"quote\\""', 'a "quote"'],
    ["'it\\'s fine'", "it's fine"], ['"C:\\\\farm"', 'C:\\farm'],
    ['"<script>alert(1)</script>"', '<script>alert(1)</script>'],
    ['"# ) :"', '# ) :'], ['True', 'True'], ['2.5', '2.5'],
  ]) {
    const expression = parseExpression(source);
    if (!expression) throw new Error(`Rejected ${source}`);
    strictEqual(formatValue(evaluateExpression(expression, farm)), expected);
  }
});

Deno.test("getters used by print are evaluated at execution time before and after field reset", async () => {
  const result = compileProgram('plant(wheat)\nmove()\nprint(get_position())\ndirection(down)\nprint(get_direction())\nmove()\nprint(get_x_cord())\nprint(get_y_cord())\nreset_field()\nprint(get_position())\nprint(get_direction())\nprint("done")');
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  const farm = createFarm(5);
  const outputs: string[] = [];
  const outcome = await runProgram(result.instructions, farm, (step: Step) => {
    if (step.output !== undefined) outputs.push(step.output);
  }, () => Promise.resolve(), undefined, () => 100);
  strictEqual(outcome, "complete");
  deepStrictEqual(outputs, ["(1, 0)", "down", "1", "1", "(0, 0)", "right", "done"]);
  strictEqual(farm.tiles.flat().every((tile) => tile.plant === null), true);
});

Deno.test("invalid if/print/getter input rejects the whole program including skipped branches", () => {
  for (const source of [
    'if(True):', 'if(False):\n    # empty', 'if(True):\nmove()', 'if(true):\n    move()',
    'if(1):\n    move()', 'if(False):\n    print(unquoted)',
    'print()', 'print(hello)', 'print("missing)', 'print("a", "b")', 'print(move())',
    'get_position(1)', 'get_x_cord(1)', 'get_y_cord(1)', 'reset_field(1)',
    'print("bad\\q")',
  ]) {
    const result = compileProgram('move()\n' + source);
    strictEqual(result.ok, false, source);
  }
  const result = compileProgram('if(True):');
  if (result.ok) throw new Error("Expected rejection");
  match(result.errors[0].message!, /if body/);
});
import { parseCondition, evaluateCondition } from "./expressions.ts";

Deno.test("all six comparisons handle equal, lower, and greater values", () => {
  const farm = createFarm();
  const expected: Record<string, boolean[]> = {
    "==": [false, true, false], "!=": [true, false, true],
    "<": [true, false, false], "<=": [true, true, false],
    ">": [false, false, true], ">=": [false, true, true],
  };
  for (const [operator, answers] of Object.entries(expected)) {
    [1, 2, 3].forEach((x, index) => {
      farm.position.x = x;
      const condition = parseCondition(`get_x_cord() ${operator} 2`);
      if (condition === undefined) throw new Error("Expected comparison");
      strictEqual(evaluateCondition(condition, farm), answers[index]);
    });
  }
  for (const source of ["-2.5 < 0", "get_x_cord() > get_y_cord()", "2 <= 2", "True"]) {
    const condition = parseCondition(source);
    if (condition === undefined) throw new Error(source);
    strictEqual(evaluateCondition(condition, farm), true, source);
  }
});

Deno.test("while re-evaluates coordinates and exits; if checks the final position once", async () => {
  const result = compileProgram('while(get_x_cord() < 4):\n    move()\nif(get_x_cord() == 4):\n    print("edge")\nwhile(get_y_cord() != get_x_cord()):\n    direction(down)\n    move()');
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  const farm = createFarm(5);
  const output: string[] = [];
  let ticks = 0;
  await runProgram(result.instructions, farm, (step) => {
    if (step.output !== undefined) output.push(step.output);
  }, () => {
    if (++ticks > 30) throw new Error("Comparison loop failed to exit");
    return Promise.resolve();
  });
  deepStrictEqual(farm.position, { x: 4, y: 4 });
  deepStrictEqual(output, ["edge"]);
});

Deno.test("false comparison skips the block and comparisons reflect changes after compilation", async () => {
  const result = compileProgram('if(get_y_cord() >= 3):\n    print("yes")\nwhile(get_x_cord() > 4):\n    direction(left)\n    move()');
  if (!result.ok) throw new Error("Expected valid program");
  const farm = createFarm();
  farm.position.y = 3;
  const steps: Step[] = [];
  await runProgram(result.instructions, farm, (step) => steps.push(step), () => Promise.resolve());
  strictEqual(steps.length, 1);
  strictEqual(steps[0].output, "yes");
});

Deno.test("missing move direction and malformed comparisons reject the entire program", () => {
  for (const source of [
    "move(right)", "direction()", "if(get_x_cord() === 2):\n    reset()",
    "if(1 < 2 < 3):\n    reset()", "if(1 <):\n    reset()",
    "if(1 = 1):\n    reset()", "if(1 => 1):\n    reset()",
    "if(get_position() == 2):\n    reset()", 'if("2" == 2):\n    reset()',
    "if(True == 1):\n    reset()", "if(1 < 2 and):\n    reset()",
    "while(get_x_cord()):\n    reset()", "if(False):\n    move(right)",
  ]) strictEqual(compileProgram('plant(wheat)\n' + source).ok, false, source);
});
Deno.test("logical words and symbols have matching truth tables and precedence", () => {
  const farm = createFarm();
  for (const a of [false, true]) for (const b of [false, true]) {
    for (const operator of ["and", "&", "or", "|"]) {
      const condition = parseCondition(`${a ? "True" : "False"} ${operator} ${b ? "True" : "False"}`);
      if (condition === undefined) throw new Error("Expected condition");
      strictEqual(evaluateCondition(condition, farm), operator === "and" || operator === "&" ? a && b : a || b);
    }
  }
  for (const [source, expected] of [
    ["True or False and False", true], ["(True or False) and False", false],
    ["True|False&False", true], ["(True|False)&False", false],
    ["get_x_cord() == 0 & (get_y_cord() < 2 or False)", true],
    ["((True))", true],
  ] as const) {
    const condition = parseCondition(source);
    if (condition === undefined) throw new Error(source);
    strictEqual(evaluateCondition(condition, farm), expected, source);
  }
});

Deno.test("logical evaluation short circuits but parsing validates skipped operands", () => {
  const farm = createFarm();
  Object.defineProperty(farm.position, "x", { get: () => { throw new Error("Should not evaluate x"); } });
  for (const source of ["False and get_x_cord() == 0", "True or get_x_cord() == 0"]) {
    const condition = parseCondition(source);
    if (condition === undefined) throw new Error(source);
    strictEqual(evaluateCondition(condition, farm), source.startsWith("True"));
  }
  strictEqual(parseCondition("True or unknown() == 1"), undefined);
});

Deno.test("nested else binds at its indentation and executes only the chosen branch", async () => {
  const result = compileProgram('if(True):\n    if(False):\n        print("wrong inner")\n    else:\n        print("inner")\nelse:\n    print("wrong outer")\nif(False):\n    print("wrong")\n\n# before else\nelse:\n    print("outer")\nprint("done")');
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  const output: string[] = [];
  let ticks = 0;
  await runProgram(result.instructions, createFarm(), (step) => {
    if (step.output !== undefined) output.push(step.output);
  }, () => { if (++ticks > 20) throw new Error("Branch repeated"); return Promise.resolve(); });
  deepStrictEqual(output, ["inner", "outer", "done"]);
});

Deno.test("compound while and if else use current state each iteration", async () => {
  const result = compileProgram('while(get_x_cord() < 2 | get_y_cord() < 2):\n    if(get_x_cord() < 2 & True):\n        move()\n    else:\n        direction(down)\n        move()\nprint(get_position())');
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  const farm = createFarm(5);
  let ticks = 0;
  await runProgram(result.instructions, farm, () => {}, () => {
    if (++ticks > 20) throw new Error("Loop failed to exit");
    return Promise.resolve();
  });
  deepStrictEqual(farm.position, { x: 2, y: 2 });
});

Deno.test("malformed logical operators and misplaced else reject the entire program", () => {
  for (const source of [
    "if(True && False):\n    reset()", "if(True || False):\n    reset()",
    "if(True and):\n    reset()", "if(or False):\n    reset()",
    "if((True or False):\n    reset()", "if(True) or False):\n    reset()",
    "if(TrueorFalse):\n    reset()", "if(True and or False):\n    reset()",
    "else:\n    reset()", "while(False):\n    reset()\nelse:\n    reset()",
    "if(True):\n    reset()\nelse:",
    "if(True):\n    reset()\nelse:\n    # no body",
    "if(True):\n    reset()\nelse:\nreset()",
    "if(True):\n    reset()\nelse:\n    reset()\nelse:\n    reset()",
    "if(True):\n    reset()\nmove()\nelse:\n    reset()",
    "if(True):\n    reset()\nelse:\n    typo()",
    "if(True):\n    reset()\nelse(False):\n    reset()",
  ]) strictEqual(compileProgram('plant(wheat)\n' + source).ok, false, source);
});
