# Agent Path Migration Guide — Pipeline Pulse

Date: 2026-09-26  
Migration branch: `portfolio/restructure` — merged on 2026-09-26  
Canonical branch: `master`

> [!NOTE]
> The historical migration branch (`portfolio/restructure`) has been merged into `master` and retired. Agents must work directly on the canonical default branch (`master`) using the canonical paths defined below. Do not search for, checkout, or recreate the retired migration branch.

This document defines canonical repository locations, path migrations, and operational guidelines for AI agents working in this repository.

---

## 1. Repository Map

| Area | Canonical Path | Description |
|---|---|---|
| **Application UI** | `app/` | Next.js App Router root (`layout.js`, `page.js`, `globals.css`, `api/explain/route.js`) |
| **Components** | `components/` | React 19 UI presentation components (`import-panel.js`, `kpi-cards.js`, etc.) |
| **Core Domain** | `lib/` | Deterministic pipeline (`pipeline.js`), CSV format parser (`import-format.js`), sample data generator (`sample-data.js`), translations (`translations.js`) |
| **Sample Data** | `data/sample-exports/` | Synthetic CSV export files for manual download and import testing |
| **Test Suites** | `tests/` | Node built-in unit tests (`tests/*.test.js`) and Playwright specs (`tests/browser/*.spec.js`) |
| **Test Fixtures** | `tests/fixtures/` | Input fixtures used directly by automated test suites (`crm-sales.csv`, `media-spend.csv`) |
| **Architecture & Docs**| `docs/` | System architecture (`ARCHITECTURE.md`), AI explanation boundary (`AI_EXPLANATION.md`), and migration guides (`AGENT_PATH_MIGRATION.md`) |
| **Tooling & Scripts** | `scripts/` | Local scripts (`local-chatgpt.mjs`, `local-chatgpt-adapter.mjs`, `deployment-smoke.mjs`) |
| **Portfolio Tooling** | `portfolio/preview.mjs` | Tracked generic preview server for testing portfolio presentation on port 3100 |
| **Portfolio Fixtures**| `tests/fixtures/portfolio/` | Reference CV PDF fixtures for bilingual portfolio browser verification |

---

## 2. Path Migration Table

| Deprecated / Old Path | Canonical New Path | Purpose |
|---|---|---|
| `presentation-samples/` | `data/sample-exports/` | Sample advertising & CRM CSV files |
| `Update 25-09/` | `tests/fixtures/portfolio/` | Reference CV PDF test fixtures |
| `portfolio/assets/` | `tests/fixtures/portfolio/` | Relocated test fixtures |

---

## 3. Deprecated Paths (Do Not Recreate)

> [!WARNING]
> Do NOT create or write new files to:
> - `presentation-samples/`
> - `Update 25-09/`
> - `portfolio/assets/`
> 
> All sample data belongs in `data/sample-exports/`. All test fixtures belong under `tests/fixtures/`.

---

## 4. Supported Commands & Verification

- **Install dependencies**: `npm install` (requires Node.js >=22.12.0)
- **Run unit tests**: `npm test` (uses Node.js test runner against `tests/*.test.js`)
- **Run application browser tests**: `npx playwright test` or `npm run test:browser` (uses default `playwright.config.js`, project `app`, against `http://127.0.0.1:3000`; portfolio tests are excluded by default)
- **Run portfolio browser tests**: `npm run test:portfolio` (uses `playwright.portfolio.config.js`, project `portfolio`, targeting `http://127.0.0.1:3100`; automatically boots tracked `node portfolio/preview.mjs` or connects to an existing server / `PORTFOLIO_BASE_URL`)
- **Portfolio preview server**: `node portfolio/preview.mjs` (starts local preview server for `portfolio/site/` at `http://127.0.0.1:3100`)
- **Development server**: `npm run dev` (starts Next.js at `http://127.0.0.1:3000`)
- **Production Next.js build**: `npm run build`
- **Cloudflare Worker build**: `npm run build:cloudflare` (runs `vite build` via vinext)
- **Local opt-in ChatGPT launcher**: `npm run dev:chatgpt` (starts local server on port 3002)

---

## 5. Agent Invariants

1. **Deterministic Calculation**: Never add probabilistic or LLM-dependent calculations to `lib/pipeline.js` or `lib/import-format.js`.
2. **Public API Boundary**: `app/api/explain/route.js` must always reject with status 403.
3. **No Private Secrets**: Never commit `.env`, API keys, client tokens, or real customer CSVs.
