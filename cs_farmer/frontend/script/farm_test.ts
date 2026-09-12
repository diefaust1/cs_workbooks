import { deepStrictEqual, strictEqual } from "node:assert";
import {
  createFarm,
  expandField,
  getExpansionCost,
  harvest,
  MAX_FIELD_SIZE,
  plant,
} from "./farm.ts";
import {
  Cucumber,
  Plant,
  plantInfo,
  plantNames,
  Tomato,
  Watermelon,
  Wheat,
} from "./plants.ts";
import { buy } from "./farm.ts";
import { compileProgram, runProgram } from "./program.ts";

Deno.test("starting inventory and plant definitions match the specification", () => {
  const farm = createFarm();
  strictEqual(farm.size, 1);
  strictEqual(farm.tiles.flat().length, 1);
  strictEqual(farm.balance, 0);
  deepStrictEqual(farm.seeds, {
    wheat: Infinity,
    tomato: 0,
    cucumber: 0,
    watermelon: 0,
  });
  deepStrictEqual(farm.harvest, {
    wheat: 0,
    tomato: 0,
    cucumber: 0,
    watermelon: 0,
  });
  const crops = [
    new Wheat(0),
    new Tomato(0),
    new Cucumber(0),
    new Watermelon(0),
  ];
  deepStrictEqual(
    crops.map((
      crop,
    ) => [
      crop.name,
      crop.seedPrice,
      crop.growthTime,
      crop.sellingPrice,
      crop.wither,
    ]),
    [["wheat", 0, 0.6, 0.5, 0], ["tomato", 0.2, 2, 2, 5], [
      "cucumber",
      0.5,
      4,
      5,
      5,
    ], ["watermelon", 2, 10, 8, 10]],
  );
  strictEqual(crops.every((crop) => crop instanceof Plant), true);
});

Deno.test("missing seeds and occupied tiles leave inventories and crops unchanged", () => {
  const farm = createFarm();
  strictEqual(plant(farm, "tomato", 0).success, false);
  strictEqual(farm.tiles[0][0].plant, null);
  farm.seeds.tomato = 2;
  strictEqual(plant(farm, "tomato", 0).success, true);
  strictEqual(farm.seeds.tomato, 1);
  const crop = farm.tiles[0][0].plant;
  strictEqual(plant(farm, "tomato", 100).success, false);
  strictEqual(farm.seeds.tomato, 1);
  strictEqual(farm.tiles[0][0].plant, crop);
});

Deno.test("harvest destroys early crops and credits mature crops exactly at their growth time", () => {
  for (const name of plantNames) {
    const farm = createFarm();
    farm.seeds[name] = 2;
    const duration = plantInfo[name].growthTime * 1000;
    plant(farm, name, 100);
    harvest(farm, 100 + duration - 1);
    strictEqual(farm.harvest[name], 0);
    strictEqual(farm.tiles[0][0].plant, null);
    plant(farm, name, 5000);
    harvest(farm, 5000 + duration, () => 1);
    strictEqual(farm.harvest[name], 1);
    strictEqual(farm.tiles[0][0].plant, null);
    strictEqual(harvest(farm, 10000).success, false);
    strictEqual(farm.harvest[name], 1);
    strictEqual(farm.balance, 0);
  }
});

Deno.test("growth uses elapsed time and unlimited wheat never runs out", () => {
  const farm = createFarm();
  plant(farm, "wheat", 0);
  strictEqual(farm.tiles[0][0].plant!.isGrown(599), false);
  strictEqual(farm.tiles[0][0].plant!.isGrown(600), true);
  harvest(farm, 5000);
  plant(farm, "wheat", 6000);
  strictEqual(farm.seeds.wheat, Infinity);
  strictEqual(farm.harvest.wheat, 1);
});

Deno.test("withering resolves once at maturity and withered crops yield nothing", () => {
  const crop = new Tomato(100);
  let rolls = 0;
  strictEqual(
    crop.resolveWither(2099, () => {
      rolls++;
      return 0;
    }),
    "pending",
  );
  strictEqual(
    crop.resolveWither(2100, () => {
      rolls++;
      return 0.01;
    }),
    "withered",
  );
  strictEqual(
    crop.resolveWither(5000, () => {
      rolls++;
      return 1;
    }),
    "withered",
  );
  strictEqual(rolls, 1);

  const farm = createFarm();
  farm.seeds.tomato = 1;
  plant(farm, "tomato", 0);
  strictEqual(
    harvest(farm, 2000, () => 0).message,
    "Removed withered tomato; nothing added to harvest.",
  );
  strictEqual(farm.harvest.tomato, 0);
  strictEqual(farm.tiles[0][0].plant, null);
});

