import { Plant, plantInfo, type PlantName, plantTypes } from "./plants.ts";
export const INITIAL_FIELD_SIZE = 1;
export const MAX_FIELD_SIZE = 6;
export type Direction = "up" | "down" | "left" | "right";
export type Position = { x: number; y: number };
export type Tile = Position & { plant: Plant | null };
export type Inventory = Record<PlantName, number>;
export type Farm = {
  tiles: Tile[][];
  size: number;
  position: Position;
  direction: Direction;
  balance: number;
  seeds: Inventory;
  harvest: Inventory;
};
export type ActionResult = { success: boolean; message: string };
export function createFarm(size = INITIAL_FIELD_SIZE): Farm {
  if (
    !Number.isInteger(size) || size < INITIAL_FIELD_SIZE ||
    size > MAX_FIELD_SIZE
  ) throw new Error("Invalid field size.");
  return {
    tiles: Array.from(
      { length: size },
      (_, y) => Array.from({ length: size }, (_, x) => ({ x, y, plant: null })),
    ),
    size,
    position: { x: 0, y: 0 },
    direction: "right",
    balance: 0,
    seeds: { wheat: Infinity, tomato: 0, cucumber: 0, watermelon: 0 },
    harvest: { wheat: 0, tomato: 0, cucumber: 0, watermelon: 0 },
  };
}
export function move(farm: Farm): boolean {
  const offsets = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const offset = offsets[farm.direction];
  const x = Math.max(0, Math.min(farm.size - 1, farm.position.x + offset.x));
  const y = Math.max(0, Math.min(farm.size - 1, farm.position.y + offset.y));
  const moved = x !== farm.position.x || y !== farm.position.y;
  farm.position = { x, y };
  return moved;
}
export function plant(farm: Farm, name: PlantName, now: number): ActionResult {
  const tile = farm.tiles[farm.position.y][farm.position.x];
  if (tile.plant) {
    return {
      success: false,
      message: "Tile occupied. Harvest it before planting.",
    };
  }
  if (farm.seeds[name] < 1) {
    return { success: false, message: `No ${name} seeds available.` };
  }
  farm.seeds[name]--;
  tile.plant = new plantTypes[name](now);
  return { success: true, message: `Planted ${name}.` };
}
type Random = () => number;

function largestHealthyWatermelonSquare(
  farm: Farm,
  now: number,
  random: Random,
): Tile[] | undefined {
  const selected = farm.position;
  for (let size = farm.size; size >= 2; size--) {
    const minimumX = Math.max(0, selected.x - size + 1);
    const maximumX = Math.min(selected.x, farm.size - size);
    const minimumY = Math.max(0, selected.y - size + 1);
    const maximumY = Math.min(selected.y, farm.size - size);
    for (let startY = minimumY; startY <= maximumY; startY++) {
      for (let startX = minimumX; startX <= maximumX; startX++) {
        const square: Tile[] = [];
        for (let y = startY; y < startY + size; y++) {
          for (let x = startX; x < startX + size; x++) {
            square.push(farm.tiles[y][x]);
          }
        }
        if (
          square.every(({ plant }) =>
            plant?.name === "watermelon" && plant.isGrown(now) &&
            plant.resolveWither(now, random) === "healthy"
          )
        ) return square;
      }
    }
  }
}

export function harvest(
  farm: Farm,
  now: number,
  random: Random = Math.random,
): ActionResult {
  const tile = farm.tiles[farm.position.y][farm.position.x];
  if (!tile.plant) {
    return { success: false, message: "Nothing to harvest on this tile." };
  }
  const crop = tile.plant;
  if (!crop.isGrown(now)) {
    tile.plant = null;
    return {
      success: true,
      message: `Removed immature ${crop.name}; nothing added to harvest.`,
    };
  }
  if (crop.resolveWither(now, random) === "withered") {
    tile.plant = null;
    return {
      success: true,
      message: `Removed withered ${crop.name}; nothing added to harvest.`,
    };
  }
  if (crop.name === "watermelon") {
    const square = largestHealthyWatermelonSquare(farm, now, random);
    if (square) {
      const size = Math.sqrt(square.length);
      const multiplier = size >= 5 ? 3 : 2;
      const yieldCount = square.length * multiplier;
      for (const squareTile of square) squareTile.plant = null;
      farm.harvest.watermelon += yieldCount;
      return {
        success: true,
        message:
          `Harvested ${size} x ${size} watermelon square for ${yieldCount} watermelon.`,
      };
    }
  }
  tile.plant = null;
  farm.harvest[crop.name]++;
  return { success: true, message: `Harvested ${crop.name}.` };
}

