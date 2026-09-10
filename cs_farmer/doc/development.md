# Development

## Structure

```text
cs_farmer/
  package.json             Vite development, build, check, and test commands
  vite.config.ts           Frontend source and production output paths
  backend/                 Unchanged Deno starter server and tests
  frontend/
    deno.json              Browser and Deno test types
    index.html             Vite entry: editor, field, inventories, reference
    css/app.css            Layout, tiles, crop and selection styling
    script/app.ts          DOM updates, execution controls, growth display
    script/editor.ts       Tab/Shift+Tab editing and focus escape
    script/program.ts      While/if parser and cancellable command runner
    script/expressions.ts  Literal/getter parsing, evaluation, output formatting
    script/farm.ts         Array-based field, inventories, movement, farming
    script/plants.ts       Abstract Plant and concrete crop classes
    script/save.ts         Versioned JSON serialization and validation
    script/program_test.ts Parser, loops, timing, position tests
    script/farm_test.ts    Crops, growth boundaries, seed/inventory tests
    script/language_test.ts If, print, position getters, and field-reset tests
    script/app_test.ts     Vite production bundle integration with a minimal DOM
    script/save_test.ts    Save round-trip and invalid-schema tests
  dist/                    Generated production site; deploy this directory
  doc/                     Overview, language, farming, and development guides
```

## Build and preview

Install dependencies once, then start the Vite development server from `cs_farmer`:

```powershell
npm install
npm run dev
```

Open the URL printed by Vite. TypeScript and CSS changes update in the browser automatically.

Create the production site with:

```powershell
npm run build
```

Vite writes `dist/index.html` and content-hashed JavaScript/CSS assets. Deploy the complete `dist` directory, never the `frontend` source directory. To inspect the production build locally, use `npm run preview`.

For Caddy on the current server, serve the build output directly:

```caddy
farmer.faulab.com {
    root * /home/ubuntu/server/cs_workbooks/cs_farmer/dist
    encode zstd gzip
    file_server
}
```

Remove the old redirect to `/html/app.html`; Vite's entry page is `/index.html` and Caddy serves it automatically at `/`. Each build gives changed assets new filenames, preventing an old script from being paired with new HTML or CSS.

## Verification

From `cs_farmer`:

```powershell
npm run check
npm test
```

`npm test` creates a fresh production build before running the Deno tests. Tests cover syntax, loops, cancellation, movement, stored facing direction, old-command rejection, plant definitions, seed consumption, occupied tiles, maturity boundaries, premature removal, inventory updates, position persistence, field clearing, conditional execution, quoted strings, and execution-time getters. The production bundle test also exercises Compile/Stop, keyboard indentation, inventory labels, and the 36-tile grid. Its minimal DOM substitute does not verify visual layout.

For a manual check:

1. Verify balance 0.00, unlimited wheat seeds, zero other seeds, and zero harvested plants.
2. Confirm the field starts at 1x1 and `move()` remains at (0, 0).
3. Compile `plant(wheat)` and watch the seedling mature after 0.6 seconds even after execution completes.
4. Compile `harvest()`; the tile clears and wheat harvest increases by one. Balance stays zero.
5. Compile `plant(tomato)`; it reports missing seeds without changing state.
6. Compile a valid command followed by `right()`; the whole program should be rejected because old movement syntax is no longer supported.
7. Run the farming loop from the reference, then Stop. Check that state remains and another run can continue.
8. Earn 4.00, buy the 2x2 expansion in Shop, and confirm movement can reach the new tiles.
9. Check inventory placement and the layout on a narrow screen; field tiles remain non-interactive.

## Implementation

The parser validates the whole source into statements before execution. The runner walks statements with an explicit stack and waits 500 ms before commands and while/if checks. If advances its parent once before entering its body; while revisits its condition after its body. Conditions accept True/False, numeric comparisons, and grouped AND/OR expressions with short-circuit evaluation. The parser validates both operands; the runner evaluates getters against current farm state on every check. It supports cancellation and never evaluates player code as JavaScript.

Farm tiles use `tiles[y][x]`, each holding coordinates and an optional Plant. A farm starts with one active tile; each successful expansion appends one active column and one active row through the 6x6 maximum. The UI always renders 36 tile elements and marks coordinates outside the active square as locked. Expansion cost is `4 ** currentSize`. Seed and harvest inventories are keyed by plant name and can be read through `get_inventory(type)`. Growth uses `performance.now()` timestamps, with an injectable clock for deterministic tests. A 100 ms display refresh updates maturity without modifying growth state. Runtime action failures are logged and execution continues.

The app preserves its farm object between runs, caps output at 200 lines, and prints player text using `textContent`. `reset()` resets position and facing to (0, 0) and right, preserving crops and inventory. Position getters return numeric values or a copied coordinate pair. The expression module parses a small allowlist of literal/getter forms without eval. Print uses a dedicated output value, while ordinary actions retain diagnostic messages. Field reset removes crops without changing inventories or balance. Selling harvested produce is supported; buying, automatic persistence storage, and backend integration are not included.

