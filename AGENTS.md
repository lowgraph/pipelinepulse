<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Pipeline Pulse — Agent Instructions & Path Invariants

Before editing this repository, read [docs/AGENT_PATH_MIGRATION.md](docs/AGENT_PATH_MIGRATION.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Operational Guardrails

1. **Canonical Paths**:
   - Sample CSV files belong strictly in `data/sample-exports/` (never recreate `presentation-samples/`).
   - Portfolio asset updates belong strictly in `portfolio/assets/updates/` (never recreate `Update 25-09/`).
   - Domain logic lives in `lib/` (`pipeline.js`, `import-format.js`, `sample-data.js`).
   - Tests live in `tests/` (`tests/*.test.js` and `tests/browser/*.spec.js`).
2. **Deterministic Integrity**:
   - `lib/pipeline.js` and `lib/import-format.js` are 100% deterministic. Never introduce non-deterministic heuristics, external API calls, or LLM calls into data ingestion, normalization, deduplication, reconciliation, KPI derivation, or decision rules.
3. **Public Explanatory Boundary**:
   - The public `/api/explain` route must always return HTTP 403.
   - Any AI explanation logic is restricted to the local, opt-in developer script `scripts/local-chatgpt.mjs`, which runs Codex locally in an ephemeral, sandboxed environment.
4. **Verification Protocol**:
   - Always run `npm test` after modifying domain logic.
   - Run `npm run build` and `npm run build:cloudflare` before considering changes complete.
   - Never stage credentials, client tokens, private datasets, or `.env` files.