export function resetField(farm: Farm): void {
  for (const row of farm.tiles) for (const tile of row) tile.plant = null;
  farm.position = { x: 0, y: 0 };
  farm.direction = "right";
}
export function getPosition(farm: Farm): [number, number] {
  return [farm.position.x, farm.position.y];
}
export function getXCord(farm: Farm): number {
  return farm.position.x;
}
export function getYCord(farm: Farm): number {
  return farm.position.y;
}
export function getDirection(farm: Farm): Direction {
  return farm.direction;
}
export function getInventory(farm: Farm, name: PlantName): number {
  return farm.harvest[name];
}

export function getExpansionCost(farm: Farm): number | undefined {
  return farm.size < MAX_FIELD_SIZE ? 4 ** farm.size : undefined;
}

export function expandField(farm: Farm): ActionResult {
  const cost = getExpansionCost(farm);
  if (cost === undefined) {
    return { success: false, message: "Maximum field size reached." };
  }
  if (farm.balance < cost) {
    return {
      success: false,
      message: `Not enough balance to expand the field; need ${
        cost.toFixed(2)
      }.`,
    };
  }
  const oldSize = farm.size;
  const newSize = oldSize + 1;
  for (let y = 0; y < oldSize; y++) {
    farm.tiles[y].push({ x: oldSize, y, plant: null });
  }
  farm.tiles.push(
    Array.from({ length: newSize }, (_, x) => ({ x, y: oldSize, plant: null })),
  );
  farm.size = newSize;
  farm.balance = (Math.round(farm.balance * 100) - cost * 100) / 100;
  return {
    success: true,
    message: `Field expanded to ${newSize} x ${newSize}.`,
  };
}

export function isHarvestable(
  farm: Farm,
  now: number,
  random: Random = Math.random,
): boolean {
  const crop = farm.tiles[farm.position.y][farm.position.x].plant;
  if (!crop?.isGrown(now)) return false;
  crop.resolveWither(now, random);
  return true;
}
export function updateWithering(
  farm: Farm,
  now: number,
  random: Random = Math.random,
): void {
  for (const row of farm.tiles) {
    for (const tile of row) tile.plant?.resolveWither(now, random);
  }
}
export function buy(
  farm: Farm,
  name: PlantName,
  quantity: number,
): ActionResult {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    return {
      success: false,
      message: "Purchase quantity must be a non-negative whole number.",
    };
  }
  const costCents = Math.round(plantInfo[name].seedPrice * 100) * quantity;
  if (!Number.isSafeInteger(costCents)) {
    return {
      success: false,
      message: "Purchase exceeds the supported quantity.",
    };
  }
  const balanceCents = Math.round(farm.balance * 100);
  if (balanceCents < costCents) {
    return {
      success: false,
      message: `Not enough balance to buy ${quantity} ${name} seeds; need ${
        (costCents / 100).toFixed(2)
      }.`,
    };
  }
  if (
    Number.isFinite(farm.seeds[name]) &&
    !Number.isSafeInteger(farm.seeds[name] + quantity)
  ) {
    return {
      success: false,
      message: "Purchase exceeds the supported seed inventory.",
    };
  }
  farm.balance = (balanceCents - costCents) / 100;
  if (Number.isFinite(farm.seeds[name])) farm.seeds[name] += quantity;
  return {
    success: true,
    message: `Bought ${quantity} ${name} seeds for ${
      (costCents / 100).toFixed(2)
    }.`,
  };
}
export function sell(
  farm: Farm,
  name: PlantName,
  quantity: number,
): ActionResult {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    return {
      success: false,
      message: "Sale quantity must be a non-negative whole number.",
    };
  }
  if (farm.harvest[name] < quantity) {
    return {
      success: false,
      message:
        `Not enough harvested ${name}; requested ${quantity}, available ${
          farm.harvest[name]
        }.`,
    };
  }
  const income = plantInfo[name].sellingPrice * quantity;
  const totalCents = Math.round(farm.balance * 100) + Math.round(income * 100);
  if (!Number.isSafeInteger(totalCents)) {
    return { success: false, message: "Sale exceeds the supported balance." };
  }
  farm.harvest[name] -= quantity;
  farm.balance = totalCents / 100;
  return {
    success: true,
    message: `Sold ${quantity} ${name} for ${income.toFixed(2)}.`,
  };
}
