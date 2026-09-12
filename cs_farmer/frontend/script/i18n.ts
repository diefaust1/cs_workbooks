export type Language = "en" | "de";
const german: Record<string, string> = {
  "A little code. A little cultivation.":
    "Ein wenig Code. Ein wenig Landwirtschaft.",
  "Balance": "Guthaben",
  "Save": "Speichern",
  "Load": "Laden",
  "Save game controls": "Steuerelemente zum Speichern des Spiels",
  "Game saved.": "Spiel gespeichert.",
  "Game loaded.": "Spiel geladen.",
  "Could not load save file:": "Spielstand konnte nicht geladen werden:",
  "Unknown error.": "Unbekannter Fehler.",
  "Shop": "Shop",
  "Plants": "Pflanzen",
  "Plant": "Pflanze",
  "Seed price": "Saatpreis",
  "Growth time": "Wachstumszeit",
  "Wither chance": "Verwelkchance",
  "Selling price": "Verkaufspreis",
  "Current field": "Aktuelles Feld",
  "Expand to": "Erweitern auf",
  "Maximum field size reached.": "Maximale Feldgröße erreicht.",
  "Your code": "Dein Code",
  "EDITOR": "EDITOR",
  "Write your farm code": "Schreibe deinen Farm-Code",
  "Insert code here...": "Code hier eingeben...",
  "Compile": "Ausführen",
  "Stop": "Stopp",
  "Output": "Ausgabe",
  "Program output": "Programmausgabe",
  "READY": "BEREIT",
  "RUNNING": "LÄUFT",
  "REJECTED": "ABGELEHNT",
  "COMPLETE": "ABGESCHLOSSEN",
  "STOPPED": "GESTOPPT",
  "ERROR": "FEHLER",
  "Write your commands, then click Compile.":
    "Schreibe deine Befehle und klicke auf Ausführen.",
  "Your field": "Dein Feld",
  "TILE": "FELD",
  "TILES": "FELDER",
  "Seeds": "Saatgut",
  "Harvest inventory": "Erntevorrat",
  "Wheat": "Weizen",
  "Tomato": "Tomate",
  "Cucumber": "Gurke",
  "Watermelon": "Wassermelone",
  "Unlimited wheat seeds": "Unbegrenztes Weizensaatgut",
  "Commands": "Befehle",
  "Example loop": "Beispielschleife",
  "Return True if the selected tile has a fully grown plant; otherwise False.":
    "Gibt True zurück, wenn die Pflanze auf dem ausgewählten Feld ausgewachsen ist, sonst False.",
  "Buy a whole number of wheat, tomato, cucumber, or watermelon seeds using your balance.":
    "Kaufe eine ganze Anzahl Samen für wheat, tomato, cucumber oder watermelon mit deinem Guthaben.",
  "Sell a whole number of harvested wheat, tomato, cucumber, or watermelon plants and add their value to your balance.":
    "Verkaufe eine ganze Anzahl geernteter Pflanzen (wheat, tomato, cucumber oder watermelon). Der Erlös wird deinem Guthaben gutgeschrieben.",
  "Plant wheat, tomato, cucumber, or watermelon on an empty tile, using one seed. Wheat seeds are unlimited.":
    "Pflanze wheat (Weizen), tomato (Tomate), cucumber (Gurke) oder watermelon (Wassermelone) auf einem leeren Feld. Das verbraucht einen Samen; Weizensaatgut ist unbegrenzt.",
  "Collect a grown healthy plant. Immature and withered plants are removed without a reward. Healthy watermelon squares gain a yield multiplier.":
    "Ernte eine ausgewachsene gesunde Pflanze. Unreife und verwelkte Pflanzen werden ohne Ertrag entfernt. Gesunde Wassermelonenquadrate erhalten einen Ertragsmultiplikator.",
  "Return the current (x, y) coordinates.":
    "Gibt die aktuellen Koordinaten (x, y) zurück.",
  "Return the current x coordinate.": "Gibt die aktuelle x-Koordinate zurück.",
  "Return the current y coordinate.": "Gibt die aktuelle y-Koordinate zurück.",
  "Return the current direction.": "Gibt die aktuelle Blickrichtung zurück.",
  "Return the harvested inventory count for wheat, tomato, cucumber, or watermelon.":
    "Gibt die Anzahl geernteter Pflanzen für wheat, tomato, cucumber oder watermelon zurück.",
  "Print a quoted string or value, such as print(get_position()). Single quotes work too.":
    "Gibt einen Text in Anführungszeichen oder einen Wert aus, etwa print(get_position()). Einfache Anführungszeichen funktionieren auch.",
  "Run the indented block once. if(False): skips it. Numeric comparisons are supported, such as get_x_cord() == 2.":
    "Führt den eingerückten Block einmal aus. if(False): überspringt ihn. Zahlenvergleiche wie get_x_cord() == 2 sind möglich.",
  "Repeat while the condition is true. For example: while(get_x_cord() < 4):":
    "Wiederholt den Block, solange die Bedingung wahr ist. Beispiel: while(get_x_cord() < 4):",
  "Skip the indented block.": "Überspringt den eingerückten Block.",
  "Run this indented block when the matching if is false. Align else with its if.":
    "Führt diesen eingerückten Block aus, wenn die zugehörige if-Bedingung falsch ist. else und if müssen gleich eingerückt sein.",
  "Both conditions must be true. Evaluated before or.":
    "Beide Bedingungen müssen wahr sein. Wird vor or ausgewertet.",
  "At least one condition must be true. Use parentheses to group conditions.":
    "Mindestens eine Bedingung muss wahr sein. Mit Klammern kannst du Bedingungen gruppieren.",
  "One statement per line. Tab inserts four spaces; Shift+Tab removes indentation. Press Escape then Tab to leave the editor. Commands and while/if checks each pause for 500 ms.":
    "Eine Anweisung pro Zeile. Tab fügt vier Leerzeichen ein; Umschalt+Tab entfernt die Einrückung. Mit Escape und anschließend Tab verlässt du den Editor. Befehle und while/if-Prüfungen pausieren jeweils 500 ms.",
  "Blank lines and full-line # comments are allowed. Runs continue from the last position. Edge moves stay on the field.":
    "Leerzeilen und ganze Kommentarzeilen mit # sind erlaubt. Programme starten an der letzten Position. Am Rand bleibt die Auswahl auf dem Feld.",
  "Language": "Sprache",
  "Position": "Position",
  "Empty tile": "Leeres Feld",
  "Locked tile": "Gesperrtes Feld",
  "ready to harvest": "erntereif",
  "growing": "wächst",
  "withered": "verwelkt",
  "Empty.": "Leer.",
  "Farm field. Size:": "Farmfeld. Größe:",
  "Selected tile:": "Ausgewähltes Feld:",
  "wheat": "Weizen",
  "tomato": "Tomate",
  "cucumber": "Gurke",
  "watermelon": "Wassermelone",
  "Move one tile in the current direction. Starts facing right. The blue edge shows the facing side.":
    "Bewege dich ein Feld in Blickrichtung. Zu Beginn nach rechts. Die blaue Kante zeigt die Blickrichtung.",
  "Face up, down, left, or right without moving.":
    "Drehe dich nach up (oben), down (unten), left (links) oder right (rechts), ohne dich zu bewegen.",
  "Facing": "Blickrichtung",
  "up": "oben",
  "down": "unten",
  "left": "links",
  "right": "rechts",
  "Return to the upper-left tile, (0, 0), facing right.":
    "Kehre zum Feld oben links (0, 0) mit Blick nach rechts zurück.",
  "Remove every plant and return to (0, 0), facing right. Inventory and balance stay unchanged.":
    "Entferne alle Pflanzen und kehre zu (0, 0) mit Blick nach rechts zurück. Vorräte und Guthaben bleiben unverändert.",
};
export function translate(text: string, language: Language): string {
  return language === "de" ? german[text] ?? text : text;
}
export function translatePage(language: Language): void {
  document.documentElement.lang = language;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    element.textContent = translate(
      element.getAttribute("data-i18n")!,
      language,
    );
  });
  for (const attribute of ["placeholder", "aria-label"]) {
    document.querySelectorAll<HTMLElement>(`[data-i18n-${attribute}]`).forEach(
      (element) => {
        element.setAttribute(
          attribute,
          translate(element.getAttribute(`data-i18n-${attribute}`)!, language),
        );
      },
    );
  }
}
