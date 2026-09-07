# Robot Farmer

Robot Farmer (`cs_farmer`) is a browser-based farming and programming game inspired by *The Farmer Was Replaced*. Players write a small Python-inspired language to move around a field, plant crops, and harvest them.

## Current features

- A 5x5 field with a red border around the selected tile and visible growing/mature plants.
- `move(direction)`, defaulting to right with `move()`, plus `reset()`, `plant(type)`, and `harvest()`.
- Indented, nested `while(True):` and `while(False):` loops, with Compile and Stop controls.
- Tab indentation and Shift+Tab outdentation; Escape then Tab leaves the editor.
- A numeric balance above the editor, initialized to `0.00`.
- Seed and harvest inventories above the field, with harvest inventory below seeds.
- Unlimited free wheat seeds; tomato and cucumber seeds start at zero. All harvested counts start at zero.
- Extendable plant classes for wheat, tomato, and cucumber, each defining seed price, growth time, and selling price.
- Sequential commands and loop checks with 500 ms pauses, whole-program validation, and an output log capped at 200 lines.
- Position, crops, balance, and inventory preserved between runs in the current page session.

## Documentation

- [Language](language.md): syntax, commands, loops, and controls.
- [Farming](farming.md): plant values, inventories, growth, and harvest rules.
- [Development](development.md): architecture, build and test commands.
- [To-do list](to-do.md): user-maintained requests; no completion notes are added there.

## Current scope

Buying and selling controls/commands have not been added. Seed and selling prices are defined on the plant classes for future use. Harvesting adds produce to inventory, not money, so balance currently stays at zero. Tomato and cucumber growth are implemented and tested, but the player cannot acquire their seeds yet.

Variables, expressions, `if`, functions, saving across reloads, and backend integration are not implemented. The Deno backend is unchanged; the game runs entirely in the frontend.
