import { Plant, type PlantName, plantTypes, plantInfo } from "./plants.ts";
export const INITIAL_FIELD_SIZE = 1;
export const MAX_FIELD_SIZE = 6;
export type Direction = "up" | "down" | "left" | "right";
export type Position = { x: number; y: number };
export type Tile = Position & { plant: Plant | null };
export type Inventory = Record<PlantName, number>;
export type Farm = { tiles: Tile[][]; size: number; position: Position; direction: Direction; balance: number; seeds: Inventory; harvest: Inventory };
export type ActionResult = { success: boolean; message: string };
export function createFarm(size = INITIAL_FIELD_SIZE): Farm {
  if (!Number.isInteger(size) || size < INITIAL_FIELD_SIZE || size > MAX_FIELD_SIZE) throw new Error("Invalid field size.");
  return {
    tiles: Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => ({ x, y, plant: null }))),
    size,
    position: { x: 0, y: 0 }, direction: "right", balance: 0,
    seeds: { wheat: Infinity, tomato: 0, cucumber: 0 },
    harvest: { wheat: 0, tomato: 0, cucumber: 0 },
  };
}
export function move(farm: Farm): boolean {
  const offsets = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  const offset = offsets[farm.direction];
  const x = Math.max(0, Math.min(farm.size - 1, farm.position.x + offset.x));
  const y = Math.max(0, Math.min(farm.size - 1, farm.position.y + offset.y));
  const moved = x !== farm.position.x || y !== farm.position.y;
  farm.position = { x, y };
  return moved;
}
export function plant(farm: Farm, name: PlantName, now: number): ActionResult {
  const tile = farm.tiles[farm.position.y][farm.position.x];
  if (tile.plant) return { success: false, message: "Tile occupied. Harvest it before planting." };
  if (farm.seeds[name] < 1) return { success: false, message: `No ${name} seeds available.` };
  farm.seeds[name]--;
  tile.plant = new plantTypes[name](now);
  return { success: true, message: `Planted ${name}.` };
}
export function harvest(farm: Farm, now: number): ActionResult {
  const tile = farm.tiles[farm.position.y][farm.position.x];
  if (!tile.plant) return { success: false, message: "Nothing to harvest on this tile." };
  const crop = tile.plant;
  tile.plant = null;
  if (!crop.isGrown(now)) return { success: true, message: `Removed immature ${crop.name}; nothing added to harvest.` };
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
export function getXCord(farm: Farm): number { return farm.position.x; }
export function getYCord(farm: Farm): number { return farm.position.y; }
export function getDirection(farm: Farm): Direction { return farm.direction; }
export function getInventory(farm: Farm, name: PlantName): number { return farm.harvest[name]; }

export function getExpansionCost(farm: Farm): number | undefined {
  return farm.size < MAX_FIELD_SIZE ? 4 ** farm.size : undefined;
}

export function expandField(farm: Farm): ActionResult {
  const cost = getExpansionCost(farm);
  if (cost === undefined) return { success: false, message: "Maximum field size reached." };
  if (farm.balance < cost) return { success: false, message: `Not enough balance to expand the field; need ${cost.toFixed(2)}.` };
  const oldSize = farm.size;
  const newSize = oldSize + 1;
  for (let y = 0; y < oldSize; y++) farm.tiles[y].push({ x: oldSize, y, plant: null });
  farm.tiles.push(Array.from({ length: newSize }, (_, x) => ({ x, y: oldSize, plant: null })));
  farm.size = newSize;
  farm.balance = (Math.round(farm.balance * 100) - cost * 100) / 100;
  return { success: true, message: `Field expanded to ${newSize} x ${newSize}.` };
}

export function isHarvestable(farm: Farm, now: number): boolean {
  return farm.tiles[farm.position.y][farm.position.x].plant?.isGrown(now) ?? false;
}
export function sell(farm: Farm, name: PlantName, quantity: number): ActionResult {
  if (!Number.isSafeInteger(quantity) || quantity < 0) return { success: false, message: "Sale quantity must be a non-negative whole number." };
  if (farm.harvest[name] < quantity) return { success: false, message: `Not enough harvested ${name}; requested ${quantity}, available ${farm.harvest[name]}.` };
  const income = plantInfo[name].sellingPrice * quantity;
  const totalCents = Math.round(farm.balance * 100) + Math.round(income * 100);
  if (!Number.isSafeInteger(totalCents)) return { success: false, message: "Sale exceeds the supported balance." };
  farm.harvest[name] -= quantity;
  farm.balance = totalCents / 100;
  return { success: true, message: `Sold ${quantity} ${name} for ${income.toFixed(2)}.` };
}
