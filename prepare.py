from pathlib import Path
import shutil
import json
import os
import re
import hashlib
from urllib.parse import urlsplit

root = Path(__file__).resolve().parent
source = root.parents[1] / 'dist'
target = Path(os.getenv('DISCOVER_OUTPUT_DIR', str(root / 'docs')))
shutil.copytree(source, target, dirs_exist_ok=True)
page = target / 'index.html'
html = page.read_text(encoding='utf-8')
html = html.replace('<head>', '<head><meta name="robots" content="noindex,nofollow,noarchive">', 1)
html = html.replace('<script defer src="enrichment-batch.js"></script>', '<script defer src="hosted-mode.js"></script>')
endpoint = os.getenv('DISCOVER_METADATA_URL', '').rstrip('/')
if endpoint:
    parsed = urlsplit(endpoint)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.path not in ('','/') or parsed.username or parsed.query or parsed.fragment:
        raise ValueError('Metadata URL must be an HTTPS origin without credentials, path or query.')
    html = html.replace('<script defer src="hosted-mode.js"></script>', '<script defer src="hosted-config.js"></script><script defer src="hosted-enrichment.js"></script>')
    (target / 'hosted-config.js').write_text('window.DiscoverMetadataOrigin = '+json.dumps(endpoint)+';\n',encoding='utf-8')
    batch = (source / 'enrichment-batch.js').read_text(encoding='utf-8')
    batch = batch.replace("csrf='',busy=false", "csrf=localStorage.getItem('discover-hosted-token:'+window.DiscoverMetadataOrigin)||'',busy=false")
    batch = batch.replace("fetch('/api/enrichment/'+path", "fetch(window.DiscoverMetadataOrigin+'/api/enrichment/'+path")
    batch = batch.replace("headers:data?{'Content-Type':'application/json','X-Discover-Token':csrf}:{}", "headers:{...(data?{'Content-Type':'application/json'}:{}),'X-Discover-Token':csrf}")
    batch = batch.replace('AbortSignal.timeout(15000)', "AbortSignal.timeout(path==='config'?120000:20000)")
    batch = batch.replace("csrf=config.csrf;", "csrf=config.csrf;localStorage.setItem('discover-hosted-token:'+window.DiscoverMetadataOrigin,csrf);")
    batch = batch.replace("throw Error(result.error||'The queue could not be opened.');", "throw Error(response.status===403?'Batch not found. Reconnect and resume your saved queue.':result.error||'The queue could not be opened.');")
    batch = batch.replace("notice=e.message+' Restart Discover and resume to continue.'", "notice=e.message+' Resume to reconnect; applied labels are kept.'")
    # A free host can lose a temporary job. The pending queue remains in browser storage.
    batch = batch.replace("saved.job=null;job=null;", "saved.job=null;job=null;csrf='';localStorage.removeItem('discover-hosted-token:'+window.DiscoverMetadataOrigin);")
    batch = batch.replace("if(!csrf)csrf=(await request('config')).csrf;", "if(!csrf)await configure(job.useAI);")
    # Newly injected token calls also use the selected personal/demo storage.
    batch = re.sub(r'(?<!\|)localStorage\.(getItem|setItem|removeItem)', r'(window.DiscoverStorage||localStorage).\1', batch)
    (target / 'hosted-enrichment.js').write_text(batch,encoding='utf-8')
    html = html.replace('No automatic external book lookup or paid AI service is used in this version.', 'Optional enrichment sends public book titles, authors, ISBNs and source descriptions to Google Books, Open Library and, when selected, Gemini. Your notes and preferences remain in this browser. Provider limits can pause processing.')
    html = html.replace('<script defer src="hosted-config.js">','<script defer src="hosted-connected.js"></script><script defer src="hosted-config.js">')
    (target/'hosted-connected.js').write_text("document.getElementById('metadata-latest').hidden=true;",encoding='utf-8')
def versioned(match):
    name = match.group(2)
    asset = target / name
    if not asset.is_file():
        return match.group(0)
    digest = hashlib.sha256(asset.read_bytes()).hexdigest()[:12]
    return match.group(1) + name + '?v=' + digest + match.group(3)
html = re.sub(r'((?:src|href)=")([^"?]+\.(?:js|css))(\")', versioned, html)
html = html.replace('<html lang="en">','<html lang="en" data-release="20261101-modes">')
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
