import { Plant, type PlantName, plantTypes } from "./plants.ts";
export const FIELD_SIZE = 5;
export type Direction = "up" | "down" | "left" | "right";
export type Position = { x: number; y: number };
export type Tile = Position & { plant: Plant | null };
export type Inventory = Record<PlantName, number>;
export type Farm = { tiles: Tile[][]; position: Position; balance: number; seeds: Inventory; harvest: Inventory };
export type ActionResult = { success: boolean; message: string };
export function createFarm(): Farm {
  return {
    tiles: Array.from({ length: FIELD_SIZE }, (_, y) => Array.from({ length: FIELD_SIZE }, (_, x) => ({ x, y, plant: null }))),
    position: { x: 0, y: 0 }, balance: 0,
    seeds: { wheat: Infinity, tomato: 0, cucumber: 0 },
    harvest: { wheat: 0, tomato: 0, cucumber: 0 },
  };
}
export function move(farm: Farm, direction: Direction = "right"): boolean {
  const offsets = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  const offset = offsets[direction];
  const x = Math.max(0, Math.min(FIELD_SIZE - 1, farm.position.x + offset.x));
  const y = Math.max(0, Math.min(FIELD_SIZE - 1, farm.position.y + offset.y));
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
