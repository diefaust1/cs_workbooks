# Farming and inventories

## Starting state

- Balance: `0` (displayed as `0.00`). It is a JavaScript number that supports fractional values.
- Wheat seeds: unlimited, shown as infinity.
- Tomato seeds: `0`.
- Cucumber seeds: `0`.
- Harvest inventory: `0` for each plant type.

Balance sits above the code editor. Seeds sit above the field, followed by harvest inventory. State lasts for the current page session and survives successive Compile runs and Stop. Reloading clears the session.

## Plant definitions

| Plant | Seed price | Growth time | Selling price |
| --- | --- | --- | --- |
| Wheat | 0 | 0.5 seconds | 0.5 |
| Tomato | 0.2 | 1 second | 2 |
| Cucumber | 0.5 | 2 seconds | 4 |

`Plant` is an abstract parent class. `Wheat`, `Tomato`, and `Cucumber` extend it. Every instance contains its planting timestamp; maturity is calculated from elapsed time. To add a type, extend Plant and register it in `plants.ts`, then extend the language's accepted type names and command reference.

## Planting

`plant(wheat)`, `plant(tomato)`, or `plant(cucumber)` acts on the selected tile. It requires an empty tile and an available seed. A successful planting consumes one seed; unlimited wheat stays unlimited. Failed planting leaves both the tile and seed count unchanged and logs the reason.

A seedling marks a growing plant. Mature plants display their crop symbol on a green tile. Growth continues while programs are stopped; the frontend refreshes its display periodically. Maturity is based on timestamps, not the number of display refreshes.

## Harvesting

`harvest()` removes the current plant:

- At or after its growth time, one plant is added to the matching harvest inventory.
- Before its growth time, the plant is removed without adding produce or refunding its seed.
- An empty tile logs a message and changes nothing.

Harvest inventory counts collected plants currently held, not plants still growing. Harvesting does not sell a plant and does not change the balance. `reset()` only moves the selection; crops and inventories remain intact.

## Buying and selling

No buy/sell commands or buttons were requested for this milestone, so none are included. Prices are stored for future use. The balance therefore remains zero, and tomato/cucumber seeds cannot yet be acquired through the interface. Their planting/growth/harvest rules are tested using explicitly seeded test state.
