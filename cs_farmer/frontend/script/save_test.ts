import { deepStrictEqual, match, strictEqual, throws } from "node:assert";
import { createFarm, plant } from "./farm.ts";
import { parseSaveFile, serializeGame } from "./save.ts";

Deno.test("save files round-trip the complete game state and programs", () => {
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
  const programs = [{
    id: "program-1",
    name: "Harvest wheat",
    code: "move()\nplant(wheat)",
    collapsed: false,
  }, {
    id: "program-2",
    name: "Sell everything",
    code: "sell(wheat, get_inventory(wheat))",
    collapsed: true,
  }];
  const json = serializeGame(farm, programs);
  const raw = JSON.parse(json);
  strictEqual(raw.version, 4);
  strictEqual(raw.fieldSize, 5);
  strictEqual(raw.balanceCents, 1250);
  strictEqual(raw.seeds.wheat, "unlimited");
  strictEqual(raw.tiles, undefined);
  strictEqual(raw.plants.length, 2);
  deepStrictEqual(raw.programs, programs);
  strictEqual(raw.editorCode, undefined);
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
  deepStrictEqual(loaded.programs, programs);
  strictEqual(loaded.farm.tiles[2][1].plant?.name, "wheat");
  strictEqual(loaded.farm.tiles[3][4].plant?.name, "tomato");
  strictEqual(loaded.farm.tiles[2][1].plant?.witherState, "healthy");
  strictEqual(loaded.farm.tiles[3][4].plant?.witherState, "withered");
  strictEqual(loaded.farm.tiles[2][1].plant?.plantedAt, 5000);
  strictEqual(loaded.farm.tiles[2][1].plant?.isGrown(5000), false);
});

Deno.test("invalid save files are rejected before creating loaded state", () => {
  const valid = JSON.parse(serializeGame(createFarm(), [{
    id: "program-1",
    name: "Program 1",
    code: "",
    collapsed: false,
  }]));
  const invalid: Array<[string, unknown]> = [
    ["bad JSON", "{"],
    ["wrong format", { ...valid, format: "other" }],
    ["wrong version", { ...valid, version: 5 }],
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
    ["missing programs", { ...valid, programs: undefined }],
    ["empty programs", { ...valid, programs: [] }],
    ["invalid program id", {
      ...valid,
      programs: [{ ...valid.programs[0], id: "bad id" }],
    }],
    ["duplicate program id", {
      ...valid,
      programs: [valid.programs[0], valid.programs[0]],
    }],
    ["invalid program name", {
      ...valid,
      programs: [{ ...valid.programs[0], name: null }],
    }],
    ["invalid program code", {
      ...valid,
      programs: [{ ...valid.programs[0], code: null }],
    }],
    ["invalid collapsed state", {
      ...valid,
      programs: [{ ...valid.programs[0], collapsed: "no" }],
    }],
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
  const oldSave = JSON.parse(serializeGame(createFarm(5), [{
    id: "program-1",
    name: "Program 1",
    code: "move()",
    collapsed: false,
  }]));
  oldSave.version = 1;
  delete oldSave.fieldSize;
  oldSave.editorCode = oldSave.programs[0].code;
  delete oldSave.programs;
  const loaded = parseSaveFile(JSON.stringify(oldSave), 0);
  strictEqual(loaded.farm.size, 5);
  strictEqual(loaded.farm.tiles.flat().length, 25);
});

Deno.test("version 2 saves migrate with empty watermelon inventory and unresolved withering", () => {
  const oldSave = JSON.parse(serializeGame(createFarm(2), [{
    id: "program-1",
    name: "Program 1",
    code: "move()",
    collapsed: false,
  }]));
  oldSave.version = 2;
  delete oldSave.seeds.watermelon;
  delete oldSave.harvest.watermelon;
  oldSave.plants = [{ x: 0, y: 0, type: "tomato" }];
  oldSave.editorCode = oldSave.programs[0].code;
  delete oldSave.programs;
  const loaded = parseSaveFile(JSON.stringify(oldSave), 100);
  strictEqual(loaded.farm.seeds.watermelon, 0);
  strictEqual(loaded.farm.harvest.watermelon, 0);
  strictEqual(loaded.farm.tiles[0][0].plant?.witherState, "pending");
  deepStrictEqual(loaded.programs, [{
    id: "program-1",
    name: "Program 1",
    code: "move()",
    collapsed: false,
  }]);
});

Deno.test("version 3 saves retain watermelon state and migrate one editor", () => {
  const farm = createFarm(2);
  farm.seeds.watermelon = 3;
  farm.harvest.watermelon = 4;
  const oldSave = JSON.parse(serializeGame(farm, [{
    id: "ignored",
    name: "Ignored",
    code: "move()",
    collapsed: true,
  }]));
  oldSave.version = 3;
  oldSave.editorCode = "print(get_position())";
  delete oldSave.programs;
  const loaded = parseSaveFile(JSON.stringify(oldSave), 0);
  strictEqual(loaded.farm.seeds.watermelon, 3);
  strictEqual(loaded.farm.harvest.watermelon, 4);
  deepStrictEqual(loaded.programs, [{
    id: "program-1",
    name: "Program 1",
    code: "print(get_position())",
    collapsed: false,
  }]);
});
