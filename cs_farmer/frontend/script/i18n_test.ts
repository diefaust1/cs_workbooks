import { strictEqual } from "node:assert";
import { translate } from "./i18n.ts";

Deno.test("German translations preserve umlauts and sharp s", () => {
  strictEqual(translate("Compile", "de"), "Ausf\u00fchren");
  strictEqual(translate("RUNNING", "de"), "L\u00c4UFT");
  strictEqual(translate("growing", "de"), "w\u00e4chst");
  strictEqual(
    translate("Add new editor", "de"),
    "Neuen Editor hinzuf\u00fcgen",
  );
  strictEqual(translate("Delete", "de"), "L\u00f6schen");
  strictEqual(
    translate("Skip the indented block.", "de"),
    "\u00dcberspringt den einger\u00fcckten Block.",
  );
  const help = translate(
    "One statement per line. Tab inserts four spaces; Shift+Tab removes indentation. Press Escape then Tab to leave the editor. Commands and loop/if checks each pause for 500 ms.",
    "de",
  );
  strictEqual(help.includes("anschlie\u00dfend"), true);
  strictEqual(help.includes("?"), false);
  strictEqual(translate("Compile", "en"), "Compile");
});
