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
import { parseSaveFile, type SavedProgram, serializeGame } from "./save.ts";

const field = document.querySelector<HTMLDivElement>("#field")!;
const programList = document.querySelector<HTMLDivElement>("#program-list")!;
const addProgramButton = document.querySelector<HTMLButtonElement>(
  "#add-program-button",
)!;
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
type ProgramEditor = {
  id: string;
  root: HTMLDetailsElement;
  numberLabel: HTMLElement;
  nameInput: HTMLInputElement;
  editor: HTMLTextAreaElement;
  compileButton: HTMLButtonElement;
  stopButton: HTMLButtonElement;
  deleteButton?: HTMLButtonElement;
};
const programs: ProgramEditor[] = [];
let nextProgramId = 2;
let nextProgramName = 2;
let runningProgramId: string | undefined;
let controller: AbortController | undefined;
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
const outputLines: string[] = [];

function connectProgram(program: ProgramEditor): void {
  enableIndentation(program.editor);
  program.nameInput.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  program.compileButton.addEventListener(
    "click",
    () => executeProgram(program),
  );
  program.stopButton.addEventListener("click", () => {
    if (runningProgramId !== program.id) return;
    controller?.abort();
    program.stopButton.disabled = true;
  });
  program.deleteButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (runningProgramId || !confirm(t("Delete this program?"))) return;
    const index = programs.indexOf(program);
    if (index <= 0) return;
    programs.splice(index, 1);
    program.root.remove();
    updateProgramNumbers();
  });
}

function updateProgramNumbers(): void {
  programs.forEach((program, index) => {
    program.numberLabel.textContent = String(index + 1).padStart(2, "0");
  });
}

function createProgramElement(state: SavedProgram): ProgramEditor {
  const root = document.createElement("details");
  root.className = "panel editor-panel disclosure-panel";
  root.open = !state.collapsed;
  root.setAttribute("data-program-id", state.id);

  const heading = document.createElement("summary");
  heading.className = "panel-heading program-heading";
  const numberLabel = document.createElement("span");
  numberLabel.className = "section-number program-number";
  const nameInput = document.createElement("input");
  nameInput.className = "program-name";
  nameInput.value = state.name;
  nameInput.setAttribute("aria-label", t("Program name"));
  nameInput.setAttribute("data-i18n-aria-label", "Program name");
  const meta = document.createElement("span");
  meta.className = "panel-meta";
  meta.textContent = t("EDITOR");
  meta.setAttribute("data-i18n", "EDITOR");
  const deleteButton = document.createElement("button");
  deleteButton.className = "program-delete";
  deleteButton.type = "button";
  deleteButton.textContent = t("Delete");
  deleteButton.setAttribute("data-i18n", "Delete");
  heading.append(numberLabel, nameInput, meta, deleteButton);

  const editorBody = document.createElement("div");
  editorBody.className = "editor-body";
  const editorLabel = document.createElement("label");
  editorLabel.className = "sr-only";
  editorLabel.textContent = t("Write your farm code");
  editorLabel.setAttribute("data-i18n", "Write your farm code");
  const editor = document.createElement("textarea");
  editor.id = `code-${state.id}`;
  editorLabel.setAttribute("for", editor.id);
  editor.value = state.code;
  editor.spellcheck = false;
  editor.autocomplete = "off";
  editor.setAttribute("autocapitalize", "off");
  editor.setAttribute("aria-describedby", "compile-note");
  editor.setAttribute("placeholder", t("Insert code here..."));
  editor.setAttribute("data-i18n-placeholder", "Insert code here...");
  editorBody.append(editorLabel, editor);

  const footer = document.createElement("div");
  footer.className = "editor-footer";
  const compileButton = document.createElement("button");
  compileButton.className = "compile-button";
  compileButton.type = "button";
  compileButton.setAttribute("aria-describedby", "compile-note");
  const compileIcon = document.createElement("span");
  compileIcon.textContent = "▷";
  compileIcon.setAttribute("aria-hidden", "true");
  const compileLabel = document.createElement("span");
  compileLabel.textContent = t("Compile");
  compileLabel.setAttribute("data-i18n", "Compile");
  compileButton.append(compileIcon, compileLabel);
  const stopButton = document.createElement("button");
  stopButton.className = "compile-button stop-button";
  stopButton.type = "button";
  stopButton.disabled = true;
  stopButton.textContent = t("Stop");
  stopButton.setAttribute("data-i18n", "Stop");
  footer.append(compileButton, stopButton);
  root.append(heading, editorBody, footer);

  return {
    id: state.id,
    root,
    numberLabel,
    nameInput,
    editor,
    compileButton,
    stopButton,
    deleteButton,
  };
}

