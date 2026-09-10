# Robot Farmer

Robot Farmer (`cs_farmer`) is a browser-based farming and programming game inspired by *The Farmer Was Replaced*. Players write a small Python-inspired language to move around a field, plant crops, and harvest them.

## Current features

- A visible 6x6 field with locked tiles greyed out; play starts in a 1x1 area that can be expanded through the shop, with a red border around the selected tile and visible growing/mature plants.
- `move()` with a stored facing direction, set using `direction(right)`, plus `reset()`, `reset_field()`, `plant(type)`, and `harvest()`.
- Indented, nested `while` and `if` blocks using `True`/`False`, numeric comparisons, and `and`/`&` or `or`/`|` combinations, with Compile and Stop controls.
- Position, direction, and harvested-inventory getters (`get_position()`, `get_x_cord()`, `get_y_cord()`, `get_direction()`, `get_inventory(type)`) and `print()` for quoted messages or returned values.
- Tab indentation and Shift+Tab outdentation; Escape then Tab leaves the editor.
- A numeric balance above the editor, initialized to `0.00`.
- Seed and harvest inventories below the field, with harvest inventory below seeds.
- Unlimited free wheat seeds; tomato and cucumber seeds start at zero. All harvested counts start at zero.
- Extendable plant classes for wheat, tomato, and cucumber, each defining seed price, growth time, and selling price.
- Sequential commands and loop checks with 500 ms pauses, whole-program validation, and an output log capped at 200 lines.
- Position, crops, balance, and inventory preserved between runs in the current page session.
- JSON save and load controls preserve the complete farm state and editor code across page reloads or devices.
- A collapsible shop below the output panel for purchasing field expansions with earned balance.

## Documentation

- [Language](language.md): syntax, commands, loops, and controls.
- [Farming](farming.md): plant values, inventories, growth, and harvest rules.
- [Development](development.md): architecture, build and test commands.
- [Future ideas](future_ideas.md): possible future language and editor features.
- [To-do list](to-do.md): user-maintained requests; no completion notes are added there.

## Current scope

Selling is supported through `sell(type, quantity)`, using each plant's selling price. Buying seeds is not implemented yet, so tomato and cucumber seeds still cannot be acquired through the interface. Harvesting stores produce; selling removes it and credits the balance.

Variables, arithmetic, user-defined functions, automatic persistence, and backend integration are not implemented. Manual JSON save files can be downloaded and loaded; the Deno backend remains unchanged and the game runs entirely in the frontend.

## Saving and loading

Use **Save** above the field to download `robot-farmer-save.json`. The file contains the balance, field size, position, facing direction, seed and harvest inventories, occupied crop tiles, and editor code. Money is stored as integer cents, unlimited wheat is represented by `"unlimited"`, and the format includes a version number.

Use **Load** to select a JSON save. The complete file is validated before the current game is replaced. Invalid, unsupported, or malformed saves leave the existing game unchanged. Loaded crops restart as newly planted seedlings; crop maturity is intentionally not saved yet.

The command reference is collapsed initially; click its header or use Enter/Space while focused to collapse or expand it. The arrow shows its state.

If blocks support an optional indented `else:` branch. Both branches are validated; only the chosen branch runs.

`is_harvestable()` returns a boolean for the selected tile and works in conditions, logical combinations, standalone calls, and `print()`.

## Interface language

Use the globe selector in the upper-right corner to choose English or Deutsch. English is the default on every page load. The selector translates interface labels, inventory names, descriptions, help, status labels, and accessibility text. Balance uses the selected language's decimal separator.

Switching language does not reload or reset the game, edit player code, or change execution. Commands and arguments stay in English (`move()`, `plant(wheat)`). Player-printed text and detailed runtime diagnostics stay unchanged. Robot Farmer remains the project name.
