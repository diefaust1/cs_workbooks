import { compileProgram, createFarm, runProgram } from "./program.ts";

import { enableIndentation } from "./editor.ts";
import { plantNames } from "./plants.ts";

const field = document.querySelector<HTMLDivElement>("#field")!;
const editor = document.querySelector<HTMLTextAreaElement>("#code-editor")!;
enableIndentation(editor);
const compileButton = document.querySelector<HTMLButtonElement>("#compile-button")!;
const stopButton = document.querySelector<HTMLButtonElement>("#stop-button")!;
const output = document.querySelector<HTMLPreElement>("#output")!;
const status = document.querySelector<HTMLSpanElement>("#execution-status")!;
const positionLabel = document.querySelector<HTMLSpanElement>("#position")!;
const farm = createFarm();
const balanceLabel = document.querySelector<HTMLElement>("#balance")!;
const seedLabels = Object.fromEntries(plantNames.map((name) => [name, document.querySelector<HTMLElement>(`#seed-${name}`)!]));
const harvestLabels = Object.fromEntries(plantNames.map((name) => [name, document.querySelector<HTMLElement>(`#harvest-${name}`)!]));
let running = false;
let controller: AbortController | undefined;
const outputLines: string[] = [];

const tiles = farm.tiles.map((row) => row.map(() => {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.setAttribute("aria-hidden", "true");
  return tile;
}));
field.replaceChildren(...tiles.flat());

function render(): void {
  const now = performance.now();
  tiles.forEach((row, y) => row.forEach((tile, x) => {
    tile.classList.toggle("is-selected", x === farm.position.x && y === farm.position.y);
    const crop = farm.tiles[y][x].plant;
    const grown = crop?.isGrown(now) ?? false;
    tile.classList.toggle("has-plant", !!crop);
    tile.classList.toggle("is-grown", grown);
    tile.textContent = crop ? (grown ? { wheat: "🌾", tomato: "🍅", cucumber: "🥒" }[crop.name] : "🌱") : "";
    tile.title = crop ? `${crop.name}: ${grown ? "ready to harvest" : "growing"}` : "Empty tile";
  }));
  balanceLabel.textContent = farm.balance.toFixed(2);
  plantNames.forEach((name) => {
    seedLabels[name].textContent = Number.isFinite(farm.seeds[name]) ? String(farm.seeds[name]) : "∞";
    harvestLabels[name].textContent = String(farm.harvest[name]);
  });
  const coordinates = `(${farm.position.x}, ${farm.position.y})`;
  positionLabel.textContent = `Position: ${coordinates}`;
  const selected = farm.tiles[farm.position.y][farm.position.x].plant;
  field.setAttribute("aria-label", `Five by five farm field. Selected tile: ${coordinates}. ${selected ? selected.name + (selected.isGrown(now) ? ", ready to harvest." : ", growing.") : "Empty."}`);
}

function writeLine(message: string): void {
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
    }, undefined, controller.signal);
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
    controller = undefined;
  }
});

stopButton.addEventListener("click", () => {
  controller?.abort();
  stopButton.disabled = true;
});

render();
// Growth is elapsed time, independent of whether a program is running.
setInterval(render, 100);
