// Escape then Tab preserves keyboard navigation out of the editor.
export function enableIndentation(editor: HTMLTextAreaElement): void {
  let releaseTab = false;
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { releaseTab = true; return; }
    const letTabLeave = releaseTab;
    releaseTab = false;
    if (event.key !== "Tab" || letTabLeave || editor.readOnly || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    const { value, selectionStart: start, selectionEnd: end } = editor;
    if (!event.shiftKey && !value.slice(start, end).includes("\n")) {
      editor.setRangeText("    ", start, end, "end");
      return;
    }
    const firstLine = value.lastIndexOf("\n", start - 1) + 1;
    const lastCharacter = end > start && value[end - 1] === "\n" ? end - 1 : end;
    const nextNewline = value.indexOf("\n", lastCharacter);
    const lastLine = nextNewline === -1 ? value.length : nextNewline;
    let firstDelta = 0;
    let totalDelta = 0;
    const replacement = value.slice(firstLine, lastLine).split("\n").map((line, index) => {
      const remove = event.shiftKey ? Math.min(4, line.match(/^ */)![0].length) : 0;
      const delta = event.shiftKey ? -remove : 4;
      if (index === 0) firstDelta = delta;
      totalDelta += delta;
      return event.shiftKey ? line.slice(remove) : "    " + line;
    }).join("\n");
    editor.setRangeText(replacement, firstLine, lastLine, "preserve");
    editor.setSelectionRange(Math.max(firstLine, start + firstDelta), Math.max(firstLine, end + totalDelta));
  });
}
