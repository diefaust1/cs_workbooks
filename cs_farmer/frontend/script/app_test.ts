import { strictEqual, match } from "node:assert";
import { runInNewContext } from "node:vm";

// Exercise the actual browser bundle's Compile listener with a minimal DOM.
// This catches accidental farm recreation in the UI, not just runner regressions.
Deno.test("Compile preserves position between clicks and resets only on reset()", async () => {
  class Element {
    textContent = "";
    value = "";
    disabled = false;
    readOnly = false;
    scrollTop = 0;
    scrollHeight = 0;
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
    setAttribute() {}
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
  const bundle = await Deno.readTextFile(new URL("./app.js", import.meta.url));
  let ticks = 0;
  let stopAtTick = Infinity;
  let now = 0;
  runInNewContext(bundle, {
    AbortController,
    performance: { now: () => now },
    setInterval: () => 0,
    document: { querySelector: element, createElement: () => new Element() },
    setTimeout: (callback: () => void, ms: number) => {
      queueMicrotask(() => {
        now += ms;
        if (++ticks === stopAtTick) element("#stop-button").listener!();
        callback();
      });
    },
  });
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
  await compile("plant(wheat)\nharvest()");
  strictEqual(element("#harvest-wheat").textContent, "1");
  strictEqual(element("#seed-wheat").textContent, "∞");
  strictEqual(element("#balance").textContent, "0.00");
  await compile("move(right)");
  strictEqual(element("#position").textContent, "Position: (1, 0)");
  await compile("move(right)");
  strictEqual(element("#position").textContent, "Position: (2, 0)");
  match(element("#output").textContent, /Starting at \(1, 0\)/);
  await compile("reset()\nwrong()");
  strictEqual(element("#position").textContent, "Position: (2, 0)");
  match(element("#output").textContent, /Line 2: wrong\(\)/);
  await compile("reset()\nmove(down)");
  strictEqual(element("#position").textContent, "Position: (0, 1)");
  stopAtTick = ticks + 3;
  await compile("while(True):\n    move(right)\n    move(down)");
  strictEqual(element("#position").textContent, "Position: (1, 1)");
  strictEqual(element("#execution-status").textContent, "STOPPED");
  strictEqual(element("#stop-button").disabled, true);
  await compile("move(right)");
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
  editor.value += "move(right)";
  strictEqual(editor.value, "while(True):\n    move(right)");
  stopAtTick = ticks + 3;
  await compile(editor.value);
  strictEqual(element("#execution-status").textContent, "STOPPED");
  strictEqual(element("#position").textContent, "Position: (1, 0)");
  editor.selectionStart = editor.selectionEnd = editor.value.length;
  strictEqual(key("Tab", true), true);
  strictEqual(editor.value, "while(True):\nmove(right)");
  editor.value = "move(right)\nmove(down)\nmove(left)";
  editor.selectionStart = 0;
  editor.selectionEnd = "move(right)\nmove(down)\n".length;
  strictEqual(key("Tab"), true);
  strictEqual(editor.value, "    move(right)\n    move(down)\nmove(left)");
  strictEqual(key("Tab", true), true);
  strictEqual(editor.value, "move(right)\nmove(down)\nmove(left)");
  key("Escape");
  strictEqual(key("Tab"), false);
  editor.readOnly = true;
  strictEqual(key("Tab"), false);
});

