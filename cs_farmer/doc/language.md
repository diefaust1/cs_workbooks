# Language

This is a small Python-inspired language, not a general Python or JavaScript runtime.

## Commands

Write one statement per line. Direction and plant arguments are lowercase names without quotes. String messages passed to `print()` require single or double quotes.

| Command | Behavior |
| --- | --- |
| `move()` | Move one tile in the current facing direction (initially right). |
| `direction(right)` | Turn without moving. Accepts `up`, `down`, `left`, or `right`. |
| `reset()` | Return the selection to (0, 0), preserving crops and inventories. |
| `reset_field()` | Clear all crops and return to (0, 0), preserving balance and inventories. |
| `get_position()` | Return a fresh two-item coordinate list, displayed as `(x, y)`. |
| `get_x_cord()` | Return the current x coordinate. |
| `get_y_cord()` | Return the current y coordinate. |
| `get_direction()` | Return `up`, `down`, `left`, or `right` for the current facing direction. |
| `get_inventory(wheat)` | Return the harvested inventory count. Also accepts `tomato`, `cucumber`, or `watermelon`. |
| `print("Hello")` | Print a quoted message or a value such as `get_position()`. |
| `buy(tomato, 2)` | Buy tomato seeds using balance. Quantity may be a number or numeric getter. |
| `plant(wheat)` | Plant on the selected empty tile. Also accepts `tomato`, `cucumber`, or `watermelon`. Requires a seed. |
| `is_harvestable()` | Return True for a mature plant on the selected tile, otherwise False. |
| `sell(wheat, get_inventory(wheat))` | Sell harvested plants and credit balance. Quantity may be a number or numeric getter. |
| `harvest()` | Remove the selected plant; healthy mature watermelons use square yield multipliers. |
| `break()` | Exit the nearest enclosing `while` or `for` loop. |

The old `right()`, `left()`, `up()`, and `down()` commands have been replaced and are rejected. A blocked edge move stays in place and continues execution. Missing seeds, occupied tiles, and empty harvests print a message and continue without consuming inventory.

```python
plant(wheat)
harvest()
move()
```

Wheat grows in 0.6 seconds, so an immediately following command still reaches it before maturity. Add more work or explicitly check `is_harvestable()` before harvesting. For other plants and inventory rules, see [Farming](farming.md).

## While loops

```python
while(True):
    plant(wheat)
    harvest()
    move()
```

`while(True):` repeats until Stop is pressed. `while(False):` skips its body and continues afterward. Skipped bodies are still syntax-checked. Nested loops are supported. Conditions accept `True`, `False`, numeric comparisons, and combinations using `and`/`&` or `or`/`|`. Each loop check reads the current coordinate values again.

A loop header requires parentheses, a colon, and a nonempty body indented four spaces beyond the header. `while(True):` alone is incomplete.

## For loops and break

```python
for i in range(5):
    move()
```

`for name in range(count):` repeats its body exactly `count` times. The count must be a non-negative whole-number literal. The name is required by the syntax but cannot be read inside the body yet, so `print(i)` is rejected. Only the one-argument `range(count)` form is supported.

`break()` immediately exits the nearest enclosing `while` or `for` loop and continues after it. It may be nested inside an `if` or another loop, but is rejected when it is not inside a loop.

## If blocks

```python
if(True):
    print("Planting here")
    plant(wheat)
if(False):
    reset_field()
print(get_position())
```

`if(True):` executes its body once, then continues after the block. `if(False):` skips its body and runs its `else:` body when present. Both use the same four-space indentation as loops and can nest with if/while/for blocks. All branches are syntax-checked before anything executes. Headers require a nonempty body.

Conditions accept the case-sensitive literals `True` and `False`, or one comparison. Numbers and the numeric getters `get_x_cord()`, `get_y_cord()`, and `get_inventory(type)` support `==`, `!=`, `<`, `<=`, `>`, and `>=`. Strings and `get_direction()` support only `==` and `!=`. Both operands must have the same supported type. Signed decimal numbers and getter-to-getter comparisons are supported.

```python
while(get_x_cord() < 4):
    move()
if(get_x_cord() == 4):
    print("Reached the edge")
if(get_direction() != "right"):
    direction(right)
```

Conditions are evaluated when reached, and while conditions are evaluated again before every iteration. Comparisons do not coerce between strings, numbers, or booleans. Coordinate tuples (`get_position()`), ordered string comparisons such as `<`, chained comparisons, `not`, arithmetic, and `elif` are not supported.

## Combining conditions and else

Both `and` and `&` mean logical AND; both `or` and `|` mean logical OR. The symbols are boolean aliases, not bitwise operators. Comparisons bind first, followed by AND, then OR. Parentheses override grouping. `&&` and `||` are not supported.

```python
if(get_x_cord() == 0 & get_y_cord() == 0):
    print("At the starting tile")
else:
    print("Somewhere else")

while(get_x_cord() < 4 and (get_y_cord() == 0 or False)):
    move()
```

Evaluation short-circuits: AND skips remaining operands after False, and OR skips them after True. The parser still validates every operand and branch before execution. Grouped conditions can nest up to 64 parser levels; excessively nested conditions are rejected.

`else:` must follow its matching if block at the same indentation, with a nonempty body indented four additional spaces. Blank lines and full-line comments between branches are allowed. Only one else is allowed per if. Else cannot follow a while or an intervening statement. Nested if/else branches bind according to indentation; exactly one branch executes on each visit. Else has no condition and introduces no additional condition-check delay. Its commands keep the normal 500 ms pauses.

