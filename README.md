# Discover — Personal Library Recommendations

Live website: https://jdeiah55.github.io/discover-reading-room/

Optional metadata backend: https://discover-metadata.onrender.com

The published browser files are in `docs/`. The separate `service/` backend uses private Render environment variables; no API keys, credential store, personal CSV or browser backup are committed. Search indexing is discouraged; this is not access control.

The professor starts with separate browser storage and can choose Try a demonstration library. Core recommendations use browser records. Optional enrichment is connected to the Render backend. Free-host cold starts may delay connection. Supported results can update descriptions and labels; suggestions are screened, not treated as verified facts. Applied data stays in each visitor's browser.

See RENDER-SETUP.md for free-host restart, quota and queue limits. Core recommendations do not require the backend to be awake.

## Purpose and intended users

Discover supports readers who have accumulated a personal collection but need help selecting their next book. It connects current preferences with recorded book attributes and exposes why a recommendation appeared. It is an Introduction to Artificial Intelligence AA midterm prototype developed with AI assistance.

## Try the project

Open the live website above and choose **Try a demonstration library**. It contains 116 entries representing 115 distinct stories. No installation, API key or sign-in is required to explore it. This is a demonstration collection, not a completely verified dataset. See [DEMO-GUIDE.md](DEMO-GUIDE.md) for the assessment walkthrough.

Personal mode and `?demo=1` use separate library, preference, feedback and enrichment storage. Personal mode begins empty on first use and remembers subsequent additions. Demo mode loads the sample collection without replacing personal books. Libraries saved before this separation remain accessible using **Previous saved library** (`?mode=previous`); no old data is deleted. Published scripts and styles use content-based version URLs to prevent stale controls after updates.

## Features and method

- Import CSV, TSV or plain-text book lists, merge additional books, add a title and remove entries. TXT uses one `Title — Author`, `Title | Author` or `Title by Author` per line; TSV supports Title/Author columns and optional labels.
- Describe a reading intention or choose structured genres, moods, atmospheres, tropes, character dynamics, authors, relationships, structure and length.
- Inspect complete matches or qualified partial alternatives, separating supported conditions from unresolved information.
- Tune preferences, save books and give feedback. Feedback changes taste influence, corrections change book information, and title exclusion changes recommendation eligibility without deleting the book.
- Explore the collection, view available series information, draw a random eligible book and export/restore browser-data backups.
- Enrich imported/new books automatically through source lookup and screened AI suggestions. Pause, resume, opt out or undo assignments in library settings. Books added during a run join its queue; existing notes and corrections are preserved.

The browser combines imported identities, bundled source information, reader contributions and optional enrichment. Explicit rules determine eligibility, matching and ranking; a live model does not select the recommendations. Complete matches take priority. Qualified partial alternatives preserve hard restrictions. Personalization influences ordering without supplying missing book facts or overriding eligibility.

Codex assisted implementation, investigation, testing and visual production. Human direction determined scope, acceptance and revisions. Optional Gemini extraction is a separate runtime use of AI. Mood and atmosphere can involve interpretation; missing labels do not prove absence. Scores are not probabilities of enjoyment.

## Repository structure

| Location | Purpose |
|---|---|
| `docs/` | Published website source and assets |
| `service/` | Optional hosted Python enrichment backend |
| `tests/` | Focused matching and metadata checks |
| `render.yaml` | Free Render service settings |
| `RENDER-SETUP.md` | Private configuration and operating limits |
| `connection-check.json` | Bounded live-connection check results |

## Run locally

With Python 3 installed, run from this repository's root:

```sh
python -m http.server 8765 --directory docs
```

Open http://localhost:8765/. Core discovery needs no keys or build step. The hosted backend accepts browser requests from the deployed GitHub origin, so local enrichment requires a separately configured backend. Storage is separate per address; use a complete backup to move collections. `prepare.py` is a packaging helper for the original workspace, not a requirement for running this clone.

## Reproduce focused checks

With a current Node.js installation, run from the repository root:

```sh
node --test tests/story-interpreter.test.js tests/library-metadata.test.js tests/library-import.test.js
```

For the gateway, with Python 3:

```sh
cd service
python -m unittest test_gateway -v
```

On 1 November 2026, these JavaScript files passed 30 tests and the gateway passed five tests. Isolated browser checks with fake provider responses also covered automatic import/addition, active-queue additions, duplicate avoidance, opt-out persistence and fresh/demo entry. They require no API keys. Separate live checks are recorded in `connection-check.json`. These checks do not establish overall metadata accuracy or reader satisfaction.

## Privacy, attribution and limits

Library data and preferences stay in each visitor's browser. No keys, private CSV exports, credential stores, notes or browser backups are committed. Optional enrichment sends public title/author/ISBN and source descriptions to providers. Keys belong in private Render environment variables, never browser code or GitHub.

The site is publicly accessible. Search indexing is discouraged but that is not access control. Anonymous enrichment shares limited quota. Free hosting can sleep; transient server jobs, cache and gateway counters can reset on restart. Applied browser data is retained, but an interrupted queue may require explicit Resume and in-flight work can repeat. Provider-side free-only configuration is required; gateway throttling is not a billing guarantee. Core discovery does not require an awake backend.

Book records retain source references. Visual jackets are AI-generated concept artwork, not official publisher covers. No full book PDFs or reading engine are included. Report and presentation are submitted separately; outdated drafts are not bundled here.

## Next steps

Priorities are stronger source coverage, reader evaluation of explanations, comparative matching tests and durable server processing. Interpretation remains bounded and no reader satisfaction study has been conducted. The system supports a selection; the reader makes the decision.
