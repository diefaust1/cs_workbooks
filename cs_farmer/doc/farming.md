# Farming and inventories

## Starting state

- Balance: `0` (displayed as `0.00`). It is a JavaScript number that supports fractional values.
- Wheat seeds: unlimited, shown as infinity.
- Tomato seeds: `0`.
- Cucumber seeds: `0`.
- Harvest inventory: `0` for each plant type.
- Field size: `1x1`.

Balance sits above the code editor. Seeds sit below the field, followed by harvest inventory. State survives successive Compile runs and Stop. Reloading clears the live session unless the player first downloads a JSON save and loads it afterward.

Save files preserve the balance, field size, position, facing direction, inventories, occupied tiles, and editor code. They do not preserve plant maturity: every loaded crop starts again as a newly planted seedling.

## Field expansion

The complete 6x6 grid remains visible. Grey tiles are locked and cannot be reached or farmed. The collapsible Shop below the output panel unlocks one row and one column per purchase. Existing crops and the selected position are preserved. The progression is:

| New size | Cost |
| --- | ---: |
| 2x2 | 4 |
| 3x3 | 16 |
| 4x4 | 64 |
| 5x5 | 256 |
| 6x6 | 1024 |

An expansion is rejected without changing the field or balance when funds are insufficient. The maximum field size is 6x6. Field size is included in version-2 save files.

## Plant definitions

| Plant | Seed price | Growth time | Selling price |
| --- | --- | --- | --- |
| Wheat | 0 | 0.6 seconds | 0.5 |
| Tomato | 0.2 | 2 seconds | 2 |
| Cucumber | 0.5 | 4 seconds | 5 |

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

Use `get_inventory(wheat)`, `get_inventory(tomato)`, or `get_inventory(cucumber)` to read a harvested inventory count from a program. It does not include seeds or crops still planted on the field.

## Selling

`sell(wheat, 2)` sells two harvested wheat plants. The first argument is `wheat`, `tomato`, or `cucumber`; the second is a non-negative whole-number literal within JavaScript's safe integer range. Both arguments are required and separated by a comma. Selling zero is allowed and changes nothing.

A sale deducts the requested amount from harvest inventory and adds selling price times quantity to balance. It does not sell seeds or crops still on the field. Insufficient inventory rejects the sale without changing inventory or money; execution continues with a message. Negative, fractional, missing, or invalid arguments reject the whole program during compilation. Balance arithmetic is rounded to cents; unrepresentable totals are rejected before mutation.

Buying seeds is not implemented yet. Wheat remains free and unlimited; other seed counts start at zero.

## Checking harvestability

`is_harvestable()` is True only when the selected tile contains a fully grown plant. Empty tiles and immature plants return False. It reads the current tile and time when executed, including every loop check, without changing the plant or inventory. After harvesting or clearing a tile, it returns False.

```python
if(is_harvestable()):
    harvest()
    sell(wheat, 1)
```

Sell the matching plant type; the example assumes wheat.

## Clearing the field

`reset_field()` removes every plant, mature or immature, and returns the selection to `(0, 0)`. It does not harvest plants, refund seeds, or change balance or inventories. It executes as one timed command. `reset()` remains the less destructive position-only command.
