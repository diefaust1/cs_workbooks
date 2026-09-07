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
    growthTime = 0.5;
    sellingPrice = 0.5;
  };
  var Tomato = class extends Plant {
    name = "tomato";
    seedPrice = 0.2;
    growthTime = 1;
    sellingPrice = 2;
  };
  var Cucumber = class extends Plant {
    name = "cucumber";
    seedPrice = 0.5;
    growthTime = 2;
    sellingPrice = 4;
  };
  var plantTypes = { wheat: Wheat, tomato: Tomato, cucumber: Cucumber };
  var plantNames = Object.keys(plantTypes);
  var plantInfo = Object.fromEntries(plantNames.map((name) => [name, new plantTypes[name](0)]));

  // frontend/script/farm.ts
  var FIELD_SIZE = 5;
  function createFarm() {
    return {
      tiles: Array.from({ length: FIELD_SIZE }, (_, y) => Array.from({ length: FIELD_SIZE }, (_2, x) => ({ x, y, plant: null }))),
      position: { x: 0, y: 0 },
      balance: 0,
      seeds: { wheat: Infinity, tomato: 0, cucumber: 0 },
      harvest: { wheat: 0, tomato: 0, cucumber: 0 }
    };
  }
  function move(farm2, direction = "right") {
    const offsets = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
    const offset = offsets[direction];
    const x = Math.max(0, Math.min(FIELD_SIZE - 1, farm2.position.x + offset.x));
    const y = Math.max(0, Math.min(FIELD_SIZE - 1, farm2.position.y + offset.y));
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
        else errors.push({ ...pending.owner, message: "Expected a loop body indented by four spaces." });
        pending = void 0;
      }
      if (depth >= blocks.length) {
        error("Unexpected indentation. Only a while block introduces an indented body.");
        return;
      }
      blocks.length = depth + 1;
      const body = blocks[depth].body;
      const movement = /^move\(\s*(up|down|left|right)?\s*\)$/.exec(line);
      const planting = /^plant\(\s*(wheat|tomato|cucumber)\s*\)$/.exec(line);
      const command = /^(harvest|reset)\(\s*\)$/.exec(line);
      const loop = /^while\s*\(\s*(True|False)\s*\)\s*:$/.exec(line);
      if (movement) {
        body.push({ command: "move", argument: movement[1] || "right", line: index + 1 });
      } else if (planting) {
        body.push({ command: "plant", argument: planting[1], line: index + 1 });
      } else if (command) {
        body.push({ command: command[1], line: index + 1 });
      } else if (loop) {
        const statement = { condition: loop[1] === "True", body: [], line: index + 1 };
        body.push(statement);
        pending = { body: statement.body, owner: { line: index + 1, source: sourceLine } };
      } else {
        errors.push({ line: index + 1, source: sourceLine });
      }
    });
    if (pending) errors.push({ ...pending.owner, message: "Expected a loop body indented by four spaces." });
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
          moved = move(farm2, statement.argument);
          result.message = moved ? "Moved." : "Edge reached; staying here.";
        } else if (statement.command === "reset") {
          farm2.position = { x: 0, y: 0 };
          result.message = "Position reset.";
        } else if (statement.command === "plant") result = plant(farm2, statement.argument, now());
        else result = harvest(farm2, now());
        onStep({ instruction: statement, position: { ...farm2.position }, moved, ...result });
      } else if (statement.condition) {
        stack.push({ body: statement.body, index: 0 });
      } else {
        frame.index++;
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

  // frontend/script/app.ts
  var field = document.querySelector("#field");
  var editor = document.querySelector("#code-editor");
  enableIndentation(editor);
  var compileButton = document.querySelector("#compile-button");
  var stopButton = document.querySelector("#stop-button");
  var output = document.querySelector("#output");
  var status = document.querySelector("#execution-status");
  var positionLabel = document.querySelector("#position");
  var farm = createFarm();
  var balanceLabel = document.querySelector("#balance");
  var seedLabels = Object.fromEntries(plantNames.map((name) => [name, document.querySelector(`#seed-${name}`)]));
  var harvestLabels = Object.fromEntries(plantNames.map((name) => [name, document.querySelector(`#harvest-${name}`)]));
  var running = false;
  var controller;
  var outputLines = [];
  var tiles = farm.tiles.map((row) => row.map(() => {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.setAttribute("aria-hidden", "true");
    return tile;
  }));
  field.replaceChildren(...tiles.flat());
  function render() {
    const now = performance.now();
    tiles.forEach((row, y) => row.forEach((tile, x) => {
      tile.classList.toggle("is-selected", x === farm.position.x && y === farm.position.y);
      const crop = farm.tiles[y][x].plant;
      const grown = crop?.isGrown(now) ?? false;
      tile.classList.toggle("has-plant", !!crop);
      tile.classList.toggle("is-grown", grown);
      tile.textContent = crop ? grown ? { wheat: "\u{1F33E}", tomato: "\u{1F345}", cucumber: "\u{1F952}" }[crop.name] : "\u{1F331}" : "";
      tile.title = crop ? `${crop.name}: ${grown ? "ready to harvest" : "growing"}` : "Empty tile";
    }));
    balanceLabel.textContent = farm.balance.toFixed(2);
    plantNames.forEach((name) => {
      seedLabels[name].textContent = Number.isFinite(farm.seeds[name]) ? String(farm.seeds[name]) : "\u221E";
      harvestLabels[name].textContent = String(farm.harvest[name]);
    });
    const coordinates = `(${farm.position.x}, ${farm.position.y})`;
    positionLabel.textContent = `Position: ${coordinates}`;
    const selected = farm.tiles[farm.position.y][farm.position.x].plant;
    field.setAttribute("aria-label", `Five by five farm field. Selected tile: ${coordinates}. ${selected ? selected.name + (selected.isGrown(now) ? ", ready to harvest." : ", growing.") : "Empty."}`);
  }
  function writeLine(message) {
    outputLines.push(message);
    if (outputLines.length > 200) outputLines.shift();
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
      status.textContent = "REJECTED";
      writeLine("Program rejected. No commands were executed.");
      for (const error of program.errors) {
        writeLine(`Line ${error.line}: ${error.source}`);
        if (error.message) writeLine(error.message);
      }
      writeLine("Use a listed command or while(True): / while(False): with an indented body.");
      return;
    }
    if (!program.instructions.length) {
      status.textContent = "READY";
      writeLine("Nothing to execute. Enter a movement command first.");
      return;
    }
    running = true;
    controller = new AbortController();
    compileButton.disabled = true;
    stopButton.disabled = false;
    editor.readOnly = true;
    status.textContent = "RUNNING";
    writeLine(`Starting at (${farm.position.x}, ${farm.position.y}). Use Stop to end execution.`);
    try {
      const result = await runProgram(program.instructions, farm, ({ instruction, position, message }) => {
        render();
        const argument = "argument" in instruction ? instruction.argument : "";
        writeLine(`Line ${instruction.line}: ${instruction.command}(${argument}) -> (${position.x}, ${position.y}) - ${message}`);
      }, void 0, controller.signal);
      status.textContent = result === "stopped" ? "STOPPED" : "COMPLETE";
      writeLine(result === "stopped" ? "Execution stopped. Position preserved." : "Execution complete.");
    } catch {
      status.textContent = "ERROR";
      output.classList.add("is-error");
      writeLine("Execution stopped because of an unexpected error. Try compiling again.");
    } finally {
      running = false;
      compileButton.disabled = false;
      stopButton.disabled = true;
      editor.readOnly = false;
      controller = void 0;
    }
  });
  stopButton.addEventListener("click", () => {
    controller?.abort();
    stopButton.disabled = true;
  });
  render();
  setInterval(render, 100);
})();
