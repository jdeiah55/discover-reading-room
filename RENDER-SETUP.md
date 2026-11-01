# Connect optional metadata enrichment

This is a separate backend for the existing GitHub Pages site. It is not live until deployed and configured.

## Render web service settings

Connect only `jdeiah55/discover-reading-room` to Render. Create a **Web Service**, not a Static Site.

- Name: `discover-metadata` (a different available name is fine)
- Language/runtime: Python 3
- Branch: `main`
- Root directory: leave blank
- Build command: `pip install -r service/requirements.txt`
- Start command: `gunicorn --chdir service --workers 1 --threads 8 --timeout 120 app:app`
- Instance type: **Free**
- Health check: `/health`

Environment variables (values entered privately in Render, never GitHub or chat):

| Name | Value |
|---|---|
| `DISCOVER_ALLOWED_ORIGIN` | `https://jdeiah55.github.io` |
| `GOOGLE_BOOKS_API_KEY` | Existing Google Books key |
| `GEMINI_API_KEY` | Existing Gemini key, optional |
| `GEMINI_MODEL` | Exact accessible text-model ID for that key/project |

Use a project without billing/paid upgrade. This gateway does not configure provider billing. Uncheck AI in the website if Gemini is not configured. Do not enter an OpenAI key; this backend does not use OpenAI.

After Render reports Live, retain its exact HTTPS origin. The website must be rebuilt using `DISCOVER_METADATA_URL` set to that origin, committed and pushed. Do not guess the URL.

## Operating limits

- Existing conservative identity matching, evidence extraction, automatic screening and correction precedence remain in use.
- One worker processes one batch of up to five books at a time; simultaneous visitors may need to wait.
- Default limits: 12 batches per anonymous session per day, 24 per IP per day, 180 external provider calls globally per day within the running instance. Cache hits do not reserve provider-call budget.
- These gateway counters, session jobs and cache are temporary and can reset when a free Render instance restarts. They are abuse reduction, not an absolute billing guarantee; provider-side free-only configuration is required.
- Applied labels and remaining queue live in the visitor's browser. After a server restart the reader explicitly reconnects/resumes. In-flight work not yet saved in the browser may be looked up again. This is not durable unattended server processing.
- Free services can sleep and cold-start. Initial connection allows up to two minutes; ordinary job polling has a shorter timeout.
- Access is anonymous. CORS is a browser restriction, not authentication. Random session tokens isolate job reads but do not prevent determined quota consumption. Never put keys or full personal notes in requests.
- Only public title/author/ISBN and returned source descriptions go to providers. No browser library synchronization or cross-user taste sharing is introduced.

## Verification before claiming connected

Check health, configuration flags without secrets, cross-origin browser request success, one source lookup, one evidence-linked assignment, refresh persistence, quota/error handling and queue recovery. The local gateway unit tests use fakes and do not prove provider access or deployment success.
