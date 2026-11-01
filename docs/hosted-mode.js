'use strict';
(() => {
 const latest = document.getElementById('metadata-latest');
 if (latest) latest.hidden = true;
 const panel = document.getElementById('metadata-review');
 if (panel) {
  const note = document.createElement('p');
  note.textContent = 'Live metadata enrichment is not connected on this hosted demonstration. Existing book details, your classifications and saved lookup files remain available.';
  panel.querySelector('p').after(note);
 }
})();
