# Language

This is a small Python-inspired language, not a general Python or JavaScript runtime.

## Commands

Write one statement per line. Arguments are lowercase names without quotes.

| Command | Behavior |
| --- | --- |
| `move()` | Move one tile right (the default). |
| `move(right)` | Move one tile right. Also accepts `left`, `up`, or `down`. |
| `reset()` | Return the selection to (0, 0), preserving crops and inventories. |
| `plant(wheat)` | Plant on the selected empty tile. Also accepts `tomato` or `cucumber`. Requires a seed. |
| `harvest()` | Remove the selected plant; add it to harvest inventory only if fully grown. |

The old `right()`, `left()`, `up()`, and `down()` commands have been replaced and are rejected. A blocked edge move stays in place and continues execution. Missing seeds, occupied tiles, and empty harvests print a message and continue without consuming inventory.

```python
plant(wheat)
harvest()
move()
```

Wheat grows in 0.5 seconds, so it is ready when the next command executes after its 500 ms pause. For other plants and inventory rules, see [Farming](farming.md).

## While loops

```python
while(True):
    plant(wheat)
    harvest()
    move()
```

`while(True):` repeats until Stop is pressed. `while(False):` skips its body and continues afterward. Skipped bodies are still syntax-checked. Nested loops are supported. Only the case-sensitive constants `True` and `False` are accepted as conditions.

A loop header requires parentheses, a colon, and a nonempty body indented four spaces beyond the header. `while(True):` alone is incomplete.

## Indentation and editing

- Top-level statements start in column one. Each nested block adds four spaces. Dedenting ends a block.
- Tab inserts four spaces or indents selected lines. Shift+Tab removes indentation. Escape then Tab lets keyboard focus leave the editor.
- Literal tab characters pasted into the source are rejected. The Tab key inserts spaces.
- Blank lines and full-line `# comments` are ignored and do not count as a loop body.
- Trailing whitespace and spaces inside parentheses are accepted.
- Semicolons, quoted arguments, inline comments, and multiple statements on a line are unsupported.

## Compile, Stop, and state

Compile validates the complete program before any action runs. Syntax errors reject the whole program, show the faulty lines, and leave the farm unchanged. Empty/comment-only programs do nothing.

Valid programs continue from the current position. Commands and loop checks each pause for 500 ms before executing. Stop cancels the pending action and preserves the last completed state. Controls unlock once the current timer settles (normally within 500 ms; browsers can delay background timers).

The editor is read-only and Compile is disabled while running. Output retains its latest 200 lines and is cleared on each Compile attempt. Reloading the page starts a new session at (0, 0) with the initial inventory. `reset()` changes only position.

Loop checks yield even in true loops containing only false loops. Infinite loops are not expanded into arrays and run until stopped. No automatic iteration limit, `break`, `continue`, variables, or expressions are provided yet.
