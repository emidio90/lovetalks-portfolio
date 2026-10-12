# LoveTalks

**A little curiosity. A better conversation.**

LoveTalks turns a few shared interests into conversation starters. Choose an occasion and a mood, explore three suggested topics, then open one for follow-up questions and a listening tip.

A full-stack JavaScript prototype with a coral-and-mint, chat-inspired interface, a no-key local demo, and an optional server-side OpenAI integration.

## Features

- **A complete conversation flow:** choose 1–3 interests, generate three starters, explore a topic, go back, or start over
- **Two explicit modes:** deterministic sample responses by default; optional AI generation with a session opt-in
- **Responsive interface:** semantic controls, keyboard focus states, reduced-motion support, and recoverable loading, cancellation, and error states
- **Server-side AI integration:** OpenAI Responses API, structured JSON output, and input/output moderation
- **Defensive engineering:** request isolation, validation, timeouts, rate limits, bounded concurrency, and safe text rendering

## Run locally

Requires **Node.js 24** and npm. In the project folder:

```sh
npm ci --ignore-scripts
npm run build
npm start
```

Open **http://127.0.0.1:3000**.

Demo mode is the default. No `.env` file or API key is required. After dependencies are installed, demo requests stay on your machine and make no OpenAI calls. The interface labels the responses as samples.

For development, run `npm run dev`. Rebuild before using `npm start` after source changes.

## Optional AI mode

1. Copy `.env.example` to `.env`.
2. Set `APP_MODE=live` and add your own `OPENAI_API_KEY` in that local file.
3. Keep the configured `OPENAI_MODEL` or select a model your account can access that supports the Responses API and Structured Outputs.
4. Start the server and accept the in-app disclosure before generating.

The key stays on the server. Live actions send the selected choices, and the selected topic when elaborating, to OpenAI. Each successful action makes two moderation requests and one generation request. **API charges may apply.** Automatic retries are disabled and requests are time-bounded.

The actual integration is implemented in [`server/openai-provider.js`](server/openai-provider.js) and tested with mocked SDK transport. **A live credential/API smoke test has not been run.**

See [configuration and API reference](docs/API.md) for environment variables, payloads, and error responses.

## Architecture

```text
Browser: questionnaire → topic cards → follow-up questions
                     │ same-origin JSON
                     ▼
Node.js HTTP server: validation, limits, request-local context
                     ├── Demo provider: fixed sample content
                     └── OpenAI provider: moderation → generation → moderation
```

The frontend uses HTML, CSS, and vanilla JavaScript with no runtime framework or external assets. The backend uses Node's built-in HTTP server and the official OpenAI SDK. Playwright is a development-only dependency.

| Path | Responsibility |
| --- | --- |
| `public/` | Interface, async state, consent, and safe DOM rendering |
| `server/app.js` | HTTP routes, origin checks, deadlines, and workload limits |
| `server/validation.js` | Input vocabulary and output contracts |
| `server/*-provider.js` | Interchangeable demo and OpenAI providers |
| `tests/` | API, SDK transport, UI-state, rendering, and style regressions |
| `.github/workflows/check.yml` | Build, test, scan, and browser-check workflow |

## Privacy and security

The questionnaire uses fixed, broad choices. There are no profiles, free-text personal details, uploads, analytics, cookies, browser storage, database, or application-level conversation logs.

Model output is treated as untrusted: it is validated and rendered with `textContent`. Live input and output are moderated. Responses requests use `store: false`; provider retention policies still apply. Review [OpenAI's data controls](https://developers.openai.com/api/docs/guides/your-data) before using live mode.

The server is intentionally **loopback-only**. Public live hosting needs authentication, durable abuse and cost controls, HTTPS, and a deployment review. See [SECURITY.md](SECURITY.md) for the full scope and limitations.

## Tests and verification

```sh
npm run check                    # build, 45 tests, and heuristic secret scan
npx playwright install chromium  # first-time browser setup
npm run test:browser             # desktop and mobile scenarios
npm audit --omit=dev
```

The 45 automated unit, integration, rendering, and style tests pass. They cover concurrent-request isolation, the real SDK with mocked HTTP, validation, refusals, cancellation, stale responses, consent, and literal rendering of HTML-looking text.

The 16-scenario browser suite is included, but browser launch is blocked in the preparation environment. Browser assertions and remote CI remain unverified. See [the QA record](docs/QA.md) for executed checks and the manual checklist.

## Project background

This edition is an **AI-assisted refactor of an existing LoveTalks prototype**, retaining its questionnaire → topics → elaboration idea. The refactor focuses on a clearer interface, safer API boundaries, request isolation, and regression coverage. It is an application-integration project; it does not train a model or validate romantic compatibility.

## License

First-party code is currently **UNLICENSED**, pending the project owner's license choice. Dependency licenses and notices are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
