export function createInteractiveCrossword(puzzleWords) {
  const grid = document.getElementById("interactive-crossword-grid");
  const checkButton = document.getElementById("check-interactive-crossword");
  const resetButton = document.getElementById("reset-interactive-crossword");
  const status = document.getElementById("interactive-crossword-status");

  const cells = new Map();
  const wordCellKeys = new Map();
  const inputsByPosition = new Map();
  let activeWordNumber = puzzleWords[0].number;

  function positionKey(row, column) {
    return row + "-" + column;
  }

  puzzleWords.forEach((word) => {
    const keys = [];

    Array.from(word.answer).forEach((letter, index) => {
      const row = word.row + (word.direction === "down" ? index : 0);
      const column = word.column + (word.direction === "across" ? index : 0);
      const key = positionKey(row, column);
      const existingCell = cells.get(key);

      if (existingCell && existingCell.letter !== letter) {
        throw new Error("Conflicting crossword letters at " + key);
      }

      const cell = existingCell || {
        row,
        column,
        letter,
        wordNumbers: [],
        startNumbers: [],
      };

      cell.wordNumbers.push(word.number);
      if (index === 0) {
        cell.startNumbers.push(word.number);
      }

      cells.set(key, cell);
      keys.push(key);
    });

    wordCellKeys.set(word.number, keys);
  });

  function getWord(number) {
    return puzzleWords.find((word) => word.number === number);
  }

  function describeCell(cell) {
    const memberships = cell.wordNumbers.map((number) => {
      const word = getWord(number);
      const direction = word.direction === "across" ? "waagerecht" : "senkrecht";
      return "Wort " + number + " " + direction;
    });

    return "Kreuzworträtsel, Zeile " + (cell.row + 1) + ", Spalte "
      + (cell.column + 1) + ", " + memberships.join(" und ");
  }

  function moveInWord(input, offset) {
    const cell = cells.get(input.dataset.position);
    const wordNumber = cell.wordNumbers.includes(activeWordNumber)
      ? activeWordNumber
      : cell.wordNumbers[0];
    const keys = wordCellKeys.get(wordNumber);
    const currentIndex = keys.indexOf(input.dataset.position);
    const target = inputsByPosition.get(keys[currentIndex + offset]);

    if (target) {
      target.focus();
      target.select();
    }
  }

  function moveByCoordinates(input, rowOffset, columnOffset) {
    const cell = cells.get(input.dataset.position);
    const direction = rowOffset === 0 ? "across" : "down";
    const directionalWord = cell.wordNumbers
      .map(getWord)
      .find((word) => word.direction === direction);

    if (directionalWord) {
      activeWordNumber = directionalWord.number;
    }

    const target = inputsByPosition.get(positionKey(
      cell.row + rowOffset,
      cell.column + columnOffset,
    ));

    if (target) {
      target.focus();
      target.select();
    }
  }

  function clearFieldFeedback(input) {
    input.classList.remove("is-correct", "is-incorrect");
    status.textContent = "";
  }

  function renderCrossword() {
    const fragment = document.createDocumentFragment();
    const orderedCells = Array.from(cells.entries())
      .sort(([, first], [, second]) => first.row - second.row || first.column - second.column);

    const rowCount = Math.max(...orderedCells.map(([, cell]) => cell.row)) + 1;
    const columnCount = Math.max(...orderedCells.map(([, cell]) => cell.column)) + 1;
    grid.style.setProperty("--crossword-rows", rowCount);
    grid.style.setProperty("--crossword-columns", columnCount);

    orderedCells.forEach(([key, cell]) => {
      const wrapper = document.createElement("div");
      wrapper.className = "crossword-cell";
      wrapper.style.gridRow = String(cell.row + 1);
      wrapper.style.gridColumn = String(cell.column + 1);

      if (cell.startNumbers.length > 0) {
        const number = document.createElement("span");
        number.className = "crossword-number";
        number.textContent = cell.startNumbers.join("/");
        number.setAttribute("aria-hidden", "true");
        wrapper.append(number);
      }

      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 1;
      input.autocomplete = "off";
      input.autocapitalize = "characters";
      input.spellcheck = false;
      input.dataset.position = key;
      input.setAttribute("aria-label", describeCell(cell));

      input.addEventListener("focus", () => {
        if (!cell.wordNumbers.includes(activeWordNumber)) {
          activeWordNumber = cell.wordNumbers[0];
        }
      });

      input.addEventListener("input", () => {
        const character = Array.from(input.value.toUpperCase())
          .find((value) => /[A-ZÄÖÜ-]/.test(value)) || "";
        input.value = character;
        clearFieldFeedback(input);

        if (character) {
          moveInWord(input, 1);
        }
      });

      input.addEventListener("keydown", (event) => {
        const movement = {
          ArrowLeft: [0, -1],
          ArrowRight: [0, 1],
          ArrowUp: [-1, 0],
          ArrowDown: [1, 0],
        }[event.key];

        if (movement) {
          event.preventDefault();
          moveByCoordinates(input, movement[0], movement[1]);
        } else if (event.key === "Backspace" && input.value === "") {
          event.preventDefault();
          moveInWord(input, -1);
        } else if (event.key === "Enter") {
          event.preventDefault();
          checkCrossword();
        }
      });

      wrapper.append(input);
      inputsByPosition.set(key, input);
      fragment.append(wrapper);
    });

    grid.append(fragment);
  }

  function checkCrossword() {
    let filled = 0;
    let correct = 0;

    inputsByPosition.forEach((input, key) => {
      const value = input.value.toUpperCase();
      const isCorrect = value === cells.get(key).letter;

      input.classList.remove("is-correct", "is-incorrect");

      if (value) {
        filled += 1;
        input.classList.add(isCorrect ? "is-correct" : "is-incorrect");
        if (isCorrect) {
          correct += 1;
        }
      }
    });

    if (filled === 0) {
      status.textContent = "Tragt zuerst Buchstaben in das Rätsel ein.";
    } else if (correct === cells.size) {
      status.textContent = "Alles richtig – ihr habt das Kreuzworträtsel gelöst!";
    } else {
      const incorrect = filled - correct;
      const remaining = cells.size - filled;
      status.textContent = correct + " von " + cells.size + " Feldern sind richtig. "
        + incorrect + " falsch, " + remaining + " noch leer.";
    }
  }

  function resetCrossword() {
    inputsByPosition.forEach((input) => {
      input.value = "";
      input.classList.remove("is-correct", "is-incorrect");
    });

    activeWordNumber = puzzleWords[0].number;
    status.textContent = "Das interaktive Kreuzworträtsel wurde zurückgesetzt.";
    inputsByPosition.values().next().value.focus();
  }

  checkButton.addEventListener("click", checkCrossword);
  resetButton.addEventListener("click", resetCrossword);
  renderCrossword();
}