Deno.test("buy validates funds and adds seeds atomically", () => {
  const farm = createFarm();
  farm.balance = 5;
  strictEqual(buy(farm, "tomato", 3).success, true);
  strictEqual(farm.balance, 4.4);
  strictEqual(farm.seeds.tomato, 3);
  strictEqual(buy(farm, "watermelon", 3).success, false);
  strictEqual(farm.balance, 4.4);
  strictEqual(farm.seeds.watermelon, 0);
  for (const amount of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    strictEqual(buy(farm, "cucumber", amount).success, false);
  }
  strictEqual(buy(farm, "wheat", 10).success, true);
  strictEqual(farm.seeds.wheat, Infinity);
});

Deno.test("harvesting any tile in the largest healthy watermelon square removes it and multiplies yield", () => {
  for (
    const [size, expected] of [[2, 8], [3, 18], [4, 32], [5, 75], [
      6,
      108,
    ]] as const
  ) {
    const farm = createFarm(size);
    farm.seeds.watermelon = size * size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        farm.position = { x, y };
        plant(farm, "watermelon", 0);
      }
    }
    farm.position = { x: Math.floor(size / 2), y: Math.floor(size / 2) };
    strictEqual(harvest(farm, 10000, () => 1).success, true);
    strictEqual(farm.harvest.watermelon, expected);
    strictEqual(farm.tiles.flat().every((tile) => tile.plant === null), true);
  }
});

Deno.test("a withered watermelon prevents an unhealthy square from merging", () => {
  const farm = createFarm(2);
  farm.seeds.watermelon = 4;
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      farm.position = { x, y };
      plant(farm, "watermelon", 0);
    }
  }
  farm.tiles[0][0].plant!.witherState = "withered";
  farm.position = { x: 1, y: 1 };
  harvest(farm, 10000, () => 1);
  strictEqual(farm.harvest.watermelon, 1);
  strictEqual(farm.tiles.flat().filter((tile) => tile.plant).length, 3);
});

Deno.test("new command grammar requires an explicit direction and rejects old or invalid calls", () => {
  deepStrictEqual(
    compileProgram(
      "move()\ndirection( left )\nbuy(watermelon, 2)\nplant(cucumber)\nharvest()",
    ),
    {
      ok: true,
      instructions: [
        { command: "move", line: 1 },
        { command: "direction", argument: "left", line: 2 },
        { command: "buy", argument: "watermelon", quantity: 2, line: 3 },
        { command: "plant", argument: "cucumber", line: 4 },
        { command: "harvest", line: 5 },
      ],
    },
  );
  for (
    const source of [
      "right()",
      "left()",
      "up()",
      "down()",
      "move(diagonal)",
      "move(right,left)",
      "plant()",
      "plant(potato)",
      "harvest(wheat)",
    ]
  ) {
    strictEqual(compileProgram(source).ok, false, source);
  }
});

Deno.test("runner grows wheat between commands and preserves crops across reset and runs", async () => {
  const farm = createFarm();
  let now = 0;
  const run = async (source: string) => {
    const result = compileProgram(source);
    if (!result.ok) throw new Error("Expected valid program");
    await runProgram(
      result.instructions,
      farm,
      () => {},
      (ms) => {
        now += ms;
        return Promise.resolve();
      },
      undefined,
      () => now,
    );
  };
  await run("plant(wheat)\nmove()");
  strictEqual(farm.tiles[0][0].plant!.name, "wheat");
  await run("reset()\nharvest()");
  strictEqual(farm.harvest.wheat, 1);
  strictEqual(farm.balance, 0);
  strictEqual(farm.seeds.wheat, Infinity);
});
import { isHarvestable, sell } from "./farm.ts";

Deno.test("harvestability checks selected tile and exact maturity without mutating it", () => {
  const farm = createFarm(5);
  strictEqual(isHarvestable(farm, 1000), false);
  plant(farm, "wheat", 100);
  strictEqual(isHarvestable(farm, 699), false);
  strictEqual(isHarvestable(farm, 700), true);
  strictEqual(farm.harvest.wheat, 0);
  farm.position.x = 1;
  strictEqual(isHarvestable(farm, 600), false);
  farm.position.x = 0;
  harvest(farm, 700);
  strictEqual(isHarvestable(farm, 700), false);
});

Deno.test("field expansions charge increasing powers of five and stop at 6 x 6", () => {
  const farm = createFarm();
  plant(farm, "wheat", 100);
  const originalPlant = farm.tiles[0][0].plant;
  strictEqual(getExpansionCost(farm), 4);
  strictEqual(expandField(farm).success, false);
  strictEqual(farm.size, 1);
  farm.balance = 1364;
  for (
    const [size, cost] of [[2, 4], [3, 16], [4, 64], [5, 256], [
      6,
      1024,
    ]] as const
  ) {
    const before = farm.balance;
    strictEqual(getExpansionCost(farm), cost);
    strictEqual(expandField(farm).success, true);
    strictEqual(farm.size, size);
    strictEqual(farm.tiles.length, size);
    strictEqual(farm.tiles.every((row) => row.length === size), true);
    strictEqual(farm.balance, before - cost);
    strictEqual(farm.tiles[0][0].plant, originalPlant);
  }
  strictEqual(farm.size, MAX_FIELD_SIZE);
  strictEqual(getExpansionCost(farm), undefined);
  strictEqual(expandField(farm).success, false);
});

