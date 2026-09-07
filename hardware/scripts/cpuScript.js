const btn = document.getElementById('crosswordButton');
const crossword = document.getElementById('hiddenCrossword');

btn.addEventListener('click', () => {
  const isHidden = crossword.hidden;
  crossword.hidden   = !isHidden;

  if (isHidden) {
	  btn.textContent = 'Lösung verstecken';
  } else {
	  btn.textContent = 'Aufdecken';
  }
});