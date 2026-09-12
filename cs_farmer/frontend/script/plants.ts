export type PlantName = "wheat" | "tomato" | "cucumber" | "watermelon";
export type WitherState = "pending" | "healthy" | "withered";

export abstract class Plant {
  abstract readonly name: PlantName;
  abstract readonly seedPrice: number;
  abstract readonly growthTime: number;
  abstract readonly sellingPrice: number;
  abstract readonly wither: number;
  constructor(
    public readonly plantedAt: number,
    public witherState: WitherState = "pending",
  ) {}
  isGrown(now: number): boolean {
    return now - this.plantedAt >= this.growthTime * 1000;
  }
  resolveWither(now: number, random: () => number = Math.random): WitherState {
    if (this.witherState === "pending" && this.isGrown(now)) {
      this.witherState = random() * 100 < this.wither ? "withered" : "healthy";
    }
    return this.witherState;
  }
}

export class Wheat extends Plant {
  readonly name = "wheat";
  readonly seedPrice = 0;
  readonly growthTime = 0.6;
  readonly sellingPrice = 0.5;
  readonly wither = 0;
}

export class Tomato extends Plant {
  readonly name = "tomato";
  readonly seedPrice = 0.2;
  readonly growthTime = 2;
  readonly sellingPrice = 2;
  readonly wither = 5;
}

export class Cucumber extends Plant {
  readonly name = "cucumber";
  readonly seedPrice = 0.5;
  readonly growthTime = 4;
  readonly sellingPrice = 5;
  readonly wither = 5;
}

export class Watermelon extends Plant {
  readonly name = "watermelon";
  readonly seedPrice = 2;
  readonly growthTime = 10;
  readonly sellingPrice = 8;
  readonly wither = 10;
}

export const plantTypes = {
  wheat: Wheat,
  tomato: Tomato,
  cucumber: Cucumber,
  watermelon: Watermelon,
};
export const plantNames = Object.keys(plantTypes) as PlantName[];
export const plantInfo = Object.fromEntries(
  plantNames.map((name) => [name, new plantTypes[name](0)]),
) as Record<PlantName, Plant>;
