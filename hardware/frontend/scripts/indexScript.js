const btn   = document.getElementById('displayButton');
const img = document.getElementById('hiddenImage');

const btnList = document.getElementById('listButton');
const list = document.getElementById('hiddenList');

const helpButton = document.getElementById('indexHelpButton');
const helpText = document.getElementById('indexHiddenText');


btn.addEventListener('click', () => {
  const isHidden = img.hidden;
  img.hidden   = !isHidden;

  if (isHidden) {
	  btn.textContent = 'Lösung verstecken';
  } else {
	  btn.textContent = 'Anzeigen';
  }
});

btnList.addEventListener('click', () => {
  const isHidden = list.hidden;
  list.hidden = !isHidden;

  if (isHidden) {
    btnList.textContent = 'Lösung verstecken';
  } else {
    btnList.textContent = 'Hilfe';
  }
});

helpButton.addEventListener('click', () => {
  const isHidden = helpText.hidden;
  helpText.hidden = !isHidden;

  if (isHidden) {
    helpButton.textContent = 'Lösung verstecken';
  } else {
    helpButton.textContent = 'Hilfe';
  }
});