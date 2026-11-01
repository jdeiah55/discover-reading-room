# Discover hosted demonstration preparation

This folder contains a fresh copy of the current browser website in `dist/`. No Python backend, credential store, personal CSV, or browser backup was copied. Search indexing is discouraged using a robots meta tag; this is not access control.

The professor starts with separate browser storage and can choose Try a demonstration library. Core recommendations use local records. The optional enrichment endpoints are not hosted by GitHub Pages and need a separate backend; this preparation does not claim online enrichment is operational.

## Online enrichment requirements

- Host the existing Python service separately or port it to the chosen server runtime.
- Configure Google Books and Gemini secrets on that server. Windows Credential Manager values do not transfer automatically.
- Send only the necessary public title, author, ISBN and supporting descriptions to providers. Keep browser notes and preferences local.
- Retain conservative identity matching, field evidence, corrections, assignment undo and resumable queue behavior.
- Add durable cache/job storage, batch limits, global quota and per-client limits, bounded concurrent requests and a provider-limit stop. No paid fallback.
- An anonymous endpoint can consume the owner's quota even with rate limits; hiding its address or applying CORS is not authorization.
- Update browser endpoints, privacy text and offline/provider-limit states, then test end to end.

More provider information can improve coverage; automatic extraction remains fallible and must not be presented as comprehensive verification.
