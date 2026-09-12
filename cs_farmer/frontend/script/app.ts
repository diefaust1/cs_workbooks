import { compileProgram, createFarm, runProgram } from "./program.ts";

import { enableIndentation } from "./editor.ts";
import {
  expandField,
  getExpansionCost,
  MAX_FIELD_SIZE,
  updateWithering,
} from "./farm.ts";
import { type Language, translate, translatePage } from "./i18n.ts";
import { plantNames } from "./plants.ts";
import { parseSaveFile, serializeGame } from "./save.ts";

const field = document.querySelector<HTMLDivElement>("#field")!;
const editor = document.querySelector<HTMLTextAreaElement>("#code-editor")!;
enableIndentation(editor);
const compileButton = document.querySelector<HTMLButtonElement>(
  "#compile-button",
)!;
const stopButton = document.querySelector<HTMLButtonElement>("#stop-button")!;
const output = document.querySelector<HTMLPreElement>("#output")!;
const status = document.querySelector<HTMLSpanElement>("#execution-status")!;
const positionLabel = document.querySelector<HTMLSpanElement>("#position")!;
const fieldSizeLabel = document.querySelector<HTMLElement>("#field-size")!;
const tileCountLabel = document.querySelector<HTMLElement>("#tile-count")!;
const shopFieldSize = document.querySelector<HTMLElement>("#shop-field-size")!;
const upgradeButton = document.querySelector<HTMLButtonElement>(
  "#upgrade-field-button",
)!;
let farm = createFarm();
let language: Language = "en";
const languageSelector = document.querySelector<HTMLSelectElement>(
  "#language-selector",
)!;
const saveButton = document.querySelector<HTMLButtonElement>("#save-button")!;
const loadButton = document.querySelector<HTMLButtonElement>("#load-button")!;
const loadInput = document.querySelector<HTMLInputElement>("#load-input")!;
const t = (text: string) => translate(text, language);
let executionStatus = "READY";
function setStatus(value: string): void {
  executionStatus = value;
  status.textContent = t(value);
}
const balanceLabel = document.querySelector<HTMLElement>("#balance")!;
const seedLabels = Object.fromEntries(
  plantNames.map((
    name,
  ) => [name, document.querySelector<HTMLElement>(`#seed-${name}`)!]),
);
const harvestLabels = Object.fromEntries(
  plantNames.map((
    name,
  ) => [name, document.querySelector<HTMLElement>(`#harvest-${name}`)!]),
);
let running = false;
let controller: AbortController | undefined;
const outputLines: string[] = [];

let tiles: HTMLDivElement[][] = [];
function rebuildField(): void {
  tiles = Array.from(
    { length: MAX_FIELD_SIZE },
    () =>
      Array.from({ length: MAX_FIELD_SIZE }, () => {
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.setAttribute("aria-hidden", "true");
        return tile;
      }),
  );
  field.replaceChildren(...tiles.flat());
}
rebuildField();

