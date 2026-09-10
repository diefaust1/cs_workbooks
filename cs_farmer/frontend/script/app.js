(() => {
  // frontend/script/plants.ts
  var Plant = class {
    constructor(plantedAt) {
      this.plantedAt = plantedAt;
    }
    plantedAt;
    isGrown(now) {
      return now - this.plantedAt >= this.growthTime * 1e3;
    }
  };
  var Wheat = class extends Plant {
    name = "wheat";
    seedPrice = 0;
    growthTime = 0.6;
    sellingPrice = 0.5;
  };
  var Tomato = class extends Plant {
    name = "tomato";
    seedPrice = 0.2;
    growthTime = 2;
    sellingPrice = 2;
  };
  var Cucumber = class extends Plant {
    name = "cucumber";
    seedPrice = 0.5;
    growthTime = 4;
    sellingPrice = 5;
  };
  var plantTypes = { wheat: Wheat, tomato: Tomato, cucumber: Cucumber };
  var plantNames = Object.keys(plantTypes);
  var plantInfo = Object.fromEntries(plantNames.map((name) => [name, new plantTypes[name](0)]));

  // frontend/script/farm.ts
  var INITIAL_FIELD_SIZE = 1;
  var MAX_FIELD_SIZE = 6;
  function createFarm(size = INITIAL_FIELD_SIZE) {
    if (!Number.isInteger(size) || size < INITIAL_FIELD_SIZE || size > MAX_FIELD_SIZE) throw new Error("Invalid field size.");
    return {
      tiles: Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_2, x) => ({ x, y, plant: null }))),
      size,
      position: { x: 0, y: 0 },
      direction: "right",
      balance: 0,
      seeds: { wheat: Infinity, tomato: 0, cucumber: 0 },
      harvest: { wheat: 0, tomato: 0, cucumber: 0 }
    };
  }
  function move(farm2) {
    const offsets = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
    const offset = offsets[farm2.direction];
    const x = Math.max(0, Math.min(farm2.size - 1, farm2.position.x + offset.x));
    const y = Math.max(0, Math.min(farm2.size - 1, farm2.position.y + offset.y));
    const moved = x !== farm2.position.x || y !== farm2.position.y;
    farm2.position = { x, y };
    return moved;
  }
  function plant(farm2, name, now) {
    const tile = farm2.tiles[farm2.position.y][farm2.position.x];
    if (tile.plant) return { success: false, message: "Tile occupied. Harvest it before planting." };
    if (farm2.seeds[name] < 1) return { success: false, message: `No ${name} seeds available.` };
    farm2.seeds[name]--;
    tile.plant = new plantTypes[name](now);
    return { success: true, message: `Planted ${name}.` };
  }
  function harvest(farm2, now) {
    const tile = farm2.tiles[farm2.position.y][farm2.position.x];
    if (!tile.plant) return { success: false, message: "Nothing to harvest on this tile." };
    const crop = tile.plant;
    tile.plant = null;
    if (!crop.isGrown(now)) return { success: true, message: `Removed immature ${crop.name}; nothing added to harvest.` };
    farm2.harvest[crop.name]++;
    return { success: true, message: `Harvested ${crop.name}.` };
  }
  function resetField(farm2) {
    for (const row of farm2.tiles) for (const tile of row) tile.plant = null;
    farm2.position = { x: 0, y: 0 };
    farm2.direction = "right";
  }
  function getPosition(farm2) {
    return [farm2.position.x, farm2.position.y];
  }
  function getXCord(farm2) {
    return farm2.position.x;
  }
  function getYCord(farm2) {
    return farm2.position.y;
  }
  function getDirection(farm2) {
    return farm2.direction;
  }
  function getInventory(farm2, name) {
    return farm2.harvest[name];
  }
  function getExpansionCost(farm2) {
    return farm2.size < MAX_FIELD_SIZE ? 4 ** farm2.size : void 0;
  }
  function expandField(farm2) {
    const cost = getExpansionCost(farm2);
    if (cost === void 0) return { success: false, message: "Maximum field size reached." };
    if (farm2.balance < cost) return { success: false, message: `Not enough balance to expand the field; need ${cost.toFixed(2)}.` };
    const oldSize = farm2.size;
    const newSize = oldSize + 1;
    for (let y = 0; y < oldSize; y++) farm2.tiles[y].push({ x: oldSize, y, plant: null });
    farm2.tiles.push(Array.from({ length: newSize }, (_, x) => ({ x, y: oldSize, plant: null })));
    farm2.size = newSize;
    farm2.balance = (Math.round(farm2.balance * 100) - cost * 100) / 100;
    return { success: true, message: `Field expanded to ${newSize} x ${newSize}.` };
  }
  function isHarvestable(farm2, now) {
    return farm2.tiles[farm2.position.y][farm2.position.x].plant?.isGrown(now) ?? false;
  }
  function sell(farm2, name, quantity) {
    if (!Number.isSafeInteger(quantity) || quantity < 0) return { success: false, message: "Sale quantity must be a non-negative whole number." };
    if (farm2.harvest[name] < quantity) return { success: false, message: `Not enough harvested ${name}; requested ${quantity}, available ${farm2.harvest[name]}.` };
    const income = plantInfo[name].sellingPrice * quantity;
    const totalCents = Math.round(farm2.balance * 100) + Math.round(income * 100);
    if (!Number.isSafeInteger(totalCents)) return { success: false, message: "Sale exceeds the supported balance." };
    farm2.harvest[name] -= quantity;
    farm2.balance = totalCents / 100;
    return { success: true, message: `Sold ${quantity} ${name} for ${income.toFixed(2)}.` };
  }

  // frontend/script/expressions.ts
  function parseExpression(source) {
    const text = source.trim();
    const inventory = /^get_inventory\(\s*(wheat|tomato|cucumber)\s*\)$/.exec(text);
    if (inventory) return { kind: "inventory", plant: inventory[1] };
    const getter = /^(get_position|get_x_cord|get_y_cord|get_direction|is_harvestable)\(\s*\)$/.exec(text);
    if (getter) return { kind: "getter", name: getter[1] };
    if (text === "True" || text === "False") return { kind: "literal", value: text === "True" };
    if (/^-?\d+(?:\.\d+)?$/.test(text) && Number.isFinite(Number(text))) return { kind: "literal", value: Number(text) };
    const quoted = /^(?:"((?:[^"\\]|\\["'\\nrt])*)"|'((?:[^'\\]|\\["'\\nrt])*)')$/.exec(text);
    if (!quoted) return void 0;
    const escapes = { n: "\n", r: "\r", t: "	", "\\": "\\", "'": "'", '"': '"' };
    return { kind: "literal", value: (quoted[1] ?? quoted[2]).replace(/\\(["'\\nrt])/g, (_, key) => escapes[key]) };
  }
  function evaluateExpression(expression, farm2, now = performance.now()) {
    if (expression.kind === "literal") return expression.value;
    if (expression.kind === "inventory") return getInventory(farm2, expression.plant);
    if (expression.name === "is_harvestable") return isHarvestable(farm2, now);
    if (expression.name === "get_position") return getPosition(farm2);
    if (expression.name === "get_direction") return getDirection(farm2);
    return expression.name === "get_x_cord" ? getXCord(farm2) : getYCord(farm2);
  }
  function formatValue(value) {
    if (Array.isArray(value)) return `(${value[0]}, ${value[1]})`;
    if (typeof value === "boolean") return value ? "True" : "False";
    return String(value);
  }
  function parseCondition(source, nesting = 0) {
    const text = source.trim();
    if (!text || nesting > 64) return void 0;
    for (const kind of ["or", "and"]) {
      const parts = [];
      let depth = 0;
      let start = 0;
      let outerClosesAt = -1;
      for (let index = 0; index < text.length; index++) {
        if (text[index] === "(") depth++;
        else if (text[index] === ")") {
          if (--depth < 0) return void 0;
          if (depth === 0 && outerClosesAt === -1) outerClosesAt = index;
        }
        if (depth !== 0) continue;
        const symbol = kind === "or" ? "|" : "&";
        const word = text.slice(index, index + kind.length) === kind && !/[a-zA-Z0-9_]/.test(text[index - 1] ?? "") && !/[a-zA-Z0-9_]/.test(text[index + kind.length] ?? "");
        if (text[index] === symbol || word) {
          parts.push(text.slice(start, index));
          index += word ? kind.length - 1 : 0;
          start = index + 1;
        }
      }
      if (depth !== 0) return void 0;
      if (parts.length) {
        parts.push(text.slice(start));
        const operands = parts.map((part) => parseCondition(part, nesting + 1));
        if (operands.some((part) => part === void 0)) return void 0;
        return { kind, operands };
      }
      if (text.startsWith("(") && outerClosesAt === text.length - 1) {
        return parseCondition(text.slice(1, -1), nesting + 1);
      }
    }
    if (text === "True" || text === "False") return text === "True";
    if (/^is_harvestable\(\s*\)$/.test(text)) return { kind: "harvestable" };
    const comparison = /^(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)$/.exec(text);
    if (!comparison) return void 0;
    const left = parseExpression(comparison[1]);
    const right = parseExpression(comparison[3]);
    const numeric = (value) => !!value && (value.kind === "literal" ? typeof value.value === "number" : value.kind === "inventory" || value.name === "get_x_cord" || value.name === "get_y_cord");
    if (!numeric(left) || !numeric(right)) return void 0;
    return { left, operator: comparison[2], right };
  }
  function evaluateCondition(condition, farm2, now = performance.now()) {
    if (typeof condition === "boolean") return condition;
    if ("kind" in condition) {
      if (condition.kind === "harvestable") return isHarvestable(farm2, now);
      return condition.kind === "and" ? condition.operands.every((operand) => evaluateCondition(operand, farm2, now)) : condition.operands.some((operand) => evaluateCondition(operand, farm2, now));
    }
    const left = evaluateExpression(condition.left, farm2);
    const right = evaluateExpression(condition.right, farm2);
    if (typeof left !== "number" || typeof right !== "number") throw new Error("Comparison operands must be numbers.");
    switch (condition.operator) {
      case "==":
        return left === right;
      case "!=":
        return left !== right;
      case "<":
        return left < right;
      case "<=":
        return left <= right;
      case ">":
        return left > right;
      case ">=":
        return left >= right;
    }
  }

  // frontend/script/program.ts
  var STEP_DELAY_MS = 500;
  function compileProgram(source) {
    const instructions = [];
    const errors = [];
    const blocks = [{ body: instructions }];
    let pending;
    source.split(/\r?\n/).forEach((sourceLine, index) => {
      const line = sourceLine.trim();
      if (!line || line.startsWith("#")) return;
      const error = (message) => errors.push({ line: index + 1, source: sourceLine, message });
      const whitespace = sourceLine.match(/^\s*/)?.[0] ?? "";
      if (/[^ ]/.test(whitespace) || whitespace.length % 4 !== 0) {
        error("Use four spaces per indentation level; tabs are not supported.");
        return;
      }
      const depth = whitespace.length / 4;
      if (pending) {
        if (depth === blocks.length) blocks.push(pending);
        else errors.push({ ...pending.owner, message: `Expected ${pending.kind === "while" ? "a loop" : pending.kind === "if" ? "an if" : "an else"} body indented by four spaces.` });
        pending = void 0;
      }
      if (depth >= blocks.length) {
        error("Unexpected indentation. Only a while, if, or else block introduces an indented body.");
        return;
      }
      blocks.length = depth + 1;
      const body = blocks[depth].body;
      if (/^else\s*:$/.test(line)) {
        const previous = body[body.length - 1];
        if (!previous || "command" in previous || previous.kind !== "if" || previous.elseBody) {
          error("else must follow an if block at the same indentation, with only one else per if.");
          return;
        }
        previous.elseBody = [];
        pending = { kind: "else", body: previous.elseBody, owner: { line: index + 1, source: sourceLine } };
        return;
      }
      const movement = /^direction\(\s*(up|down|left|right)\s*\)$/.exec(line);
      const sale = /^sell\(\s*(wheat|tomato|cucumber)\s*,\s*(\d+)\s*\)$/.exec(line);
      const planting = /^plant\(\s*(wheat|tomato|cucumber)\s*\)$/.exec(line);
      const inventoryGetter = /^get_inventory\(\s*(wheat|tomato|cucumber)\s*\)$/.exec(line);
      const command = /^(move|harvest|reset|reset_field|get_position|get_x_cord|get_y_cord|get_direction|is_harvestable)\(\s*\)$/.exec(line);
      const block = /^(while|if)\s*\((.*)\)\s*:$/.exec(line);
      const condition = block ? parseCondition(block[2]) : void 0;
      const printing = /^print\((.*)\)$/.exec(line);
      const expression = printing ? parseExpression(printing[1]) : void 0;
      if (movement) {
        body.push({ command: "direction", argument: movement[1], line: index + 1 });
      } else if (sale && Number.isSafeInteger(Number(sale[2]))) {
        body.push({ command: "sell", argument: sale[1], quantity: Number(sale[2]), line: index + 1 });
      } else if (planting) {
        body.push({ command: "plant", argument: planting[1], line: index + 1 });
      } else if (inventoryGetter) {
        body.push({ command: "get_inventory", argument: inventoryGetter[1], line: index + 1 });
      } else if (command) {
        body.push({ command: command[1], line: index + 1 });
      } else if (printing && expression) {
        body.push({ command: "print", expression, line: index + 1 });
      } else if (block && condition !== void 0) {
        const statement = { kind: block[1], condition, body: [], line: index + 1 };
        body.push(statement);
        pending = { kind: statement.kind, body: statement.body, owner: { line: index + 1, source: sourceLine } };
      } else {
        errors.push({ line: index + 1, source: sourceLine });
      }
    });
    if (pending) errors.push({ ...pending.owner, message: `Expected ${pending.kind === "while" ? "a loop" : pending.kind === "if" ? "an if" : "an else"} body indented by four spaces.` });
    return errors.length ? { ok: false, errors } : { ok: true, instructions };
  }
  var pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  async function runProgram(instructions, farm2, onStep, wait = pause, signal, now = () => performance.now()) {
    const stack = [{ body: instructions, index: 0 }];
    while (stack.length) {
      if (signal?.aborted) return "stopped";
      const frame = stack[stack.length - 1];
      if (frame.index >= frame.body.length) {
        stack.pop();
        continue;
      }
      const statement = frame.body[frame.index];
      await wait(STEP_DELAY_MS);
      if (signal?.aborted) return "stopped";
      if ("command" in statement) {
        frame.index++;
        let moved = false;
        let result = { success: true, message: "" };
        if (statement.command === "move") {
          moved = move(farm2);
          result.message = moved ? "Moved." : "Edge reached; staying here.";
        } else if (statement.command === "direction") {
          farm2.direction = statement.argument;
          result.message = `Facing ${farm2.direction}.`;
        } else if (statement.command === "reset") {
          farm2.position = { x: 0, y: 0 };
          farm2.direction = "right";
          result.message = "Position reset.";
        } else if (statement.command === "reset_field") {
          resetField(farm2);
          result.message = "Field cleared. Position reset to (0, 0).";
        } else if (statement.command === "plant") result = plant(farm2, statement.argument, now());
        else if (statement.command === "sell") result = sell(farm2, statement.argument, statement.quantity);
        else if (statement.command === "harvest") result = harvest(farm2, now());
        else {
          const expression = statement.command === "print" ? statement.expression : statement.command === "get_inventory" ? { kind: "inventory", plant: statement.argument } : { kind: "getter", name: statement.command };
          const value = formatValue(evaluateExpression(expression, farm2, now()));
          result = { success: true, message: value, ...statement.command === "print" ? { output: value } : {} };
        }
        onStep({ instruction: statement, position: { ...farm2.position }, moved, ...result });
      } else if (evaluateCondition(statement.condition, farm2, now())) {
        if (statement.kind === "if") frame.index++;
        stack.push({ body: statement.body, index: 0 });
      } else {
        frame.index++;
        if (statement.kind === "if" && statement.elseBody) {
          stack.push({ body: statement.elseBody, index: 0 });
        }
      }
    }
    return "complete";
  }

  // frontend/script/editor.ts
  function enableIndentation(editor2) {
    let releaseTab = false;
    editor2.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        releaseTab = true;
        return;
      }
      const letTabLeave = releaseTab;
      releaseTab = false;
      if (event.key !== "Tab" || letTabLeave || editor2.readOnly || event.ctrlKey || event.altKey || event.metaKey) return;
      event.preventDefault();
      const { value, selectionStart: start, selectionEnd: end } = editor2;
      if (!event.shiftKey && !value.slice(start, end).includes("\n")) {
        editor2.setRangeText("    ", start, end, "end");
        return;
      }
      const firstLine = value.lastIndexOf("\n", start - 1) + 1;
      const lastCharacter = end > start && value[end - 1] === "\n" ? end - 1 : end;
      const nextNewline = value.indexOf("\n", lastCharacter);
      const lastLine = nextNewline === -1 ? value.length : nextNewline;
      let firstDelta = 0;
      let totalDelta = 0;
      const replacement = value.slice(firstLine, lastLine).split("\n").map((line, index) => {
        const remove = event.shiftKey ? Math.min(4, line.match(/^ */)[0].length) : 0;
        const delta = event.shiftKey ? -remove : 4;
        if (index === 0) firstDelta = delta;
        totalDelta += delta;
        return event.shiftKey ? line.slice(remove) : "    " + line;
      }).join("\n");
      editor2.setRangeText(replacement, firstLine, lastLine, "preserve");
      editor2.setSelectionRange(Math.max(firstLine, start + firstDelta), Math.max(firstLine, end + totalDelta));
    });
  }

  // frontend/script/i18n.ts
  var german = {
    "A little code. A little cultivation.": "Ein wenig Code. Ein wenig Landwirtschaft.",
    "Balance": "Guthaben",
    "Save": "Speichern",
    "Load": "Laden",
    "Save game controls": "Steuerelemente zum Speichern des Spiels",
    "Game saved.": "Spiel gespeichert.",
    "Game loaded.": "Spiel geladen.",
    "Could not load save file:": "Spielstand konnte nicht geladen werden:",
    "Unknown error.": "Unbekannter Fehler.",
    "Shop": "Shop",
    "Current field": "Aktuelles Feld",
    "Expand to": "Erweitern auf",
    "Maximum field size reached.": "Maximale Feldgr\xF6\xDFe erreicht.",
    "Your code": "Dein Code",
    "EDITOR": "EDITOR",
    "Write your farm code": "Schreibe deinen Farm-Code",
    "Insert code here...": "Code hier eingeben...",
    "Compile": "Ausf\xFChren",
    "Stop": "Stopp",
    "Output": "Ausgabe",
    "Program output": "Programmausgabe",
    "READY": "BEREIT",
    "RUNNING": "L\xC4UFT",
    "REJECTED": "ABGELEHNT",
    "COMPLETE": "ABGESCHLOSSEN",
    "STOPPED": "GESTOPPT",
    "ERROR": "FEHLER",
    "Write your commands, then click Compile.": "Schreibe deine Befehle und klicke auf Ausf\xFChren.",
    "Your field": "Dein Feld",
    "TILE": "FELD",
    "TILES": "FELDER",
    "Seeds": "Saatgut",
    "Harvest inventory": "Erntevorrat",
    "Wheat": "Weizen",
    "Tomato": "Tomate",
    "Cucumber": "Gurke",
    "Unlimited wheat seeds": "Unbegrenztes Weizensaatgut",
    "Commands": "Befehle",
    "Example loop": "Beispielschleife",
    "Return True if the selected tile has a fully grown plant; otherwise False.": "Gibt True zur\xFCck, wenn die Pflanze auf dem ausgew\xE4hlten Feld ausgewachsen ist, sonst False.",
    "Sell a whole number of harvested wheat, tomato, or cucumber plants and add their value to your balance.": "Verkaufe eine ganze Anzahl geernteter Pflanzen (wheat, tomato oder cucumber). Der Erl\xF6s wird deinem Guthaben gutgeschrieben.",
    "Plant wheat, tomato, or cucumber on an empty tile, using one seed. Wheat seeds are unlimited.": "Pflanze wheat (Weizen), tomato (Tomate) oder cucumber (Gurke) auf einem leeren Feld. Das verbraucht einen Samen; Weizensaatgut ist unbegrenzt.",
    "Collect a grown plant. An immature plant is removed without a reward.": "Ernte eine ausgewachsene Pflanze. Eine unreife Pflanze wird ohne Ertrag entfernt.",
    "Return the current (x, y) coordinates.": "Gibt die aktuellen Koordinaten (x, y) zur\xFCck.",
    "Return the current x coordinate.": "Gibt die aktuelle x-Koordinate zur\xFCck.",
    "Return the current y coordinate.": "Gibt die aktuelle y-Koordinate zur\xFCck.",
    "Return the current direction.": "Gibt die aktuelle Blickrichtung zur\xFCck.",
    "Return the harvested inventory count for wheat, tomato, or cucumber.": "Gibt die Anzahl geernteter Pflanzen f\xFCr wheat, tomato oder cucumber zur\xFCck.",
    "Print a quoted string or value, such as print(get_position()). Single quotes work too.": "Gibt einen Text in Anf\xFChrungszeichen oder einen Wert aus, etwa print(get_position()). Einfache Anf\xFChrungszeichen funktionieren auch.",
    "Run the indented block once. if(False): skips it. Numeric comparisons are supported, such as get_x_cord() == 2.": "F\xFChrt den einger\xFCckten Block einmal aus. if(False): \xFCberspringt ihn. Zahlenvergleiche wie get_x_cord() == 2 sind m\xF6glich.",
    "Repeat while the condition is true. For example: while(get_x_cord() < 4):": "Wiederholt den Block, solange die Bedingung wahr ist. Beispiel: while(get_x_cord() < 4):",
    "Skip the indented block.": "\xDCberspringt den einger\xFCckten Block.",
    "Run this indented block when the matching if is false. Align else with its if.": "F\xFChrt diesen einger\xFCckten Block aus, wenn die zugeh\xF6rige if-Bedingung falsch ist. else und if m\xFCssen gleich einger\xFCckt sein.",
    "Both conditions must be true. Evaluated before or.": "Beide Bedingungen m\xFCssen wahr sein. Wird vor or ausgewertet.",
    "At least one condition must be true. Use parentheses to group conditions.": "Mindestens eine Bedingung muss wahr sein. Mit Klammern kannst du Bedingungen gruppieren.",
    "One statement per line. Tab inserts four spaces; Shift+Tab removes indentation. Press Escape then Tab to leave the editor. Commands and while/if checks each pause for 500 ms.": "Eine Anweisung pro Zeile. Tab f\xFCgt vier Leerzeichen ein; Umschalt+Tab entfernt die Einr\xFCckung. Mit Escape und anschlie\xDFend Tab verl\xE4sst du den Editor. Befehle und while/if-Pr\xFCfungen pausieren jeweils 500 ms.",
    "Blank lines and full-line # comments are allowed. Runs continue from the last position. Edge moves stay on the field.": "Leerzeilen und ganze Kommentarzeilen mit # sind erlaubt. Programme starten an der letzten Position. Am Rand bleibt die Auswahl auf dem Feld.",
    "Language": "Sprache",
    "Position": "Position",
    "Empty tile": "Leeres Feld",
    "Locked tile": "Gesperrtes Feld",
    "ready to harvest": "erntereif",
    "growing": "w\xE4chst",
    "Empty.": "Leer.",
    "Farm field. Size:": "Farmfeld. Gr\xF6\xDFe:",
    "Selected tile:": "Ausgew\xE4hltes Feld:",
    "wheat": "Weizen",
    "tomato": "Tomate",
    "cucumber": "Gurke",
    "Move one tile in the current direction. Starts facing right. The blue edge shows the facing side.": "Bewege dich ein Feld in Blickrichtung. Zu Beginn nach rechts. Die blaue Kante zeigt die Blickrichtung.",
    "Face up, down, left, or right without moving.": "Drehe dich nach up (oben), down (unten), left (links) oder right (rechts), ohne dich zu bewegen.",
    "Facing": "Blickrichtung",
    "up": "oben",
    "down": "unten",
    "left": "links",
    "right": "rechts",
    "Return to the upper-left tile, (0, 0), facing right.": "Kehre zum Feld oben links (0, 0) mit Blick nach rechts zur\xFCck.",
    "Remove every plant and return to (0, 0), facing right. Inventory and balance stay unchanged.": "Entferne alle Pflanzen und kehre zu (0, 0) mit Blick nach rechts zur\xFCck. Vorr\xE4te und Guthaben bleiben unver\xE4ndert."
  };
  function translate(text, language2) {
    return language2 === "de" ? german[text] ?? text : text;
  }
  function translatePage(language2) {
    document.documentElement.lang = language2;
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = translate(element.getAttribute("data-i18n"), language2);
    });
    for (const attribute of ["placeholder", "aria-label"]) {
      document.querySelectorAll(`[data-i18n-${attribute}]`).forEach((element) => {
        element.setAttribute(attribute, translate(element.getAttribute(`data-i18n-${attribute}`), language2));
      });
    }
  }

  // frontend/script/save.ts
  var SAVE_VERSION = 2;
  var SAVE_FORMAT = "cs_farmer_save";
  function createSaveFile(farm2, editorCode) {
    const plants = [];
    for (const row of farm2.tiles) {
      for (const tile of row) {
        if (tile.plant) {
          plants.push({ x: tile.x, y: tile.y, type: tile.plant.name });
        }
      }
    }
    return {
      format: SAVE_FORMAT,
      version: SAVE_VERSION,
      fieldSize: farm2.size,
      balanceCents: Math.round(farm2.balance * 100),
      position: { ...farm2.position },
      direction: farm2.direction,
      seeds: {
        wheat: "unlimited",
        tomato: farm2.seeds.tomato,
        cucumber: farm2.seeds.cucumber
      },
      harvest: { ...farm2.harvest },
      plants,
      editorCode
    };
  }
  function serializeGame(farm2, editorCode) {
    return JSON.stringify(createSaveFile(farm2, editorCode), null, 2);
  }
  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function requireRecord(value, name) {
    if (!isRecord(value)) throw new Error(`${name} must be an object.`);
    return value;
  }
  function requireInteger(value, name, maximum = Number.MAX_SAFE_INTEGER) {
    if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
      throw new Error(`${name} must be a non-negative whole number.`);
    }
    return value;
  }
  function requireInventory(value, name) {
    const inventory = requireRecord(value, name);
    return Object.fromEntries(
      plantNames.map((plant2) => [plant2, requireInteger(inventory[plant2], `${name}.${plant2}`)])
    );
  }
  function parseSaveFile(text, now) {
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error("The selected file is not valid JSON.");
    }
    const save = requireRecord(value, "Save file");
    if (save.format !== SAVE_FORMAT) {
      throw new Error("This is not a Robot Farmer save file.");
    }
    if (save.version !== 1 && save.version !== SAVE_VERSION) {
      throw new Error(`Unsupported save version: ${String(save.version)}.`);
    }
    const fieldSize = save.version === 1 ? 5 : requireInteger(save.fieldSize, "fieldSize", MAX_FIELD_SIZE);
    if (fieldSize < INITIAL_FIELD_SIZE) throw new Error("fieldSize is invalid.");
    const balanceCents = requireInteger(save.balanceCents, "balanceCents");
    const position = requireRecord(save.position, "position");
    const x = requireInteger(position.x, "position.x", fieldSize - 1);
    const y = requireInteger(position.y, "position.y", fieldSize - 1);
    const directions = ["up", "down", "left", "right"];
    if (!directions.includes(save.direction)) {
      throw new Error("direction is invalid.");
    }
    const seeds = requireRecord(save.seeds, "seeds");
    if (seeds.wheat !== "unlimited") {
      throw new Error('seeds.wheat must be "unlimited".');
    }
    const tomatoSeeds = requireInteger(seeds.tomato, "seeds.tomato");
    const cucumberSeeds = requireInteger(seeds.cucumber, "seeds.cucumber");
    const harvest2 = requireInventory(save.harvest, "harvest");
    if (!Array.isArray(save.plants) || save.plants.length > fieldSize * fieldSize) throw new Error("plants must be a valid array.");
    if (typeof save.editorCode !== "string") {
      throw new Error("editorCode must be a string.");
    }
    const farm2 = createFarm(fieldSize);
    farm2.balance = balanceCents / 100;
    farm2.position = { x, y };
    farm2.direction = save.direction;
    farm2.seeds = {
      wheat: Infinity,
      tomato: tomatoSeeds,
      cucumber: cucumberSeeds
    };
    farm2.harvest = harvest2;
    const occupied = /* @__PURE__ */ new Set();
    for (let index = 0; index < save.plants.length; index++) {
      const entry = requireRecord(save.plants[index], `plants[${index}]`);
      const plantX = requireInteger(
        entry.x,
        `plants[${index}].x`,
        fieldSize - 1
      );
      const plantY = requireInteger(
        entry.y,
        `plants[${index}].y`,
        fieldSize - 1
      );
      if (!plantNames.includes(entry.type)) {
        throw new Error(`plants[${index}].type is invalid.`);
      }
      const key = `${plantX},${plantY}`;
      if (occupied.has(key)) {
        throw new Error(`More than one plant occupies tile (${key}).`);
      }
      occupied.add(key);
      farm2.tiles[plantY][plantX].plant = new plantTypes[entry.type](
        now
      );
    }
    return { farm: farm2, editorCode: save.editorCode };
  }

  // frontend/script/app.ts
  var field = document.querySelector("#field");
  var editor = document.querySelector("#code-editor");
  enableIndentation(editor);
  var compileButton = document.querySelector("#compile-button");
  var stopButton = document.querySelector("#stop-button");
  var output = document.querySelector("#output");
  var status = document.querySelector("#execution-status");
  var positionLabel = document.querySelector("#position");
  var fieldSizeLabel = document.querySelector("#field-size");
  var tileCountLabel = document.querySelector("#tile-count");
  var shopFieldSize = document.querySelector("#shop-field-size");
  var upgradeButton = document.querySelector("#upgrade-field-button");
  var farm = createFarm();
  var language = "en";
  var languageSelector = document.querySelector("#language-selector");
  var saveButton = document.querySelector("#save-button");
  var loadButton = document.querySelector("#load-button");
  var loadInput = document.querySelector("#load-input");
  var t = (text) => translate(text, language);
  var executionStatus = "READY";
  function setStatus(value) {
    executionStatus = value;
    status.textContent = t(value);
  }
  var balanceLabel = document.querySelector("#balance");
  var seedLabels = Object.fromEntries(plantNames.map((name) => [name, document.querySelector(`#seed-${name}`)]));
  var harvestLabels = Object.fromEntries(plantNames.map((name) => [name, document.querySelector(`#harvest-${name}`)]));
  var running = false;
  var controller;
  var outputLines = [];
  var tiles = [];
  function rebuildField() {
    tiles = Array.from({ length: MAX_FIELD_SIZE }, () => Array.from({ length: MAX_FIELD_SIZE }, () => {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.setAttribute("aria-hidden", "true");
      return tile;
    }));
    field.replaceChildren(...tiles.flat());
  }
  rebuildField();
  function render() {
    const now = performance.now();
    tiles.forEach((row, y) => row.forEach((tile, x) => {
      const locked = x >= farm.size || y >= farm.size;
      tile.classList.toggle("is-locked", locked);
      tile.classList.toggle("is-selected", x === farm.position.x && y === farm.position.y);
      for (const direction of ["up", "down", "left", "right"]) {
        tile.classList.toggle(`facing-${direction}`, x === farm.position.x && y === farm.position.y && farm.direction === direction);
      }
      const crop = locked ? null : farm.tiles[y][x].plant;
      const grown = crop?.isGrown(now) ?? false;
      tile.classList.toggle("has-plant", !!crop);
      tile.classList.toggle("is-grown", grown);
      tile.textContent = crop ? grown ? { wheat: "\u{1F33E}", tomato: "\u{1F345}", cucumber: "\u{1F952}" }[crop.name] : "\u{1F331}" : "";
      tile.title = locked ? t("Locked tile") : crop ? `${t(crop.name)}: ${t(grown ? "ready to harvest" : "growing")}` : t("Empty tile");
    }));
    balanceLabel.textContent = farm.balance.toLocaleString(language === "de" ? "de-DE" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
    plantNames.forEach((name) => {
      seedLabels[name].textContent = Number.isFinite(farm.seeds[name]) ? String(farm.seeds[name]) : "\u221E";
      harvestLabels[name].textContent = String(farm.harvest[name]);
    });
    const coordinates = `(${farm.position.x}, ${farm.position.y})`;
    positionLabel.textContent = `${t("Position")}: ${coordinates}`;
    fieldSizeLabel.textContent = `${farm.size} \xD7 ${farm.size}`;
    const tileCount = farm.size * farm.size;
    tileCountLabel.textContent = `${tileCount} ${t(tileCount === 1 ? "TILE" : "TILES")}`;
    shopFieldSize.textContent = `${farm.size} \xD7 ${farm.size}`;
    const expansionCost = getExpansionCost(farm);
    upgradeButton.disabled = running || expansionCost === void 0;
    upgradeButton.textContent = expansionCost === void 0 ? t("Maximum field size reached.") : `${t("Expand to")} ${farm.size + 1} \xD7 ${farm.size + 1} \u2014 ${expansionCost.toLocaleString(language === "de" ? "de-DE" : "en-US", { minimumFractionDigits: 2 })}`;
    const selected = farm.tiles[farm.position.y][farm.position.x].plant;
    field.setAttribute("aria-label", `${t("Farm field. Size:")} ${farm.size} \xD7 ${farm.size}. ${t("Selected tile:")} ${coordinates}. ${t("Facing")}: ${t(farm.direction)}. ${selected ? t(selected.name) + ", " + t(selected.isGrown(now) ? "ready to harvest" : "growing") + "." : t("Empty.")}`);
  }
  function writeLine(message) {
    outputLines.push(...message.split(/\r?\n/));
    if (outputLines.length > 200) outputLines.splice(0, outputLines.length - 200);
    output.textContent = outputLines.join("\n") + "\n";
    output.scrollTop = output.scrollHeight;
  }
  compileButton.addEventListener("click", async () => {
    if (running) return;
    const program = compileProgram(editor.value);
    output.textContent = "";
    outputLines.length = 0;
    output.classList.toggle("is-error", !program.ok);
    if (!program.ok) {
      setStatus("REJECTED");
      writeLine("Program rejected. No commands were executed.");
      for (const error of program.errors) {
        writeLine(`Line ${error.line}: ${error.source}`);
        if (error.message) writeLine(error.message);
      }
      writeLine("Use a listed command, or while/if with a boolean or numeric comparison and an indented body. move() takes no arguments; use direction(right) to turn. Quote strings passed to print().");
      return;
    }
    if (!program.instructions.length) {
      setStatus("READY");
      writeLine("Nothing to execute. Enter a movement command first.");
      return;
    }
    running = true;
    controller = new AbortController();
    compileButton.disabled = true;
    stopButton.disabled = false;
    saveButton.disabled = true;
    loadButton.disabled = true;
    upgradeButton.disabled = true;
    editor.readOnly = true;
    setStatus("RUNNING");
    writeLine(`Starting at (${farm.position.x}, ${farm.position.y}). Use Stop to end execution.`);
    try {
      const result = await runProgram(program.instructions, farm, ({ instruction, position, message, output: printed }) => {
        render();
        if (printed !== void 0) {
          writeLine(printed);
          return;
        }
        const argument = "argument" in instruction ? instruction.argument + (instruction.command === "sell" ? `, ${instruction.quantity}` : "") : "";
        writeLine(`Line ${instruction.line}: ${instruction.command}(${argument}) -> (${position.x}, ${position.y}) - ${message}`);
      }, void 0, controller.signal);
      setStatus(result === "stopped" ? "STOPPED" : "COMPLETE");
      writeLine(result === "stopped" ? "Execution stopped. Position preserved." : "Execution complete.");
    } catch {
      setStatus("ERROR");
      output.classList.add("is-error");
      writeLine("Execution stopped because of an unexpected error. Try compiling again.");
    } finally {
      running = false;
      compileButton.disabled = false;
      stopButton.disabled = true;
      saveButton.disabled = false;
      loadButton.disabled = false;
      editor.readOnly = false;
      controller = void 0;
      render();
    }
  });
  upgradeButton.addEventListener("click", () => {
    const result = expandField(farm);
    writeLine(result.message);
    render();
  });
  saveButton.addEventListener("click", () => {
    const blob = new Blob([serializeGame(farm, editor.value)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "robot-farmer-save.json";
    link.click();
    URL.revokeObjectURL(url);
    writeLine(t("Game saved."));
  });
  loadButton.addEventListener("click", () => loadInput.click());
  loadInput.addEventListener("change", async () => {
    const file = loadInput.files?.[0];
    loadInput.value = "";
    if (!file) return;
    try {
      const loaded = parseSaveFile(await file.text(), performance.now());
      farm = loaded.farm;
      editor.value = loaded.editorCode;
      output.classList.toggle("is-error", false);
      setStatus("READY");
      writeLine(t("Game loaded."));
      render();
    } catch (error) {
      output.classList.add("is-error");
      setStatus("ERROR");
      writeLine(`${t("Could not load save file:")} ${error instanceof Error ? error.message : t("Unknown error.")}`);
    }
  });
  stopButton.addEventListener("click", () => {
    controller?.abort();
    stopButton.disabled = true;
  });
  languageSelector.addEventListener("change", () => {
    language = languageSelector.value === "de" ? "de" : "en";
    translatePage(language);
    setStatus(executionStatus);
    if (!outputLines.length) output.textContent = t("Write your commands, then click Compile.");
    render();
  });
  render();
  setInterval(render, 100);
})();