## Position and printing

```python
move()
print(get_position())
print(get_x_cord())
print(get_y_cord())
print(get_direction())
print(get_inventory(wheat))
print('Finished')
```

On a field of at least 2x2, starting at (0, 0) with an empty harvest inventory, these print `(1, 0)`, `1`, `0`, `right`, `0`, and `Finished`. Getters read the current state when the statement executes, not when compiled. Standalone getter calls are also accepted and their returned values appear in the execution log. Variables and assignments are not yet supported.

`print()` accepts exactly one quoted string, number, boolean literal, or getter call, including `is_harvestable()`. It outputs the value on its own line without a movement-log prefix. Strings support escaped quotes, backslashes, and `\n`, `\r`, and `\t`. Empty quoted strings are allowed; `print()` without an argument and unquoted text such as `print(hello)` are rejected. Output is inserted as text, so strings containing HTML are not rendered as markup. Multiline printed messages count toward the 200-line output limit.

## Indentation and editing

- Top-level statements start in column one. Each nested block adds four spaces. Dedenting ends a block.
- Tab inserts four spaces or indents selected lines. Shift+Tab removes indentation. Escape then Tab lets keyboard focus leave the editor.
- Literal tab characters pasted into the source are rejected. The Tab key inserts spaces.
- Blank lines and full-line `# comments` are ignored and do not count as a loop body.
- Trailing whitespace and spaces inside parentheses are accepted.
- Semicolons, inline comments, and multiple statements on a line are unsupported. Quoted strings are supported only as print arguments.

## Compile, Stop, and state

Compile validates the complete program before any action runs. Syntax errors reject the whole program, show the faulty lines, and leave the farm unchanged. Empty/comment-only programs do nothing.

Valid programs continue from the current position. Commands (including print/getters/reset_field) and loop/if checks each pause for 500 ms before executing. Stop cancels the pending action and preserves the last completed state. Every editor shares the same farm state. Only one program can run at a time, so all other Run buttons are disabled until it completes or stops. The shared output names the program when execution starts.

Use **Add new editor** to append another nameable program. Editors can be collapsed independently. Added editors can be deleted after confirmation; the first editor cannot be deleted. While a program runs, all editors are read-only and their Run buttons are disabled. Output retains its latest 200 lines and is cleared on each Compile attempt. Reloading the page starts a new session at (0, 0) with the initial inventory unless a save is loaded. `reset()` resets position and facing to (0, 0) and right, preserving crops and inventory.

Loop checks yield even in true loops containing only false loops. Loops are not expanded into arrays, and infinite while loops run until stopped or interrupted with `break()`. No automatic iteration limit, `continue`, usable variables, or arithmetic expressions are provided yet.

`move()` and `move( )` take no arguments. Set facing with `direction(up)`, `direction(down)`, `direction(left)`, or `direction(right)`. The old argument-taking movement form is rejected.

## Harvestability, purchases, and sales

```python
plant(wheat)
if(is_harvestable() and get_x_cord() == 0):
    harvest()
    sell(wheat, 1)
print(is_harvestable())
```

Use the boolean directly in if/while conditions or combine it with `and`/`&` and `or`/`|`. It is not a numeric comparison operand. `print(is_harvestable())` displays True or False.

`sell(type, quantity)` requires two comma-separated arguments. Quantity may be a numeric literal, `get_x_cord()`, `get_y_cord()`, or `get_inventory(type)`. It is evaluated when the command executes and must produce a non-negative safe whole number; zero is a no-op. A sale requires enough harvested plants and never partially sells an order. An invalid result or insufficient stock logs a message and continues. See [Farming](farming.md) for prices and inventory rules.

`buy(type, quantity)` uses the same argument rules and requires enough balance for the complete purchase. It never partially buys an order. The accepted plant names for buying, planting, selling, and inventory checks are `wheat`, `tomato`, `cucumber`, and `watermelon`.

A mature withered plant still makes `is_harvestable()` return True because `harvest()` must remove it, but it produces no inventory. Healthy watermelon squares from 2x2 through 6x6 are harvested as one group when any part is selected; see [Farming](farming.md) for their yield multipliers.

## German interface

The English/Deutsch selector changes help and interface text only. Keep writing the exact command names and argument tokens documented here, even in German mode. For example, use `move()`, not `bewegen()`, and `plant(wheat)`, not `plant(weizen)`. Strings you write in `print()` are preserved exactly. Runtime diagnostics remain in English.

## Facing direction

A new page session starts facing right. `move()` advances one tile in the current direction; `direction(up/down/left/right)` selects a new direction without changing position. `get_direction()` returns that lowercase direction name. Use one of those four names as the argument, not the slash-separated list.

```python
direction(down)
move()
move()
direction(right)
move()
```

On a field of at least 3x3, starting at (0, 0), this ends at (1, 2). Direction persists between Compile runs and after Stop. Both `reset()` and `reset_field()` return to (0, 0) and restore the default direction, right. Reloading starts a new 1x1 session facing right. Both turning and moving have their own 500 ms execution pause. At an edge, movement stays on the field and keeps the direction.

The selected tile has red sides and a blue facing edge. Its accessible description also names the facing direction. Direction names in player code remain English in German interface mode. `move(right)` is no longer valid; use `direction(right)` followed by `move()`.