function addProgram(state?: SavedProgram): ProgramEditor {
  let id = state?.id;
  while (!id || programs.some((program) => program.id === id)) {
    id = `program-${nextProgramId++}`;
  }
  const program = createProgramElement(
    state ? { ...state, id } : {
      id,
      name: `Program ${nextProgramName++}`,
      code: "",
      collapsed: false,
    },
  );
  programs.push(program);
  connectProgram(program);
  programList.append(program.root);
  updateProgramNumbers();
  return program;
}

function savedPrograms(): SavedProgram[] {
  return programs.map((program) => ({
    id: program.id,
    name: program.nameInput.value,
    code: program.editor.value,
    collapsed: !program.root.open,
  }));
}

function replacePrograms(states: readonly SavedProgram[]): void {
  for (const program of programs.slice(1)) program.root.remove();
  programs.splice(1);
  const first = programs[0];
  const state = states[0];
  first.id = state.id;
  first.root.setAttribute("data-program-id", state.id);
  first.nameInput.value = state.name;
  first.editor.value = state.code;
  first.root.open = !state.collapsed;
  for (const additional of states.slice(1)) addProgram(additional);
  updateProgramNumbers();
}

function updateExecutionControls(): void {
  const running = runningProgramId !== undefined;
  for (const program of programs) {
    program.compileButton.disabled = running;
    program.stopButton.disabled = program.id !== runningProgramId;
    program.editor.readOnly = running;
    program.nameInput.disabled = running;
    if (program.deleteButton) program.deleteButton.disabled = running;
  }
  addProgramButton.disabled = running;
  saveButton.disabled = running;
  loadButton.disabled = running;
  upgradeButton.disabled = running || getExpansionCost(farm) === undefined;
}

const firstProgram: ProgramEditor = {
  id: "program-1",
  root: document.querySelector<HTMLDetailsElement>("#program-1")!,
  numberLabel: document.querySelector<HTMLElement>(".program-number")!,
  nameInput: document.querySelector<HTMLInputElement>("#program-name-1")!,
  editor: document.querySelector<HTMLTextAreaElement>("#code-editor")!,
  compileButton: document.querySelector<HTMLButtonElement>("#compile-button")!,
  stopButton: document.querySelector<HTMLButtonElement>("#stop-button")!,
};
programs.push(firstProgram);
connectProgram(firstProgram);

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
  upgradeButton.disabled = runningProgramId !== undefined ||
    expansionCost === undefined;
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

async function executeProgram(editorProgram: ProgramEditor): Promise<void> {
  if (runningProgramId) return;
  const program = compileProgram(editorProgram.editor.value);
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
      "Use a listed command, or while/for/if with a supported condition and an indented body. move() takes no arguments; use direction(right) to turn. Quote strings passed to print().",
    );
    return;
  }

  if (!program.instructions.length) {
    setStatus("READY");
    writeLine("Nothing to execute. Enter a movement command first.");
    return;
  }

  runningProgramId = editorProgram.id;
  const runController = new AbortController();
  controller = runController;
  updateExecutionControls();
  setStatus("RUNNING");
  const programName = editorProgram.nameInput.value.trim() ||
    "Untitled program";
  writeLine(
    `Starting "${programName}" at (${farm.position.x}, ${farm.position.y}). Use Stop to end execution.`,
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
              ? `, ${instruction.quantitySource}`
              : "")
          : "";
        writeLine(
          `Line ${instruction.line}: ${instruction.command}(${argument}) -> (${position.x}, ${position.y}) - ${message}`,
        );
      },
      undefined,
      runController.signal,
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
    runningProgramId = undefined;
    controller = undefined;
    updateExecutionControls();
    render();
  }
}

addProgramButton.addEventListener("click", () => {
  if (runningProgramId) return;
  addProgram();
});

upgradeButton.addEventListener("click", () => {
  const result = expandField(farm);
  writeLine(result.message);
  render();
});

saveButton.addEventListener("click", () => {
  const blob = new Blob([serializeGame(farm, savedPrograms())], {
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
    replacePrograms(loaded.programs);
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

languageSelector.addEventListener("change", () => {
  language = languageSelector.value === "de" ? "de" : "en";
  translatePage(language);
  setStatus(executionStatus);
  if (!outputLines.length) {
    output.textContent = t("Write your commands, then click Compile.");
  }
  render();
});
updateExecutionControls();
render();
// Growth is elapsed time, independent of whether a program is running.
setInterval(render, 100);
