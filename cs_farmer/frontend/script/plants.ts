export type PlantName = "wheat" | "tomato" | "cucumber";

export abstract class Plant {
  abstract readonly name: PlantName;
  abstract readonly seedPrice: number;
  abstract readonly growthTime: number;
  abstract readonly sellingPrice: number;
  constructor(public readonly plantedAt: number) {}
  isGrown(now: number): boolean { return now - this.plantedAt >= this.growthTime * 1000; }
}
export class Wheat extends Plant {
  readonly name = "wheat";
  readonly seedPrice = 0;
  readonly growthTime = 0.5;
  readonly sellingPrice = 0.5;
}
export class Tomato extends Plant {
  readonly name = "tomato";
  readonly seedPrice = 0.2;
  readonly growthTime = 1;
  readonly sellingPrice = 2;
}
export class Cucumber extends Plant {
  readonly name = "cucumber";
  readonly seedPrice = 0.5;
  readonly growthTime = 2;
  readonly sellingPrice = 4;
}
export const plantTypes = { wheat: Wheat, tomato: Tomato, cucumber: Cucumber };
export const plantNames = Object.keys(plantTypes) as PlantName[];
export const plantInfo = Object.fromEntries(plantNames.map((name) => [name, new plantTypes[name](0)])) as Record<PlantName, Plant>;
