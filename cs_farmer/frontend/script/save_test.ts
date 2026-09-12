import { deepStrictEqual, match, strictEqual, throws } from "node:assert";
import { createFarm, plant } from "./farm.ts";
import { parseSaveFile, serializeGame } from "./save.ts";

Deno.test("save files round-trip the complete game state and editor code", () => {
  const farm = createFarm(5);
  farm.balance = 12.5;
  farm.position = { x: 3, y: 4 };
  farm.direction = "left";
  farm.seeds.tomato = 7;
  farm.seeds.cucumber = 2;
  farm.harvest = { wheat: 9, tomato: 4, cucumber: 1, watermelon: 6 };
  farm.position = { x: 1, y: 2 };
  plant(farm, "wheat", 100);
  farm.position = { x: 4, y: 3 };
  farm.seeds.tomato = 7;
  plant(farm, "tomato", 100);
  farm.position = { x: 3, y: 4 };

  farm.tiles[2][1].plant!.witherState = "healthy";
  farm.tiles[3][4].plant!.witherState = "withered";
  const json = serializeGame(farm, "move()\nplant(wheat)");
  const raw = JSON.parse(json);
  strictEqual(raw.version, 3);
  strictEqual(raw.fieldSize, 5);
  strictEqual(raw.balanceCents, 1250);
  strictEqual(raw.seeds.wheat, "unlimited");
  strictEqual(raw.tiles, undefined);
  strictEqual(raw.plants.length, 2);
  deepStrictEqual(
    raw.plants.map((crop: { witherState: string }) => crop.witherState),
    ["healthy", "withered"],
  );

  const loaded = parseSaveFile(json, 5000);
  strictEqual(loaded.farm.balance, 12.5);
  deepStrictEqual(loaded.farm.position, { x: 3, y: 4 });
  strictEqual(loaded.farm.direction, "left");
  deepStrictEqual(loaded.farm.seeds, {
    wheat: Infinity,
    tomato: 6,
    cucumber: 2,
    watermelon: 0,
  });
  deepStrictEqual(loaded.farm.harvest, {
    wheat: 9,
    tomato: 4,
    cucumber: 1,
    watermelon: 6,
  });
  strictEqual(loaded.editorCode, "move()\nplant(wheat)");
  strictEqual(loaded.farm.tiles[2][1].plant?.name, "wheat");
  strictEqual(loaded.farm.tiles[3][4].plant?.name, "tomato");
  strictEqual(loaded.farm.tiles[2][1].plant?.witherState, "healthy");
  strictEqual(loaded.farm.tiles[3][4].plant?.witherState, "withered");
  strictEqual(loaded.farm.tiles[2][1].plant?.plantedAt, 5000);
  strictEqual(loaded.farm.tiles[2][1].plant?.isGrown(5000), false);
});

Deno.test("invalid save files are rejected before creating loaded state", () => {
  const valid = JSON.parse(serializeGame(createFarm(), ""));
  const invalid: Array<[string, unknown]> = [
    ["bad JSON", "{"],
    ["wrong format", { ...valid, format: "other" }],
    ["wrong version", { ...valid, version: 4 }],
    ["invalid field size", { ...valid, fieldSize: 7 }],
    ["fractional money", { ...valid, balanceCents: 1.5 }],
    ["position outside field", { ...valid, position: { x: 5, y: 0 } }],
    ["invalid direction", { ...valid, direction: "sideways" }],
    ["finite wheat", { ...valid, seeds: { ...valid.seeds, wheat: null } }],
    ["negative inventory", {
      ...valid,
      harvest: { ...valid.harvest, tomato: -1 },
    }],
    ["invalid crop", { ...valid, plants: [{ x: 0, y: 0, type: "potato" }] }],
    ["invalid wither state", {
      ...valid,
      plants: [{ x: 0, y: 0, type: "wheat", witherState: "maybe" }],
    }],
    ["duplicate crop tile", {
      ...valid,
      plants: [{ x: 0, y: 0, type: "wheat" }, { x: 0, y: 0, type: "tomato" }],
    }],
    ["missing code", { ...valid, editorCode: undefined }],
  ];
  for (const [name, value] of invalid) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    throws(() => parseSaveFile(text, 0), Error, name);
  }
  throws(() => parseSaveFile("{", 0), (error) => {
    match((error as Error).message, /not valid JSON/);
    return true;
  });
});

Deno.test("version 1 fixed-size saves migrate to a 5 x 5 farm", () => {
  const oldSave = JSON.parse(serializeGame(createFarm(5), "move()"));
  oldSave.version = 1;
  delete oldSave.fieldSize;
  const loaded = parseSaveFile(JSON.stringify(oldSave), 0);
  strictEqual(loaded.farm.size, 5);
  strictEqual(loaded.farm.tiles.flat().length, 25);
});

Deno.test("version 2 saves migrate with empty watermelon inventory and unresolved withering", () => {
  const oldSave = JSON.parse(serializeGame(createFarm(2), "move()"));
  oldSave.version = 2;
  delete oldSave.seeds.watermelon;
  delete oldSave.harvest.watermelon;
  oldSave.plants = [{ x: 0, y: 0, type: "tomato" }];
  const loaded = parseSaveFile(JSON.stringify(oldSave), 100);
  strictEqual(loaded.farm.seeds.watermelon, 0);
  strictEqual(loaded.farm.harvest.watermelon, 0);
  strictEqual(loaded.farm.tiles[0][0].plant?.witherState, "pending");
});