Deno.test("selling each crop credits its price and removes only sold harvest", () => {
  for (const name of plantNames) {
    const farm = createFarm();
    farm.balance = 1.25;
    farm.harvest[name] = 5;
    strictEqual(sell(farm, name, 2).success, true);
    strictEqual(farm.balance, 1.25 + 2 * plantInfo[name].sellingPrice);
    strictEqual(farm.harvest[name], 3);
    strictEqual(farm.seeds.wheat, Infinity);
    strictEqual(farm.seeds.tomato, 0);
    strictEqual(sell(farm, name, 3).success, true);
    strictEqual(farm.harvest[name], 0);
  }
});

Deno.test("insufficient or invalid sales are atomic; selling zero is a no-op", () => {
  const farm = createFarm();
  farm.harvest.wheat = 2;
  for (
    const amount of [3, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]
  ) {
    strictEqual(sell(farm, "wheat", amount).success, false);
    strictEqual(farm.harvest.wheat, 2);
    strictEqual(farm.balance, 0);
  }
  strictEqual(sell(farm, "wheat", 0).success, true);
  strictEqual(farm.harvest.wheat, 2);
  strictEqual(farm.balance, 0);
  for (let i = 0; i < 2; i++) sell(farm, "wheat", 1);
  strictEqual(farm.balance, 1);
});

Deno.test("harvestability is usable in conditions, logical combinations, print, and standalone calls", async () => {
  const result = compileProgram(
    "print(is_harvestable())\nplant(wheat)\nget_direction()\nif(is_harvestable() & get_x_cord() == 0):\n    harvest()\nelse:\n    reset_field()\nsell(wheat, 1)\nis_harvestable()",
  );
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  const farm = createFarm();
  let now = 0;
  const messages: string[] = [];
  await runProgram(
    result.instructions,
    farm,
    (step) => messages.push(step.message),
    (ms) => {
      now += ms;
      return Promise.resolve();
    },
    undefined,
    () => now,
  );
  strictEqual(messages[0], "False");
  strictEqual(messages[messages.length - 1], "False");
  strictEqual(farm.balance, 0.5);
  strictEqual(farm.harvest.wheat, 0);
});

Deno.test("harvest inventory getter works standalone, in print, and in numeric conditions", async () => {
  const result = compileProgram(
    'get_inventory(wheat)\nprint(get_inventory(tomato))\nif(get_inventory(cucumber) >= 2):\n    print("enough")',
  );
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  const farm = createFarm();
  farm.harvest = { wheat: 3, tomato: 4, cucumber: 2, watermelon: 0 };
  const messages: string[] = [];
  const outputs: string[] = [];
  await runProgram(result.instructions, farm, (step) => {
    messages.push(step.message);
    if (step.output !== undefined) outputs.push(step.output);
  }, () => Promise.resolve());
  deepStrictEqual(messages, ["3", "4", "enough"]);
  deepStrictEqual(outputs, ["4", "enough"]);
});

Deno.test("while harvestability rechecks the crop after harvesting", async () => {
  const result = compileProgram("while(is_harvestable()):\n    harvest()");
  if (!result.ok) throw new Error("Expected valid program");
  const farm = createFarm();
  plant(farm, "wheat", 0);
  let checks = 0;
  await runProgram(
    result.instructions,
    farm,
    () => {},
    () => {
      if (++checks > 4) throw new Error("Loop did not exit");
      return Promise.resolve();
    },
    undefined,
    () => 600,
  );
  strictEqual(farm.harvest.wheat, 1);
});

Deno.test("invalid selling and harvestability syntax reject the whole program", () => {
  for (
    const source of [
      "sell()",
      "sell(wheat)",
      "sell(wheat, -1)",
      "sell(wheat, 1.5)",
      'sell(wheat, "2")',
      "sell(potato, 2)",
      "sell(wheat, 2, 3)",
      "buy()",
      "buy(watermelon)",
      "buy(watermelon, -1)",
      "buy(potato, 2)",
      "sell(wheat, 9007199254740992)",
      "is_harvestable(1)",
      "get_inventory()",
      "get_inventory(potato)",
      "get_inventory(wheat, tomato)",
      "if(is_harvestable() > 0):\n    harvest()",
    ]
  ) strictEqual(compileProgram("plant(wheat)\n" + source).ok, false, source);
  strictEqual(compileProgram("sell( wheat , 0 )").ok, true);
});
