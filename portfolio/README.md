# Local portfolio copy

The 2026-09-25 hiring-asset update is deployed and verified at https://tiagomf.com. See `UPDATE-2026-09-25.md` for the supplied assets, tests and deployment IDs. The older deployment recorded below is the previous 2026-09-24 release.

- `original/`: unchanged downloads from tiagomf.com, retained for comparison.
- `site/`: edited static website, including the bilingual Pipeline Pulse case study.
- `build.mjs`: regenerates the homepage and case study from the original files and bilingual copy.
- `preview.mjs`: local-only preview server.

From the application workspace, run `node portfolio/build.mjs` then `node portfolio/preview.mjs`. Open http://127.0.0.1:3100.

### Repository Status & Automated Testing

- **Git Tracking Boundary**: The static files under `portfolio/*` (including `site/`) represent local presentation copies and are git-ignored, preserving the candidate's local working copy. Only the generic preview script (`portfolio/preview.mjs`), documentation (`portfolio/README.md`), and approved test fixtures/CVs (`portfolio/assets/updates/`) are tracked in Git.
- **Obtaining External Site Files**: In a fresh checkout, `portfolio/site/` will not exist initially. To obtain or test the site:
  1. *From Live Deployment*: Download the static files from the candidate's live portfolio at https://tiagomf.com and place them in `portfolio/site/`.
  2. *Build from Sources*: Run `node portfolio/build.mjs` (which builds `portfolio/site/` from `portfolio/original/` and updates in `portfolio/assets/updates/`).
  3. *Use Existing Preview URL*: Run against an existing preview server or live deployment without downloading local files by specifying `PORTFOLIO_BASE_URL`:
     ```powershell
     $env:PORTFOLIO_BASE_URL = 'https://tiagomf.com'
     npm run test:portfolio
     ```
- **Preview Server (Port 3100)**: When testing locally, `node portfolio/preview.mjs` serves `portfolio/site/` on `http://127.0.0.1:3100`.
- **Automated Testing**: Run `npm run test:portfolio`. This uses `playwright.portfolio.config.js` (`project: portfolio`). If `PORTFOLIO_BASE_URL` is omitted, Playwright automatically boots `node portfolio/preview.mjs` on port 3100 (or connects to an already-running instance). The default application test command (`npx playwright test`) excludes portfolio tests via `testIgnore`.

The build also runs `update-hiring.mjs` and copies the revised files from `portfolio/assets/updates/`. The supplied PNGs are preserved; run `python portfolio/optimize-assets.py` with Pillow to regenerate lossless WebP delivery copies when those supplied images change. `portfolio/language.js` is the shared language-script source for all three edited pages.

Source links point to https://github.com/lowgraph/pipelinepulse. Set `PIPELINE_SOURCE_URL` before rebuilding only if the repository URL changes.

The original `marketing-performance.html` URL serves the updated case study as well as the new `pipeline-pulse.html` URL. Existing Silt Strider content, screenshot, CV and contact links are preserved. The homepage places Pipeline Pulse first.

The supplied copy was cleaned of chat timestamps and corrected to describe record-based CAC, quality-gated recommendations, and the currently optional/unconfigured LLM service.

Published to https://tiagomf.com on 2026-09-24 using the existing `tiny-meadow-0e19` Cloudflare Worker. Deployment version: `7fe82806-f5fb-4f02-8766-d3815c90f852`.

Deploy this portfolio with the project-local Wrangler CLI and `deploy --config portfolio/wrangler.jsonc` after rebuilding. The root app's Wrangler configuration deploys the separate Pipeline Pulse app, not this portfolio.

Verified all ten live assets match the local files byte-for-byte, including both new CV PDFs. Verified the language toggle switches the CV download, the contact address is contato@tiagomf.com, and the existing /pipeline app remains reachable.
