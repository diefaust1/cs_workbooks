const btn   = document.getElementById('displayButton');
const img = document.getElementById('hiddenImage');

const crosswordButton = document.getElementById('crosswordButton2');
const crossword = document.getElementById('hiddenCrossword2');

const clueButton = document.getElementById('memoryClueButton');
const clue = document.getElementById('hiddenClueMemory');

crosswordButton.addEventListener('click', () => {
  const isHidden = crossword.hidden;
  crossword.hidden = !isHidden;

  if (isHidden) {
    crosswordButton.textContent = 'Lösung verstecken';
  } else {
    crosswordButton.textContent = 'Anzeigen';
  }
});

btn.addEventListener('click', () => {
  const isHidden = img.hidden;
  img.hidden   = !isHidden;

  if (isHidden) {
	  btn.textContent = 'Lösung verstecken';
  } else {
	  btn.textContent = 'Aufdecken';
  }
});

clueButton.addEventListener('click', () => {
  const isHidden = clue.hidden;
  clue.hidden   = !isHidden;

  if (isHidden) {
	  clueButton.textContent = 'Tipp verstecken';
  } else {
	  clueButton.textContent = 'Tipp';
  }
});

