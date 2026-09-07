import { deepStrictEqual, strictEqual } from "node:assert";
import { createFarm, plant, harvest } from "./farm.ts";
import { Plant, Wheat, Tomato, Cucumber, plantNames, plantInfo } from "./plants.ts";
import { compileProgram, runProgram } from "./program.ts";

Deno.test("starting inventory and plant definitions match the specification", () => {
  const farm = createFarm();
  strictEqual(farm.balance, 0);
  deepStrictEqual(farm.seeds, { wheat: Infinity, tomato: 0, cucumber: 0 });
  deepStrictEqual(farm.harvest, { wheat: 0, tomato: 0, cucumber: 0 });
  const crops = [new Wheat(0), new Tomato(0), new Cucumber(0)];
  deepStrictEqual(crops.map((crop) => [crop.name, crop.seedPrice, crop.growthTime, crop.sellingPrice]),
    [["wheat", 0, 0.5, 0.5], ["tomato", 0.2, 1, 2], ["cucumber", 0.5, 2, 4]]);
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
    harvest(farm, 5000 + duration);
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
  strictEqual(farm.tiles[0][0].plant!.isGrown(499), false);
  strictEqual(farm.tiles[0][0].plant!.isGrown(500), true);
  harvest(farm, 5000);
  plant(farm, "wheat", 6000);
  strictEqual(farm.seeds.wheat, Infinity);
  strictEqual(farm.harvest.wheat, 1);
});

Deno.test("new command grammar defaults move to right and rejects old or invalid calls", () => {
  deepStrictEqual(compileProgram("move()\nmove( left )\nplant(cucumber)\nharvest()"), {
    ok: true, instructions: [
      { command: "move", argument: "right", line: 1 },
      { command: "move", argument: "left", line: 2 },
      { command: "plant", argument: "cucumber", line: 3 },
      { command: "harvest", line: 4 },
    ],
  });
  for (const source of ["right()", "left()", "up()", "down()", "move(diagonal)", "move(right,left)", "plant()", "plant(potato)", "harvest(wheat)"]) {
    strictEqual(compileProgram(source).ok, false, source);
  }
});

Deno.test("runner grows wheat between commands and preserves crops across reset and runs", async () => {
  const farm = createFarm();
  let now = 0;
  const run = async (source: string) => {
    const result = compileProgram(source);
    if (!result.ok) throw new Error("Expected valid program");
    await runProgram(result.instructions, farm, () => {}, (ms) => { now += ms; return Promise.resolve(); }, undefined, () => now);
  };
  await run("plant(wheat)\nmove()");
  strictEqual(farm.tiles[0][0].plant!.name, "wheat");
  await run("reset()\nharvest()");
  strictEqual(farm.harvest.wheat, 1);
  strictEqual(farm.balance, 0);
  strictEqual(farm.seeds.wheat, Infinity);
});
