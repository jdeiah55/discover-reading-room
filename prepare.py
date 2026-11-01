from pathlib import Path
import shutil

root = Path(__file__).resolve().parent
source = root.parents[1] / 'dist'
target = root / 'docs'
shutil.copytree(source, target, dirs_exist_ok=True)
page = target / 'index.html'
html = page.read_text(encoding='utf-8')
html = html.replace('<head>', '<head><meta name="robots" content="noindex,nofollow,noarchive">', 1)
html = html.replace('<script defer src="enrichment-batch.js"></script>', '<script defer src="hosted-mode.js"></script>')
page.write_text(html, encoding='utf-8')
(target / '.nojekyll').touch()
(target / 'hosted-mode.js').write_text("""'use strict';
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
""", encoding='utf-8')
print('Prepared current website in docs; no credentials or browser data included.')
