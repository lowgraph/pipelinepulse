# External Portfolio Presentation & Preview

This directory contains lightweight tooling for testing integration with the candidate's personal portfolio website ([`https://tiagomf.com`](https://tiagomf.com)).

> [!NOTE]
> The personal portfolio website is maintained and hosted independently. Its source code and presentation assets are **not** part of the Pipeline Pulse application repository.

---

## Tracked Files vs. Local Working Copies

| File / Path | Git Status | Purpose |
|---|---|---|
| `portfolio/preview.mjs` | **Tracked** | Generic Node.js HTTP static server used by automated tests to preview static site files on port 3100 |
| `portfolio/README.md` | **Tracked** | Documentation for portfolio preview and verification workflows |
| `portfolio/site/` | **Git-ignored** | Local working copy of the static portfolio website |

---

## Running Portfolio Verification Tests

The test suite in [`tests/browser/portfolio.spec.js`](../tests/browser/portfolio.spec.js) validates the external portfolio presentation (bilingual switching, asset downloads, responsive layouts, and cross-project links).

### Option 1: Test Against the Live Deployment (Fresh Clone)

In a fresh checkout where no local copy of `portfolio/site/` exists, run tests directly against the live production deployment:

```powershell
$env:PORTFOLIO_BASE_URL = 'https://tiagomf.com'
npm run test:portfolio
```

### Option 2: Test Against a Local Working Copy

If you have a local working copy of the static portfolio website:
1. Place the static files in `portfolio/site/` (e.g. `portfolio/site/index.html`, `pipeline-pulse.html`, `silt-strider.html`, etc.).
2. Run the test command:
   ```powershell
   npm run test:portfolio
   ```

When `PORTFOLIO_BASE_URL` is omitted, Playwright automatically boots `node portfolio/preview.mjs` on `http://127.0.0.1:3100` via its `webServer` lifecycle.

---

## Test Fixture References

The bilingual CV reference files used to assert download integrity during portfolio testing reside under [`tests/fixtures/portfolio/`](../tests/fixtures/portfolio/), completely decoupled from application domain logic.
