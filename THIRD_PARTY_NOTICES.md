# Third-party notices

The release does not bundle `node_modules`, a browser binary, web fonts, photographs, videos, third-party UI libraries or the original prototype's unverified assets. npm installs the pinned packages below separately, retaining their own licenses and notices.

| Package | Version | Role | Declared license | Upstream |
| --- | --- | --- | --- | --- |
| `openai` | 7.32.0 | Server-only API SDK | Apache-2.0 | https://github.com/openai/openai-node |
| `@playwright/test` | 1.64.0 | Development/browser tests | Apache-2.0 | https://github.com/microsoft/playwright |
| `playwright` | 1.64.0 | Development dependency of the test runner | Apache-2.0 | https://github.com/microsoft/playwright |
| `playwright-core` | 1.64.0 | Browser automation implementation | Apache-2.0 | https://github.com/microsoft/playwright |

License/notice copies from the installed packages are preserved under `docs/licenses/`. Playwright's bundled third-party notices are included as well. These notices do not grant a license to first-party LoveTalks material. Review licensing independently before redistributing dependencies or adding assets.

Node.js and Chromium/other browser binaries are prerequisites installed separately and are not included in this source archive.
