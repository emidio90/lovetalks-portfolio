# Security and release scope

This package is a local portfolio prototype, not a security-certified production service.

## Included controls

- Default demo mode never constructs an OpenAI client; an API key alone cannot enable paid generation
- Real credentials only read on the server; no environment files, original Git history or credential values included
- Explicit OpenAI endpoint, no arbitrary provider URL from user input
- Strict field allowlists, 4 KiB body limit and model-output length/shape checks
- Request-local preferences and selected topic, including under concurrent requests
- Input/output moderation for both live generation actions; refusal and malformed moderation fail closed
- Abortable provider calls, no automatic retries, bounded body+generation deadline
- Local in-memory request rate/concurrency limits and loopback/Host/Origin checks
- Allowlisted static paths; no server source, dependency directory or private-file serving
- Text-only model rendering, defensive content-security policy, no third-party frontend resources
- Safe errors without raw provider messages and no application-level user-content logs

## Important limitations

- Local-only operation. No login, session authentication, durable shared limiter, distributed rate limits, monetary budget enforcement or production gateway exists
- A hostile process already on the same computer may call local endpoints; UI opt-in is a disclosure mechanism, not an authorization boundary
- Rate limits reset with the process; counts are per direct socket address, not a trusted forwarded header
- Aborting a request cannot guarantee that an already-started provider computation is not billed
- Moderation and prompt constraints can have false positives and false negatives. Structured Outputs and output validation constrain form, not truth or conversational quality
- `store:false` is not a promise of zero provider retention. Review applicable OpenAI data controls
- Unit/transport tests use fixtures; a separate explicit decision is needed to exercise a real credential and accept API costs
- Heuristic scanning detects selected patterns only, not every possible secret or privacy issue
- The browser suite is included; consult [docs/QA.md](docs/QA.md) for what was actually executed in the preparation environment

## Before any public release

1. Review the source, tests, attribution and all material included in the new package
2. Choose a first-party license and confirm ownership/rights
3. Deal separately with any credentials or exposure in the original repository. A clean copy does not revoke an old key or sanitize old history
4. If publishing source, create a new history from this reviewed directory, rather than importing the original history
5. For a public demo, prefer a deliberately static/mock-only deployment. A live deployment needs authentication, durable abuse controls, cost controls, HTTPS, appropriate data notices and deployment-specific review
6. Run the browser suite, current dependency audit and secret scanning again in the release environment; arrange a real live-API smoke test only if authorized

Do not include a credential in an issue, log, screenshot, commit or public report. Report problems privately to the repository owner. No public security-contact address is invented here.
