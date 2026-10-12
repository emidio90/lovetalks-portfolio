# Configuration and API reference

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_MODE` | `demo` | Explicitly `demo` or `live`; the presence of a key never enables live mode |
| `HOST` | `127.0.0.1` | Loopback only: `127.0.0.1`, `localhost`, or `::1` |
| `PORT` | `3000` | Local server port |
| `OPENAI_API_KEY` | none | Server-only credential, required only in live mode |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Responses/Structured Outputs-compatible model |
| `API_TIMEOUT_MS` | `12000` | Per-provider-call timeout, 1,000–20,000 ms |
| `REQUEST_TIMEOUT_MS` | `30000` | Body-read plus generation deadline, 3,000–60,000 ms |
| `RATE_LIMIT_PER_MINUTE` | `12` | Requests per local client address, 1–60 |
| `MAX_CONCURRENT_REQUESTS` | `3` | In-process generation slots, 1–10 |

## API contract

`GET /api/config` returns `{ "mode": "demo", "model": null }` in demo mode. `GET /api/health` returns health and mode without provider calls.

`POST /api/topics` takes exactly:

```json
{"interests":["music","travel"],"setting":"friends","tone":"curious"}
```

- `interests`: 1–3 distinct values from `music`, `food`, `travel`, `books`, `film`, `nature`, `technology`, `art`
- `setting`: `first-meeting`, `friends` or `date-night`
- `tone`: `playful`, `thoughtful` or `curious`

Returns `{ "topics": [{ "title": "…", "opener": "…", "why": "…" }], "mode": "demo" }` with exactly three topics.

`POST /api/elaborate` takes the same choices plus a `topic` object with `title`, `opener` and `why`, and returns `{ "elaboration": { "insight": "…", "questions": ["…", "…", "…"], "tip": "…" }, "mode": "demo" }`.

Errors consistently use `{ "error": { "code": "…", "message": "…" } }`. Expected statuses include 400 validation, 413 body size, 415 media type, 422 content refusal/moderation, 429 local rate limit, 502 invalid/unavailable provider output, 503 temporary capacity, and 504 timeout. No raw provider diagnostic or credential is returned.

