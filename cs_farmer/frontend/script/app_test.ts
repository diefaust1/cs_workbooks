import { strictEqual, match } from "node:assert";
import { runInNewContext } from "node:vm";

// Exercise the actual Vite production bundle's Compile listener with a minimal DOM.
// This catches accidental farm recreation in the UI, not just runner regressions.
Deno.test("Compile preserves position between clicks and resets only on reset()", async () => {
  class Element {
    textContent = "";
    value = "";
    disabled = false;
    readOnly = false;
    scrollTop = 0;
    scrollHeight = 0;
    style = { gridTemplateColumns: "" };
    files?: Array<{ text: () => Promise<string> }>;
    className = "";
    classes = new Set<string>();
    children: Element[] = [];
    listener?: () => Promise<void>;
    keyListener?: (event: KeyboardEvent) => void;
    selectionStart = 0;
    selectionEnd = 0;
    setRangeText(text: string, start: number, end: number, mode: string) {
      this.value = this.value.slice(0, start) + text + this.value.slice(end);
      if (mode === "end") this.selectionStart = this.selectionEnd = start + text.length;
    }
    setSelectionRange(start: number, end: number) {
      this.selectionStart = start;
      this.selectionEnd = end;
    }
    classList = {
      toggle: (name: string, enabled: boolean) => {
        if (enabled) this.classes.add(name);
        else this.classes.delete(name);
      },
      add: (name: string) => this.classes.add(name),
    };
    attributes = new Map<string, string>();
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    getAttribute(name: string) { return this.attributes.get(name) ?? null; }
    replaceChildren(...children: Element[]) { this.children = children; }
    addEventListener(event: string, listener: (() => Promise<void>) | ((event: KeyboardEvent) => void)) {
      if (event === "keydown") this.keyListener = listener as (event: KeyboardEvent) => void;
      else this.listener = listener as () => Promise<void>;
    }
  }
  const elements = new Map<string, Element>();
  const element = (selector: string) => {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector)!;
  };
  element("#balance-title").setAttribute("data-i18n", "Balance");
  element("#code-editor").setAttribute("data-i18n-placeholder", "Insert code here...");
  element("#language-selector").setAttribute("data-i18n-aria-label", "Language");
  const documentElement = { lang: "en" };
  const assetsDirectory = new URL("../../dist/assets/", import.meta.url);
  const bundleEntry = [...Deno.readDirSync(assetsDirectory)]
    .find((entry) => entry.isFile && /^index-.*\.js$/.test(entry.name));
  if (!bundleEntry) throw new Error("Vite JavaScript bundle not found. Run the production build first.");
  const bundle = await Deno.readTextFile(new URL(bundleEntry.name, assetsDirectory));
  let ticks = 0;
  let stopAtTick = Infinity;
  let now = 0;
  runInNewContext(bundle, {
    AbortController,
    performance: { now: () => now },
    setInterval: () => 0,
    document: {
      documentElement,
      querySelector: element,
      createElement: () => new Element(),
      querySelectorAll: (selector: string) => [...elements.values()].filter((item) => item.attributes.has(selector.slice(1, -1))),
    },
    setTimeout: (callback: () => void, ms: number) => {
      queueMicrotask(() => {
        now += ms;
        if (++ticks === stopAtTick) element("#stop-button").listener!();
        callback();
      });
    },
  });
  element("#load-input").files = [{ text: () => Promise.resolve(JSON.stringify({
    format: "cs_farmer_save", version: 2, fieldSize: 5, balanceCents: 0,
    position: { x: 0, y: 0 }, direction: "right",
    seeds: { wheat: "unlimited", tomato: 0, cucumber: 0 },
    harvest: { wheat: 0, tomato: 0, cucumber: 0 }, plants: [], editorCode: "",
  })) }];
  await element("#load-input").listener!();
  const compile = async (source: string) => {
    element("#code-editor").value = source;
    await element("#compile-button").listener!();
    strictEqual(element("#compile-button").disabled, false);
    strictEqual(element("#code-editor").readOnly, false);
    strictEqual(element("#field").children.filter((tile) => tile.classes.has("is-selected")).length, 1);
  };
  strictEqual(element("#position").textContent, "Position: (0, 0)");
  strictEqual(element("#balance").textContent, "0.00");
  strictEqual(element("#seed-wheat").textContent, "∞");
  strictEqual(element("#seed-tomato").textContent, "0");
  await compile("plant(tomato)");
  match(element("#output").textContent, /No tomato seeds/);
  await compile("plant(wheat)\nget_direction()\nharvest()");
  strictEqual(element("#harvest-wheat").textContent, "1");
  strictEqual(element("#seed-wheat").textContent, "∞");
  strictEqual(element("#balance").textContent, "0.00");
  await compile("move()");
  strictEqual(element("#position").textContent, "Position: (1, 0)");
  await compile("move()");
  strictEqual(element("#position").textContent, "Position: (2, 0)");
  match(element("#output").textContent, /Starting at \(1, 0\)/);
  await compile("reset()\nwrong()");
  strictEqual(element("#position").textContent, "Position: (2, 0)");
  match(element("#output").textContent, /Line 2: wrong\(\)/);
  await compile("reset()\ndirection(down)\nmove()");
  strictEqual(element("#position").textContent, "Position: (0, 1)");
  await compile("direction(right)");
  stopAtTick = ticks + 3;
  await compile("while(True):\n    move()\n    direction(down)\n    move()");
  strictEqual(element("#position").textContent, "Position: (1, 1)");
  strictEqual(element("#execution-status").textContent, "STOPPED");
  strictEqual(element("#stop-button").disabled, true);
  await compile("move()");
  strictEqual(element("#position").textContent, "Position: (2, 1)");
  await compile(Array(220).fill("reset()").join("\n"));
  strictEqual(element("#output").textContent.trim().split("\n").length, 200);

  await compile("while(True):");
  match(element("#output").textContent, /Expected a loop body indented by four spaces/);
  const editor = element("#code-editor");
  const key = (name: string, shiftKey = false) => {
    let prevented = false;
    editor.keyListener!({ key: name, shiftKey, preventDefault: () => { prevented = true; } } as KeyboardEvent);
    return prevented;
  };
  editor.value = "while(True):\n";
  editor.selectionStart = editor.selectionEnd = editor.value.length;
  strictEqual(key("Tab"), true);
  editor.value += "move()";
  strictEqual(editor.value, "while(True):\n    move()");
  stopAtTick = ticks + 3;
  await compile(editor.value);
  strictEqual(element("#execution-status").textContent, "STOPPED");
  strictEqual(element("#position").textContent, "Position: (1, 0)");
  editor.selectionStart = editor.selectionEnd = editor.value.length;
  strictEqual(key("Tab", true), true);
  strictEqual(editor.value, "while(True):\nmove()");
  editor.value = "move()\ndirection(down)\nmove()\ndirection(left)\nmove()";
  editor.selectionStart = 0;
  editor.selectionEnd = "move()\ndirection(down)\nmove()\n".length;
  strictEqual(key("Tab"), true);
  strictEqual(editor.value, "    move()\n    direction(down)\n    move()\ndirection(left)\nmove()");
  strictEqual(key("Tab", true), true);
  strictEqual(editor.value, "move()\ndirection(down)\nmove()\ndirection(left)\nmove()");
  key("Escape");
  strictEqual(key("Tab"), false);
  editor.readOnly = true;
  strictEqual(key("Tab"), false);
  editor.readOnly = false;
  await compile('reset_field()\nplant(wheat)\nmove()\nplant(wheat)');
  strictEqual(element("#field").children.filter((tile) => tile.classes.has("has-plant")).length, 2);
  const heldWheat = element("#harvest-wheat").textContent;
  await compile('if(True):\n    print("<b>hello</b>")\n    print(get_position())\nif(False):\n    print("skipped")\nreset_field()\nprint(get_position())');
  match(element("#output").textContent, /<b>hello<\/b>/);
  match(element("#output").textContent, /\(1, 0\)/);
  match(element("#output").textContent, /\(0, 0\)/);
  strictEqual(element("#output").textContent.includes("skipped"), false);
  strictEqual(element("#field").children.some((tile) => tile.classes.has("has-plant")), false);
  strictEqual(element("#position").textContent, "Position: (0, 0)");
  strictEqual(element("#harvest-wheat").textContent, heldWheat);

  await compile('reset()\nwhile(get_x_cord() < 3):\n    move()\nif(get_x_cord() >= 3):\n    print("arrived")');
  strictEqual(element("#position").textContent, "Position: (3, 0)");
  match(element("#output").textContent, /arrived/);
  await compile('reset_field()\nmove(right)');
  strictEqual(element("#execution-status").textContent, "REJECTED");
  strictEqual(element("#position").textContent, "Position: (3, 0)");

  await compile('reset()\nwhile(get_x_cord() < 2 and get_y_cord() == 0):\n    if(get_x_cord() == 0 | False):\n        print("first")\n    else:\n        print("second")\n    move()');
  match(element("#output").textContent, /first/);
  match(element("#output").textContent, /second/);
  strictEqual(element("#position").textContent, "Position: (2, 0)");

  const harvestBeforeSale = Number(element("#harvest-wheat").textContent);
  await compile('reset_field()\nplant(wheat)\nget_direction()\nif(is_harvestable()):\n    harvest()\nsell(wheat, 1)\nprint(is_harvestable())');
  strictEqual(element("#balance").textContent, "0.50");
  strictEqual(Number(element("#harvest-wheat").textContent), harvestBeforeSale);
  match(element("#output").textContent, /Sold 1 wheat for 0.50/);
  match(element("#output").textContent, /False/);
  await compile('sell(tomato, 1)');
  strictEqual(element("#balance").textContent, "0.50");
  match(element("#output").textContent, /Not enough harvested tomato/);

  const lastCode = editor.value;
  const lastPosition = element("#position").textContent;
  const lastHarvest = element("#harvest-wheat").textContent;
  const lastOutput = element("#output").textContent;
  element("#language-selector").value = "de";
  await element("#language-selector").listener!();
  strictEqual(documentElement.lang, "de");
  strictEqual(element("#balance-title").textContent, "Guthaben");
  strictEqual(editor.getAttribute("placeholder"), "Code hier eingeben...");
  strictEqual(element("#language-selector").getAttribute("aria-label"), "Sprache");
  strictEqual(element("#balance").textContent, "0,50");
  strictEqual(editor.value, lastCode);
  strictEqual(element("#position").textContent, lastPosition);
  strictEqual(element("#harvest-wheat").textContent, lastHarvest);
  strictEqual(element("#output").textContent, lastOutput);
  await compile('print("Keep my English text")');
  match(element("#output").textContent, /Keep my English text/);
  strictEqual(element("#execution-status").textContent, "ABGESCHLOSSEN");
  element("#language-selector").value = "en";
  await element("#language-selector").listener!();
  strictEqual(documentElement.lang, "en");
  strictEqual(element("#balance-title").textContent, "Balance");
  strictEqual(editor.getAttribute("placeholder"), "Insert code here...");
  strictEqual(element("#balance").textContent, "0.50");

  await compile('reset()\ndirection(left)');
  let selected = element("#field").children.find(tile => tile.classes.has("is-selected"))!;
  strictEqual(selected.classes.has("facing-left"), true);
  strictEqual(selected.classes.has("facing-right"), false);
  strictEqual(element("#position").textContent, "Position: (0, 0)");
  await compile('direction(down)\nmove()');
  selected = element("#field").children.find(tile => tile.classes.has("is-selected"))!;
  strictEqual(selected.classes.has("facing-down"), true);
  strictEqual(element("#position").textContent, "Position: (0, 1)");

  for (const reset of ['reset()', 'reset_field()']) {
    await compile(`direction(left)\n${reset}`);
    const active = element("#field").children.find(tile => tile.classes.has("is-selected"))!;
    strictEqual(active.classes.has("facing-right"), true);
    strictEqual(active.classes.has("facing-left"), false);
    strictEqual(element("#position").textContent, "Position: (0, 0)");
  }

  element("#load-input").files = [{ text: () => Promise.resolve(JSON.stringify({
    format: "cs_farmer_save", version: 2, fieldSize: 1, balanceCents: 400,
    position: { x: 0, y: 0 }, direction: "right",
    seeds: { wheat: "unlimited", tomato: 0, cucumber: 0 },
    harvest: { wheat: 0, tomato: 0, cucumber: 0 }, plants: [], editorCode: "print(get_direction())",
  })) }];
  await element("#load-input").listener!();
  strictEqual(element("#field").children.length, 36);
  strictEqual(element("#field").children.filter((tile) => tile.classes.has("is-locked")).length, 35);
  strictEqual(element("#field-size").textContent, "1 × 1");
  await element("#upgrade-field-button").listener!();
  strictEqual(element("#field").children.length, 36);
  strictEqual(element("#field").children.filter((tile) => tile.classes.has("is-locked")).length, 32);
  strictEqual(element("#field-size").textContent, "2 × 2");
  strictEqual(element("#shop-field-size").textContent, "2 × 2");
  strictEqual(element("#balance").textContent, "0.00");

});

