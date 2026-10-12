# Verification record and manual QA

Updated: 12 October 2026 after the coral/mint interface refresh. Local Node.js v24.19.0 / npm 11.9.0.

## Executed checks

- **45 passing unit, integration, rendering, and style tests** using Node's built-in test runner
- Backend end-to-end HTTP demo flow: preferences → three topics → elaboration
- Request isolation across deliberately interleaved requests
- Strict input/output validation, unknown/sensitive field rejection, JSON/body limits
- Safe provider errors, overload/rate limiting, generation timeout and unfinished-body timeout/recovery
- Host/origin checks and attempts to read server/private files through static routes
- Real official OpenAI SDK transport mocked at `fetch`: endpoint paths, model, `store:false`, structured-output schema, token cap, moderation ordering, context, refusal/incomplete responses and HTTP failures
- DOM rendering/async flow tests: model text remains literal, consent gating, reset, repeated clicks, cancellation, late responses, malformed results, configuration failures and elaboration retry
- Five source-level style regressions cover text contrast, target sizes/focus, responsive/reduced-motion rules, application hooks, and preservation of backend transport/live consent
- Build syntax/asset validation, production-start smoke test and heuristic secret-pattern scan
- npm dependency audit of both runtime and development dependencies reported zero known vulnerabilities at preparation time

No paid API request, actual credential test, original-repository change, remote CI execution or deployment was performed. No data from real people was used in tests.

## Browser-test limit

The 16-scenario Playwright suite in `tests/browser/flow.spec.js` was prepared for desktop (1440×1050) and mobile (390×844) Chromium. In this preparation environment, Chromium could not launch because its required local socket operation returned `Operation not permitted`. The final-code retry used the installed Chromium and stopped after its first launch failure; 15 scenarios did not run. No UI assertion executed. Earlier attempts through the elevated route encountered the same restriction, and the separate cloud browser could not reach this workspace's localhost server (`ERR_CONNECTION_REFUSED`).

Consequently **the browser suite did not execute its UI assertions**. These launch failures are not a passed browser check and do not establish a product defect. Pixel layout, actual-browser interaction, touch behaviour, accessibility with assistive technology and cross-browser compatibility remain to be verified. No screenshot is included or claimed.

Run on a normal local machine or CI:

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run check
npm run test:browser
```

The included CI workflow has not been pushed or executed. Tests use only local demo endpoints and mocked live responses.

## Manual checklist before presenting

- [ ] Run the default demo without a `.env` file or API key; confirm the sample/no-OpenAI label
- [ ] At desktop and phone widths, check typography, overflow, click/tap targets and content order
- [ ] Use only the keyboard: skip link, checkboxes, select controls, Generate, topic, Back and Start over
- [ ] Select 1–3 interests and generate; confirm three complete, readable cards
- [ ] Try selecting zero and more than three interests; check the useful, recoverable validation message
- [ ] Open each topic, read three follow-up questions, return to cards and reset
- [ ] Change choices during an in-flight request; confirm the older result cannot replace the new state
- [ ] Cancel generation and elaboration; confirm controls recover and no stale output appears
- [ ] Simulate offline/failed/config-invalid responses in devtools or use the browser suite; confirm retry is possible
- [ ] Refresh or navigate away/back; confirm no previous preferences are read from browser storage
- [ ] With mocked live config, confirm consent is required and reset/revocation disables generation
- [ ] Review API integration and failure tests before explaining this project to an interviewer

## Separate optional live verification

Only run when the owner deliberately enables live mode with their own fresh credential and accepts provider charges/data handling. Verify account/model access, one successful topics/elaboration flow, moderation behaviour and actual latency. Keep credentials out of reports. Mock tests cannot establish these facts.

## Assessment boundaries

This is a focused portfolio refactor and regression pass, not penetration testing or a guarantee that all issues are absent. The original repository and historical credential handling remain a separate concern.