function render(): void {
  const now = performance.now();
  updateWithering(farm, now);
  tiles.forEach((row, y) =>
    row.forEach((tile, x) => {
      const locked = x >= farm.size || y >= farm.size;
      tile.classList.toggle("is-locked", locked);
      tile.classList.toggle(
        "is-selected",
        x === farm.position.x && y === farm.position.y,
      );
      for (const direction of ["up", "down", "left", "right"] as const) {
        tile.classList.toggle(
          `facing-${direction}`,
          x === farm.position.x && y === farm.position.y &&
            farm.direction === direction,
        );
      }
      const crop = locked ? null : farm.tiles[y][x].plant;
      const grown = crop?.isGrown(now) ?? false;
      const withered = grown && crop?.witherState === "withered";
      tile.classList.toggle("has-plant", !!crop);
      tile.classList.toggle("is-grown", grown && !withered);
      tile.classList.toggle("is-withered", withered);
      tile.textContent = crop
        ? (withered ? "🥀" : grown
          ? {
            wheat: "🌾",
            tomato: "🍅",
            cucumber: "🥒",
            watermelon: "🍉",
          }[crop.name]
          : "🌱")
        : "";
      tile.title = locked
        ? t("Locked tile")
        : crop
        ? `${t(crop.name)}: ${
          t(withered ? "withered" : grown ? "ready to harvest" : "growing")
        }`
        : t("Empty tile");
    })
  );
  balanceLabel.textContent = farm.balance.toLocaleString(
    language === "de" ? "de-DE" : "en-US",
    { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false },
  );
  plantNames.forEach((name) => {
    seedLabels[name].textContent = Number.isFinite(farm.seeds[name])
      ? String(farm.seeds[name])
      : "∞";
    harvestLabels[name].textContent = String(farm.harvest[name]);
  });
  const coordinates = `(${farm.position.x}, ${farm.position.y})`;
  positionLabel.textContent = `${t("Position")}: ${coordinates}`;
  fieldSizeLabel.textContent = `${farm.size} × ${farm.size}`;
  const tileCount = farm.size * farm.size;
  tileCountLabel.textContent = `${tileCount} ${
    t(tileCount === 1 ? "TILE" : "TILES")
  }`;
  shopFieldSize.textContent = `${farm.size} × ${farm.size}`;
  const expansionCost = getExpansionCost(farm);
  upgradeButton.disabled = running || expansionCost === undefined;
  upgradeButton.textContent = expansionCost === undefined
    ? t("Maximum field size reached.")
    : `${t("Expand to")} ${farm.size + 1} × ${farm.size + 1} — ${
      expansionCost.toLocaleString(language === "de" ? "de-DE" : "en-US", {
        minimumFractionDigits: 2,
      })
    }`;
  const selected = farm.tiles[farm.position.y][farm.position.x].plant;
  field.setAttribute(
    "aria-label",
    `${t("Farm field. Size:")} ${farm.size} × ${farm.size}. ${
      t("Selected tile:")
    } ${coordinates}. ${t("Facing")}: ${t(farm.direction)}. ${
      selected
        ? t(selected.name) + ", " + t(
          selected.isGrown(now)
            ? selected.witherState === "withered"
              ? "withered"
              : "ready to harvest"
            : "growing",
        ) + "."
        : t("Empty.")
    }`,
  );
}

function writeLine(message: string): void {
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
    writeLine(
      "Use a listed command, or while/if with a boolean or numeric comparison and an indented body. move() takes no arguments; use direction(right) to turn. Quote strings passed to print().",
    );
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
  writeLine(
    `Starting at (${farm.position.x}, ${farm.position.y}). Use Stop to end execution.`,
  );

  try {
    const result = await runProgram(
      program.instructions,
      farm,
      ({ instruction, position, message, output: printed }) => {
        render();
        if (printed !== undefined) {
          writeLine(printed);
          return;
        }
        const argument = "argument" in instruction
          ? instruction.argument +
            ((instruction.command === "buy" || instruction.command === "sell")
              ? `, ${instruction.quantity}`
              : "")
          : "";
        writeLine(
          `Line ${instruction.line}: ${instruction.command}(${argument}) -> (${position.x}, ${position.y}) - ${message}`,
        );
      },
      undefined,
      controller.signal,
    );
    setStatus(result === "stopped" ? "STOPPED" : "COMPLETE");
    writeLine(
      result === "stopped"
        ? "Execution stopped. Position preserved."
        : "Execution complete.",
    );
  } catch {
    setStatus("ERROR");
    output.classList.add("is-error");
    writeLine(
      "Execution stopped because of an unexpected error. Try compiling again.",
    );
  } finally {
    running = false;
    compileButton.disabled = false;
    stopButton.disabled = true;
    saveButton.disabled = false;
    loadButton.disabled = false;
    editor.readOnly = false;
    controller = undefined;
    render();
  }
});

upgradeButton.addEventListener("click", () => {
  const result = expandField(farm);
  writeLine(result.message);
  render();
});

saveButton.addEventListener("click", () => {
  const blob = new Blob([serializeGame(farm, editor.value)], {
    type: "application/json",
  });
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
    writeLine(
      `${t("Could not load save file:")} ${
        error instanceof Error ? error.message : t("Unknown error.")
      }`,
    );
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
  if (!outputLines.length) {
    output.textContent = t("Write your commands, then click Compile.");
  }
  render();
});
render();
// Growth is elapsed time, independent of whether a program is running.
setInterval(render, 100);
