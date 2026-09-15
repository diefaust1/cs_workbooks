# Farming and inventories

## Starting state

- Balance: `0` (displayed as `0.00`). It is a JavaScript number that supports fractional values.
- Wheat seeds: unlimited, shown as infinity.
- Tomato seeds: `0`.
- Cucumber seeds: `0`.
- Watermelon seeds: `0`.
- Harvest inventory: `0` for each plant type.
- Field size: `1x1`.

Balance sits above the program editors. Seeds sit below the field, followed by harvest inventory. Every program operates on the same farm, and state survives successive runs and Stop. Reloading clears the live session unless the player first downloads a JSON save and loads it afterward.

Save files preserve the balance, field size, position, facing direction, inventories, occupied tiles, each plant's resolved withering outcome, and all named programs. They do not preserve plant maturity: every loaded crop starts again as a newly planted seedling, but a resolved healthy/withered outcome cannot reroll.

## Field expansion

The complete 6x6 grid remains visible. Grey tiles are locked and cannot be reached or farmed. The collapsible Shop below the output panel unlocks one row and one column per purchase. Existing crops and the selected position are preserved. The progression is:

| New size | Cost |
| --- | ---: |
| 2x2 | 4 |
| 3x3 | 16 |
| 4x4 | 64 |
| 5x5 | 256 |
| 6x6 | 1024 |

An expansion is rejected without changing the field or balance when funds are insufficient. The maximum field size is 6x6. Field size is included in version-2 and later save files.

## Plant definitions

| Plant | Seed price | Growth time | Wither chance | Selling price |
| --- | ---: | ---: | ---: | ---: |
| Wheat | 0 | 0.6 seconds | 0% | 0.5 |
| Tomato | 0.2 | 2 seconds | 5% | 2 |
| Cucumber | 0.5 | 4 seconds | 5% | 5 |
| Watermelon | 2 | 10 seconds | 10% | 8 |

`Plant` is an abstract parent class. `Wheat`, `Tomato`, `Cucumber`, and `Watermelon` extend it. Every instance contains its planting timestamp and permanent wither state; maturity is calculated from elapsed time.

## Planting

`plant(wheat)`, `plant(tomato)`, `plant(cucumber)`, or `plant(watermelon)` acts on the selected tile. It requires an empty tile and an available seed. A successful planting consumes one seed; unlimited wheat stays unlimited. Failed planting leaves both the tile and seed count unchanged and logs the reason.

A seedling marks a growing plant. Mature plants display their crop symbol on a green tile. Growth continues while programs are stopped; the frontend refreshes its display periodically. Maturity is based on timestamps, not the number of display refreshes.

When a crop first reaches maturity, its wither chance is rolled exactly once. The permanent result is either healthy or withered and is stored in version-3 and later saves. Every withered crop uses the same wilted-flower icon.

## Harvesting

`harvest()` removes the current plant:

- At or after its growth time, one healthy plant is normally added to the matching harvest inventory.
- A withered plant is removed without producing anything.
- Before its growth time, the plant is removed without adding produce or refunding its seed.
- An empty tile logs a message and changes nothing.

Healthy, fully grown watermelons merge when they fill a square of at least 2x2. Harvesting any tile in the largest qualifying square containing that tile removes the complete square. The yield is the number of occupied tiles multiplied by 2 for 2x2 through 4x4 squares, or by 3 for 5x5 and 6x6 squares. A single healthy watermelon yields one. A withered or immature watermelon prevents its square from qualifying.

Harvest inventory counts collected plants currently held, not plants still growing. Harvesting does not sell a plant and does not change the balance. `reset()` only moves the selection; crops and inventories remain intact.

Use `get_inventory(wheat)`, `get_inventory(tomato)`, `get_inventory(cucumber)`, or `get_inventory(watermelon)` to read a harvested inventory count from a program. It does not include seeds or crops still planted on the field.

## Buying seeds

`buy(tomato, 2)` buys two tomato seeds. The first argument accepts all four plant types. The second may be a numeric literal or numeric getter such as `get_inventory(wheat)` and is evaluated when the command executes. Its result must be a non-negative safe whole number. The complete purchase cost must be available in the balance; otherwise balance and inventory remain unchanged. Wheat purchases cost zero and leave its already-unlimited inventory unchanged.

## Selling

`sell(wheat, 2)` sells two harvested wheat plants. `sell(wheat, get_inventory(wheat))` sells the complete wheat harvest held when that command executes. The first argument is `wheat`, `tomato`, `cucumber`, or `watermelon`; the second may be a numeric literal, coordinate getter, or inventory getter. Both arguments are required and separated by a comma. The evaluated quantity must be a non-negative safe whole number. Selling zero is allowed and changes nothing.

A sale deducts the requested amount from harvest inventory and adds selling price times quantity to balance. It does not sell seeds or crops still on the field. Insufficient inventory or a negative, fractional, unsafe, or otherwise invalid evaluated quantity rejects that command without changing inventory or money; execution continues with a message. Unsupported quantity syntax rejects the whole program during compilation. Balance arithmetic is rounded to cents; unrepresentable totals are rejected before mutation.

## Checking harvestability

`is_harvestable()` is True when the selected tile contains a fully grown plant, including a withered plant that still needs removal. Empty tiles and immature plants return False. Reaching maturity also permanently resolves the wither roll. After harvesting or clearing a tile, it returns False.

```python
if(is_harvestable()):
    harvest()
    sell(wheat, 1)
```

Sell the matching plant type; the example assumes wheat.

## Clearing the field

`reset_field()` removes every plant, mature or immature, and returns the selection to `(0, 0)`. It does not harvest plants, refund seeds, or change balance or inventories. It executes as one timed command. `reset()` remains the less destructive position-only command.
