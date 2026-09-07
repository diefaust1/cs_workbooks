# Development

## Structure

```text
cs_farmer/
  backend/                 Unchanged Deno starter server and tests
  frontend/
    deno.json              Browser and Deno test types
    html/app.html          Editor, field, balance, inventories, reference
    css/app.css            Layout, tiles, crop and selection styling
    script/app.ts          DOM updates, execution controls, growth display
    script/editor.ts       Tab/Shift+Tab editing and focus escape
    script/program.ts      Indentation parser and cancellable runner
    script/farm.ts         Array-based field, inventories, movement, farming
    script/plants.ts       Abstract Plant and concrete crop classes
    script/program_test.ts Parser, loops, timing, position tests
    script/farm_test.ts    Crops, growth boundaries, seed/inventory tests
    script/app_test.ts     Generated bundle integration with a minimal DOM
    script/app.js          Generated browser bundle; do not edit directly
  doc/                     Overview, language, farming, and development guides
```

## Build and preview

From `cs_farmer`:

```powershell
deno run --allow-env --allow-read --allow-write --allow-run npm:esbuild frontend/script/app.ts --bundle --outfile=frontend/script/app.js
```

Add `--watch` to rebuild on TypeScript saves. Open `frontend/html/app.html` in a browser or serve the frontend with a static server. Refresh after changes. The script uses `defer`.

The HTML script URL includes a static version query to avoid an older cached script. Update that value when publishing a changed bundle; watch mode does not update it automatically. If the page behaves like an older version, hard-refresh and verify the file path.

## Verification

From `cs_farmer`:

```powershell
deno check --config frontend/deno.json frontend/script/app.ts
deno test --allow-read=frontend/script/app.js --config frontend/deno.json frontend/script/program_test.ts frontend/script/farm_test.ts frontend/script/app_test.ts
```

Rebuild before running bundle tests. Tests cover syntax, loops, cancellation, movement, default direction, old-command rejection, plant definitions, seed consumption, occupied tiles, maturity boundaries, premature removal, inventory updates, and position persistence. The bundle test also exercises Compile/Stop, keyboard indentation, and inventory labels. Its minimal DOM substitute does not verify visual layout.

For a manual check:

1. Verify balance 0.00, unlimited wheat seeds, zero other seeds, and zero harvested plants.
2. Compile `move()` twice; position should advance from (0, 0) to (1, 0), then (2, 0).
3. Compile `plant(wheat)` and watch the seedling mature after 0.5 seconds even after execution completes.
4. Compile `harvest()`; the tile clears and wheat harvest increases by one. Balance stays zero.
5. Compile `plant(tomato)`; it reports missing seeds without changing state.
6. Compile a valid command followed by `right()`; the whole program should be rejected because old movement syntax is no longer supported.
7. Run the farming loop from the reference, then Stop. Check that state remains and another run can continue.
8. Check inventory placement and the layout on a narrow screen; field tiles remain non-interactive.

## Implementation

The parser validates the whole source into statements before execution. The runner walks statements with an explicit stack and waits 500 ms before commands and loop checks. It supports cancellation and never evaluates player code as JavaScript.

Farm tiles use `tiles[y][x]`, each holding coordinates and an optional Plant. Seed and harvest inventories are keyed by plant name. Growth uses `performance.now()` timestamps, with an injectable clock for deterministic tests. A 100 ms display refresh updates maturity without modifying growth state. Runtime action failures are logged and execution continues.

The app preserves its farm object between runs, caps output at 200 lines, and prints player text using `textContent`. `reset()` changes only position. No buying, selling, persistence storage, or backend integration is included.

## Backend

The original Deno server remains unchanged. `/api` returns a greeting and timestamp; other routes return a welcome HTML string. It does not serve the frontend.

From `cs_farmer/backend`, use `deno task dev` to start it and `deno test` to run its existing tests.
