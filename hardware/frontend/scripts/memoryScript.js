import { createInteractiveCrossword } from "./crossword.js";

const displayButton = document.getElementById("displayButton");
const mindMapSolution = document.getElementById("hiddenImage");
const clueButton = document.getElementById("memoryClueButton");
const clue = document.getElementById("hiddenClueMemory");

displayButton.addEventListener("click", () => {
  const isHidden = mindMapSolution.hidden;
  mindMapSolution.hidden = !isHidden;
  displayButton.textContent = isHidden ? "Lösung verstecken" : "Aufdecken";
});

clueButton.addEventListener("click", () => {
  const isHidden = clue.hidden;
  clue.hidden = !isHidden;
  clueButton.textContent = isHidden ? "Tipp verstecken" : "Tipp";
});

createInteractiveCrossword([
  { number: 1, answer: "PAGING", direction: "down", row: 1, column: 8 },
  { number: 2, answer: "SSD", direction: "down", row: 3, column: 0 },
  { number: 3, answer: "DUAL-CHANNEL", direction: "across", row: 5, column: 0 },
  { number: 4, answer: "RAM", direction: "down", row: 4, column: 2 },
  { number: 5, answer: "FESTPLATTE", direction: "across", row: 2, column: 2 },
  { number: 6, answer: "BYTE", direction: "down", row: 0, column: 5 },
  { number: 7, answer: "ROM", direction: "across", row: 4, column: 2 },
  { number: 8, answer: "HDD", direction: "down", row: 5, column: 6 },
  { number: 9, answer: "BIOS", direction: "across", row: 4, column: 7 },
]);
