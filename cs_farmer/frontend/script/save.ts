import {
  createFarm,
  type Direction,
  type Farm,
  INITIAL_FIELD_SIZE,
  type Inventory,
  MAX_FIELD_SIZE,
} from "./farm.ts";
import { type PlantName, plantNames, plantTypes } from "./plants.ts";

export const SAVE_VERSION = 2;
export const SAVE_FORMAT = "cs_farmer_save";

type SavedPlant = { x: number; y: number; type: PlantName };
type SaveFile = {
  format: typeof SAVE_FORMAT;
  version: typeof SAVE_VERSION;
  fieldSize: number;
  balanceCents: number;
  position: { x: number; y: number };
  direction: Direction;
  seeds: { wheat: "unlimited"; tomato: number; cucumber: number };
  harvest: Inventory;
  plants: SavedPlant[];
  editorCode: string;
};

export type LoadedGame = { farm: Farm; editorCode: string };

export function createSaveFile(farm: Farm, editorCode: string): SaveFile {
  const plants: SavedPlant[] = [];
  for (const row of farm.tiles) {
    for (const tile of row) {
      if (tile.plant) {
        plants.push({ x: tile.x, y: tile.y, type: tile.plant.name });
      }
    }
  }
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    fieldSize: farm.size,
    balanceCents: Math.round(farm.balance * 100),
    position: { ...farm.position },
    direction: farm.direction,
    seeds: {
      wheat: "unlimited",
      tomato: farm.seeds.tomato,
      cucumber: farm.seeds.cucumber,
    },
    harvest: { ...farm.harvest },
    plants,
    editorCode,
  };
}

export function serializeGame(farm: Farm, editorCode: string): string {
  return JSON.stringify(createSaveFile(farm, editorCode), null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${name} must be an object.`);
  return value;
}

function requireInteger(
  value: unknown,
  name: string,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (
    !Number.isSafeInteger(value) || (value as number) < 0 ||
    (value as number) > maximum
  ) {
    throw new Error(`${name} must be a non-negative whole number.`);
  }
  return value as number;
}

function requireInventory(value: unknown, name: string): Inventory {
  const inventory = requireRecord(value, name);
  return Object.fromEntries(
    plantNames.map((
      plant,
    ) => [plant, requireInteger(inventory[plant], `${name}.${plant}`)]),
  ) as Inventory;
}

export function parseSaveFile(text: string, now: number): LoadedGame {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }
  const save = requireRecord(value, "Save file");
  if (save.format !== SAVE_FORMAT) {
    throw new Error("This is not a Robot Farmer save file.");
  }
  if (save.version !== 1 && save.version !== SAVE_VERSION) {
    throw new Error(`Unsupported save version: ${String(save.version)}.`);
  }

  // Version 1 had one fixed 5 x 5 field and therefore no fieldSize property.
  const fieldSize = save.version === 1
    ? 5
    : requireInteger(save.fieldSize, "fieldSize", MAX_FIELD_SIZE);
  if (fieldSize < INITIAL_FIELD_SIZE) throw new Error("fieldSize is invalid.");

  const balanceCents = requireInteger(save.balanceCents, "balanceCents");
  const position = requireRecord(save.position, "position");
  const x = requireInteger(position.x, "position.x", fieldSize - 1);
  const y = requireInteger(position.y, "position.y", fieldSize - 1);
  const directions: Direction[] = ["up", "down", "left", "right"];
  if (!directions.includes(save.direction as Direction)) {
    throw new Error("direction is invalid.");
  }

  const seeds = requireRecord(save.seeds, "seeds");
  if (seeds.wheat !== "unlimited") {
    throw new Error('seeds.wheat must be "unlimited".');
  }
  const tomatoSeeds = requireInteger(seeds.tomato, "seeds.tomato");
  const cucumberSeeds = requireInteger(seeds.cucumber, "seeds.cucumber");
  const harvest = requireInventory(save.harvest, "harvest");
  if (
    !Array.isArray(save.plants) || save.plants.length > fieldSize * fieldSize
  ) throw new Error("plants must be a valid array.");
  if (typeof save.editorCode !== "string") {
    throw new Error("editorCode must be a string.");
  }

  const farm = createFarm(fieldSize);
  farm.balance = balanceCents / 100;
  farm.position = { x, y };
  farm.direction = save.direction as Direction;
  farm.seeds = {
    wheat: Infinity,
    tomato: tomatoSeeds,
    cucumber: cucumberSeeds,
  };
  farm.harvest = harvest;
  const occupied = new Set<string>();
  for (let index = 0; index < save.plants.length; index++) {
    const entry = requireRecord(save.plants[index], `plants[${index}]`);
    const plantX = requireInteger(
      entry.x,
      `plants[${index}].x`,
      fieldSize - 1,
    );
    const plantY = requireInteger(
      entry.y,
      `plants[${index}].y`,
      fieldSize - 1,
    );
    if (!plantNames.includes(entry.type as PlantName)) {
      throw new Error(`plants[${index}].type is invalid.`);
    }
    const key = `${plantX},${plantY}`;
    if (occupied.has(key)) {
      throw new Error(`More than one plant occupies tile (${key}).`);
    }
    occupied.add(key);
    farm.tiles[plantY][plantX].plant = new plantTypes[entry.type as PlantName](
      now,
    );
  }
  return { farm, editorCode: save.editorCode };
}
