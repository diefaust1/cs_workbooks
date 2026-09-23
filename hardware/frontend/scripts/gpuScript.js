const gpuButton = document.getElementById('GPUTextButton');
const gpuText = document.getElementById('hiddenGPUText');

gpuButton.addEventListener('click', () => {
  const isHidden = gpuText.hidden;
  gpuText.hidden = !isHidden;

  if (isHidden) {
    gpuButton.textContent = 'Lösung verstecken';
  } else {
    gpuButton.textContent = 'Anzeigen';
  }
});

