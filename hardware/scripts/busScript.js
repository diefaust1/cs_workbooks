const busButton = document.getElementById('busButton');
const solution = document.getElementById('hiddenSolution');

const busHelpButton = document.getElementById('busHelpButton');
const helpList = document.getElementById('hiddenHelp');

busButton.addEventListener('click', () => {
  const isHidden = solution.hidden;
  solution.hidden   = !isHidden;

  if (isHidden) {
	  busButton.textContent = 'Lösung verstecken';
  } else {
	  busButton.textContent = 'Aufdecken';
  }
});

busHelpButton.addEventListener('click', () => {
  const isHidden = helpList.hidden;
  helpList.hidden   = !isHidden;

  if (isHidden) {
	  busHelpButton.textContent = 'Lösung verstecken';
  } else {
	  busHelpButton.textContent = 'Hilfe';
  }
});