## Save files and shop

`save.ts` maps the live class-based farm into a versioned JSON data shape. Version 2 stores the field size along with cents as an integer, encodes unlimited wheat as `"unlimited"`, and emits only occupied crop coordinates. Version-1 saves migrate as 5x5 fields. Loading validates the format marker, version, size, bounds, enums, inventories, crop types, unique tiles, and editor code before returning a replacement farm. Plants are constructed through `plantTypes` with the current monotonic time, so all loaded crops restart their growth.

The Save button creates an `application/json` browser download. Load uses a hidden JSON file input and applies parsed state only after successful validation. Both controls are unavailable while code executes. The collapsible Shop below Output shows the current size and purchases the next expansion from the live balance.

## Backend

The original Deno server remains unchanged. `/api` returns a greeting and timestamp; other routes return a welcome HTML string. It does not serve the frontend.

From `cs_farmer/backend`, use `deno task dev` to start it and `deno test` to run its existing tests.

## Additional manual checks

- Confirm the right column order is field, seeds, harvest inventory, command reference.
- Plant on multiple tiles, then run `reset_field()`: the field clears and position becomes (0, 0), with inventory unchanged.
- Run `if(True):` with an indented `move()` and then a top-level `print(get_position())`: the move occurs once. Repeat with False to confirm no movement.
- Print both single- and double-quoted messages and the position/direction getter results.
- Compile invalid input inside an if(False) block: the whole program must still be rejected.

## Comparison and reference checks

After expanding to at least 5x5, run `while(get_x_cord() < 4):` with an indented `move()` from (0, 0). It should stop at (4, 0). Verify that `direction()` rejects the entire program. Tests cover all six operators, numeric type validation, getter-to-getter comparison, and loop exit behavior.

The command reference uses native `details`/`summary`, collapsed by default. The summary supplies mouse and keyboard toggling; CSS rotates the arrow to reflect the open state. No JavaScript click handler is needed. Check that collapsing hides the reference and expanding restores it.

## Logical operators and branches

The condition parser splits outside parentheses at OR first, then AND, preserving comparison precedence. Logical nodes store operands and evaluate with short-circuiting. Parse nesting is capped to reject pathological input instead of overflowing the call stack.

Else bodies attach to the preceding if statement at the same indentation. The runner selects either the if body or else body on each visit and advances the parent once. Whole-program validation includes skipped branches and operands.

Regression tests cover word/symbol truth tables, grouping, precedence, short-circuiting, nested else binding, malformed branch placement, and combined conditions in live-state loops. For a browser check, run the if/else example from the language guide at (0, 0), then move and run it again to see the opposite branch.

## Harvestability and sale verification

Harvestability receives the runner's clock for deterministic maturity checks. Conditions and getter output read the same execution-time clock; numeric comparisons continue to accept only numeric getters. Sale validation occurs before inventory/balance mutation, and money is rounded to cents.

Tests cover empty/immature/mature tiles, exact growth boundaries, selection changes, logical conditions, loop rechecks, each crop's selling price, insufficient stock, invalid quantities, zero sales, and UI balance/inventory updates.

For a manual check, verify Commands starts collapsed, then compile `plant(wheat)`, `harvest()`, and `sell(wheat, 1)` on separate lines. Balance should increase by 0.50 and wheat harvest should return to its previous count. Try selling unavailable tomato harvest and confirm the balance remains unchanged.

## Interface translations

`frontend/script/i18n.ts` holds the German UI dictionary and the translation helpers. HTML uses `data-i18n` for text and attribute-specific markers for placeholders and accessible labels. English text is the stable key and fallback. Code examples and command syntax are not marked for translation.

`app.ts` keeps the selected language in the current page session, updates dynamic status/field descriptions and balance formatting, and leaves code, log history, controls, and farm state intact. No backend or interpreter translation is involved. A reload defaults to English.

The bundle test switches to German and back and checks labels, accessibility attributes, decimal formatting, code/inventory preservation, and unmodified player output. Translation markers are also checked against the dictionary. Visually verify the selector at desktop and narrow widths and open the command reference to review German descriptions.

## Facing implementation

`farm.direction` owns the current facing, initially right. The runner changes it for `direction(...)` and the movement helper reads it for `move()`. Both reset operations restore the default facing direction, right, along with position (0, 0). Rendering adds exactly one `facing-*` class to the selected tile. A blue pseudo-element overlays that side of the red selection outline without changing tile dimensions.

Tests cover movement syntax, turning without movement, direction persistence, all four edge clamps, timed turns, cancelling a pending turn, and the selected tile's facing classes. Verify all four blue edges visually after changing direction and confirm German mode translates the accessible direction description.
