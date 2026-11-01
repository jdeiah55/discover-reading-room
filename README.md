# Discover hosted demonstration preparation

Live website: https://jdeiah55.github.io/discover-reading-room/

Optional metadata backend: https://discover-metadata.onrender.com

The published browser files are in `docs/`. The separate `service/` backend uses private Render environment variables; no API keys, credential store, personal CSV or browser backup are committed. Search indexing is discouraged; this is not access control.

The professor starts with separate browser storage and can choose Try a demonstration library. Core recommendations use browser records. Optional enrichment is connected to the Render backend. Free-host cold starts may delay connection. Supported results can update descriptions and labels; suggestions are screened, not treated as verified facts. Applied data stays in each visitor's browser.

See RENDER-SETUP.md for free-host restart, quota and queue limits. Core recommendations do not require the backend to be awake.

## Online enrichment requirements

- Host the existing Python service separately or port it to the chosen server runtime.
- Configure Google Books and Gemini secrets on that server. Windows Credential Manager values do not transfer automatically.
- Send only the necessary public title, author, ISBN and supporting descriptions to providers. Keep browser notes and preferences local.
- Retain conservative identity matching, field evidence, corrections, assignment undo and resumable queue behavior.
- Add durable cache/job storage, batch limits, global quota and per-client limits, bounded concurrent requests and a provider-limit stop. No paid fallback.
- An anonymous endpoint can consume the owner's quota even with rate limits; hiding its address or applying CORS is not authorization.
- Update browser endpoints, privacy text and offline/provider-limit states, then test end to end.

More provider information can improve coverage; automatic extraction remains fallible and must not be presented as comprehensive verification.
