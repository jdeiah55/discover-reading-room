# Discover — Personal Library Recommendations

Discover helps readers choose what to read next from their own book collection. Import a list, describe the experience you want or select filters, then inspect the information supporting each suggestion.

**Use Discover directly in your browser, without installation or sign-in.**

## Open the website

| Mode | Link | What opens |
|---|---|---|
| **Personal mode** | [Start your own library](https://jdeiah55.github.io/discover-reading-room/?v=20261101-modes) | An empty personal space on first use; your additions are remembered afterward. |
| **Demonstration mode** | [Explore the sample collection](https://jdeiah55.github.io/discover-reading-room/?demo=1&v=20261101-modes) | A separate collection of 116 entries representing 115 distinct stories. Suitable for assessment without preparing an import. |

Personal and demonstration modes have separate libraries, preferences, feedback, saved books and enrichment progress. Switching modes does not replace the other collection. These spaces are local to each browser; they are not accounts synchronized between devices.

## How to use Discover

1. **Choose your starting point.** Open personal mode to bring your own collection, or demonstration mode to explore the supplied sample.
2. **Add books.** Upload a CSV, TSV or TXT list, or use **Add one book**. **Add another book list** merges additions without replacing existing entries. Replacing the entire collection is a separate confirmed action.
3. **Let details enrich automatically.** Enrichment starts after an import or addition. Books added during an active run join its queue. You can use the available library information while processing continues.
4. **Express what you want.** Use **Describe the feeling** for a recognized descriptive request, or **Curate my read** for explicit filter selections. Supported wording includes character-role equivalents and selected mood, trope and structure synonyms, such as heroine/woman/lady, hopeful/optimistic, secret/hidden identity, and duet/duology. Interpretation remains bounded; unrecognized details are not silently discarded, and synonyms do not add evidence to a book. Available filter choices reflect the current library's information.
5. **Inspect the suggestions.** Open a book's matching details to distinguish supported conditions from unresolved information. When no complete match is established, qualified partial alternatives may appear.
6. **Refine and preserve your experience.** Save titles, tune your taste, correct book details, give feedback or exclude a title from recommendations. Export a complete backup to move or preserve your browser data.

For an assessment-ready sequence and example filters, see [DEMO-GUIDE.md](DEMO-GUIDE.md).

## Supported book-list files

| Format | Structure |
|---|---|
| CSV | `Title` and `Author` columns, including standard Goodreads exports. Optional classification columns can contain semicolon-separated labels. |
| TSV | Tab-separated columns, including optional classification columns; a two-column title/author list can also be imported without a header. |
| TXT | One book per line using `Title — Author`, `Title | Author` or `Title by Author`. A tab between title and author is also accepted. |

Example text file:

```text
The Night Circus — Erin Morgenstern
Pride and Prejudice — Jane Austen
```

Imports are limited to 10 MB and 10,000 rows. Unsupported formats and ambiguous text lines receive an error rather than a guessed identity. Duplicate entries keep their existing notes. These are book-list imports, not PDF/EPUB uploads or a full-text reading feature.

## Automatic metadata enrichment

Automatic enrichment is enabled by default and can be disabled under **Give your books a little more detail** in library management. **Pause**, **Resume** and assignment undo remain available. A paused queue is not silently resumed merely because another title is added.

The connected service looks up public book identities through Google Books and Open Library. With AI extraction enabled, Gemini proposes labels linked to returned passages. The browser screens these suggestions before assigning supported details, preserves reader corrections, and refreshes filters and active results as working records change. Existing bundled records can also supply information immediately.

**A completed lookup does not mean every field is verified or that new labels must be added.** Suggestions can duplicate existing information, fail identity checks or lack sufficient support. Some details remain unresolved; mood and atmosphere can involve interpretation.

Processing runs in small batches while the website is open. Free-host wake-up delays, service contention and provider limits can pause a run. Applied details and remaining progress are saved in the browser, but temporary server jobs can be lost on restart; explicit Resume may be required and unfinished lookups can repeat. This is not unlimited or unattended background research. Ordinary recommendations continue to work with available records when enrichment is unavailable.

## Purpose and intended users

Discover supports readers who have accumulated a personal collection but need help selecting their next book. It connects current preferences with recorded book attributes and exposes why a recommendation appeared. It is an Introduction to Artificial Intelligence AA midterm prototype developed with AI assistance.

## Try the project

For a quick evaluation, use demonstration mode from the table above. The sample collection is not a completely verified dataset. No visitor API setup is needed for the deployed project; self-hosting the enrichment service requires private server configuration described in [RENDER-SETUP.md](RENDER-SETUP.md).

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

GitHub Pages serves the website and browser interactions. Render runs the separate metadata API at https://discover-metadata.onrender.com. Provider keys are private server settings, not website files. See [RENDER-SETUP.md](RENDER-SETUP.md) for configuration and operating limits.

## Run locally

With Python 3 installed, run from this repository's root:

```sh
python -m http.server 8765 --directory docs
```

Open http://localhost:8765/. Core discovery needs no keys or build step. The hosted backend accepts browser requests from the deployed GitHub origin, so local enrichment requires a separately configured backend. Storage is separate per address; use a complete backup to move collections. The website can be run directly from `docs/` without a packaging step.

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

On 1 November 2026, these JavaScript files passed 30 tests and the gateway passed five tests. On 2 November, the JavaScript checks passed 36 tests, including equivalent wording, negation, role direction, unknown details and author-name preservation. Isolated browser checks with fake provider responses also covered automatic import/addition, active-queue additions, duplicate avoidance, opt-out persistence and fresh/demo entry. They require no API keys. Separate live checks are recorded in `connection-check.json`. These checks do not establish overall metadata accuracy or reader satisfaction.

## Privacy, attribution and limits

Library data and preferences stay in each visitor's browser. No keys, private CSV exports, credential stores, notes or browser backups are committed. With automatic enrichment enabled, public title/author/ISBN and source descriptions can be sent to providers after imports and additions. Private reader notes and preference profiles are not sent for this extraction. Keys belong in private Render environment variables, never browser code or GitHub.

The site is publicly accessible. Search indexing is discouraged but that is not access control. Anonymous enrichment shares limited quota. Free hosting can sleep; transient server jobs, cache and gateway counters can reset on restart. Applied browser data is retained, but an interrupted queue may require explicit Resume and in-flight work can repeat. Provider-side free-only configuration is required; gateway throttling is not a billing guarantee. Core discovery does not require an awake backend.

Book records retain source references. Visual jackets are AI-generated concept artwork, not official publisher covers. No full book PDFs or reading engine are included. The report and presentation are submitted separately.

## Next steps

Priorities are stronger source coverage, reader evaluation of explanations, comparative matching tests and durable server processing. Interpretation remains bounded and no reader satisfaction study has been conducted. The system supports a selection; the reader makes the decision.
