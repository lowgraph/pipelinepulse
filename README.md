# Pipeline Pulse

**Independent technical project · AI-assisted development**

**Marketing & CRM data reconciliation for deterministic metrics and reviewable decisions.**

A deterministic marketing data reconciliation and internal tool prototype built with **Next.js 16, React 19, JavaScript / Node.js, Tailwind CSS 4, and PostCSS**. CSV processing is entirely browser-local and deterministic. The application reconciles paid advertising spend with CRM opportunity pipelines to calculate deterministic CAC, ROAS, and pipeline metrics from the accepted reconciled dataset.

Pipeline Pulse is an independent technical project and portfolio prototype addressing a common Marketing Operations problem: advertising spend and CRM outcomes often live in separate exports, with inconsistent names, duplicated rows, missing identifiers, mixed formats, and data-quality issues that make downstream KPIs unreliable.

The application takes an advertising CSV and a CRM CSV, validates and reconciles them, exposes data-quality problems, and produces deterministic metrics and explicit decision classifications. Development is AI-assisted: I define the operational problem, requirements, reconciliation and business rules, test scenarios, acceptance criteria, product behavior, and release decisions, while AI coding tools assist with implementation, iteration, and debugging.

For architecture and agent guidance, see [System Architecture](docs/ARCHITECTURE.md) and [Agent Path Migration Guide](docs/AGENT_PATH_MIGRATION.md).

**Live demo:** https://tiagomf.com/pipeline  
**Case study:** https://tiagomf.com/pipeline-pulse

> **The system calculates. AI explains.**

---

## Why I built it

Reporting is only as sound as the data feeding it.

Pipeline Pulse focuses on the operational layer before reporting:

- detect and validate incoming CSV structures;
- normalize inconsistent values and formats;
- remove replayed duplicates without collapsing legitimate dimensions;
- reconcile CRM records to advertising campaigns;
- quarantine malformed or ambiguous data instead of guessing;
- calculate KPIs from the accepted canonical dataset;
- apply explicit decision rules;
- optionally generate an executive explanation from already-computed results.

The goal is not to simulate a full attribution platform. It is to show how a small internal tool can turn fragmented exports into a traceable, reviewable decision workflow.

---

## Try it without your own files

The public demo includes **synthetic sample data** so the full workflow can be evaluated without uploading real business data.

Use **Try sample data / Carregar dados de exemplo** in the application.

The current fixture contains six campaigns and deliberately includes duplicate rows so the same validation, deduplication, reconciliation, KPI, and decision pipeline is exercised.

Expected aggregate results from the synthetic fixture:

| Metric | Expected result |
| --- | ---: |
| Ad spend | $46,800 |
| Closed-won revenue | $149,400 |
| Open pipeline | $232,000 |
| ROAS | 3.19× |
| Closed-won records | 67 |
| Duplicates removed | 14 |

The fixture is processed by the real analysis path; the dashboard values are not hard-coded.

---

## Processing pipeline

```mermaid
flowchart LR
    A[Advertising CSV] --> C[Schema & format detection]
    B[CRM CSV] --> C
    C --> D[Validation]
    D --> E[Normalization]
    E --> F[Deduplication]
    F --> G[Campaign reconciliation]
    G --> H[Canonical dataset]
    H --> I[Data-quality evaluation]
    I --> J[Deterministic KPIs]
    J --> K[Decision rules]
    K --> L[Dashboard]
    L --> M[Optional LLM explanation]
```

The deterministic pipeline lives primarily in:

- `lib/import-format.js` — delimiter, encoding, field, date, currency, and format inference;
- `lib/pipeline.js` — validation, normalization, deduplication, reconciliation, KPIs, quality checks, and decision rules;
- `lib/demo.js` — reproducible synthetic sample data;
- `lib/explanation.js` — optional server-side explanation boundary.

No LLM participates in validation, reconciliation, KPI calculation, or decision classification.

---

## Reconciliation rules

Pipeline Pulse is intentionally conservative.

1. **Exact campaign IDs are preferred.**
2. A CRM record with no campaign ID may fall back to a **unique normalized campaign name**.
3. Name normalization handles case, punctuation, Unicode differences, word ordering, camel case, percent notation, and a limited set of equivalent tokens.
4. If a normalized name maps to multiple campaigns, the record remains **ambiguous**.
5. If an explicit CRM campaign ID conflicts with the advertising ID, the system **does not fall back to the name**.
6. Unmatched and quarantined records remain visible in Data Quality and are excluded from attributed metrics.

The application favors a visible unresolved record over a confident-looking but unsupported match.

---

## Deterministic metrics

The dashboard calculates:

- **Total ad spend** — accepted advertising rows;
- **CAC** — accepted ad spend / matched closed-won CRM records;
- **ROAS** — matched closed-won revenue / accepted ad spend;
- **Open pipeline** — matched open-opportunity amounts;
- **Match rate** — matched CRM records / accepted unique CRM records.

Amounts are handled with bounded precision, invalid values are rejected, and zero denominators return unavailable metrics rather than `Infinity` or fabricated zeros.

---

## Decision rules

Recommendations are fixed business rules, not model predictions.

| Decision | Rule |
| --- | --- |
| **Scale** | ≥ 3 closed-won records, positive spend, ROAS ≥ 3 |
| **Maintain** | Same evidence floor, ROAS ≥ 1 and < 3 |
| **Optimize** | Same evidence floor, ROAS < 1 |
| **Gather data** | Minimum evidence not met |
| **Review data** | Any unmatched or quarantined record pauses recommendations |

Because the thresholds are explicit, the same accepted dataset always produces the same result.

---

## Data-quality behavior

Examples of conditions that are surfaced rather than silently repaired include:

- duplicate and conflicting CRM IDs;
- ambiguous campaign names;
- explicit mismatched campaign IDs;
- malformed or impossible dates;
- unknown stages;
- negative or malformed monetary values;
- mixed currencies without a selected reporting currency;
- repeated headers and ragged rows;
- executable spreadsheet cells;
- resource-limit violations.

The quality report keeps these issues inspectable and separates them from accepted records.

---

## Public / private explanation boundary

The public application is entirely deterministic. The interface always displays a **Rule-based preview**. Its `/api/explain` route unconditionally returns HTTP 403 Forbidden and never reads credentials or contacts an external LLM provider. The Cloudflare production deployment explicitly disables generative controls. All schema validation, normalization, deduplication, reconciliation, quality checks, KPIs, and decision rules execute deterministically.

Any AI explanation is strictly optional, decoupled, and available only via an opt-in private local development launcher (`npm run dev:chatgpt`). Only validated, recomputed aggregate metrics and fixed decision labels are ever provided to an external model—never raw CSV rows, customer IDs, emails, or campaign identifiers.

For full architectural details, sandbox isolation rules, and local setup instructions, see [AI Explanation Architecture & Setup](docs/AI_EXPLANATION.md).

---

## Supported imports

The import layer handles, among other cases:

- comma, semicolon, tab, and pipe delimiters;
- quoted and multiline fields;
- common export preambles;
- UTF-8, UTF-16 LE/BE, and Windows-1252;
- decimal comma or decimal point;
- currency prefixes and suffixes;
- ISO, year-first, day-first/month-first, named-month, and Excel serial dates;
- optional CRM record IDs;
- nonstandard field names through detection or manual mapping.

Current file limits are 5 MB, 25,000 rows, 100 columns, and 2,000 characters per cell.

---

## Tech stack

- **Next.js 16**
- **React 19**
- **JavaScript / Node.js**
- **Tailwind CSS 4**
- **Papa Parse**
- **Node test runner**
- **Playwright**
- **Vite / vinext**
- **Cloudflare Workers**

CSV processing is browser-local. The optional explanation route is server-side.

---

## Run locally

Requires **Node.js 22.12+**.

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

Production build:

```bash
npm run build
npm start
```

Run the Node test suite:

```bash
npm test
```

Run browser tests:

```bash
npx playwright test
```

Cloudflare build:

```bash
npm run build:cloudflare
```

---

## Testing & test separation

The repository includes deterministic tests for cases such as:

- duplicate replay;
- conflicting CRM versions;
- order invariance;
- unmatched and mismatched IDs;
- normalized and ambiguous names;
- zero denominators;
- mixed currencies;
- malformed CSV;
- custom mappings;
- row and cell limits;
- formula/prototype/XSS-style inputs;
- fixed decision thresholds;
- safe CSV export;
- optional LLM boundary and failure behavior;
- reproducible sample-data totals.

### Test execution & configuration separation

- **Unit tests:** `npm test` runs the Node.js test runner across all deterministic unit suites (`tests/*.test.js`).
- **Application browser tests:** `npx playwright test` (or `npm run test:browser`) uses default [`playwright.config.js`](playwright.config.js) (`project: app`) targeting `http://127.0.0.1:3000`. Portfolio presentation specs are excluded by default via `testIgnore`.
- **Portfolio presentation tests:** `npm run test:portfolio` uses dedicated [`playwright.portfolio.config.js`](playwright.portfolio.config.js) (`project: portfolio`). It targets `http://127.0.0.1:3100` and automatically starts the tracked generic preview script (`node portfolio/preview.mjs`) via Playwright's `webServer` lifecycle. Alternatively, set `PORTFOLIO_BASE_URL` to test directly against an existing deployment (e.g. `PORTFOLIO_BASE_URL=https://tiagomf.com npm run test:portfolio`). See [`portfolio/README.md`](portfolio/README.md) for preview workflows and [`tests/fixtures/portfolio/`](tests/fixtures/portfolio/) for download verification fixtures.

---

## Cloudflare deployment

Production: https://tiagomf.com/pipeline

The original Next.js development commands remain available. Cloudflare uses the separate vinext/Vite build, with a `/pipeline` base path and a dedicated `pipeline-pulse` Worker. Only `/pipeline` and `/pipeline/*` routes belong to this Worker; the portfolio homepage remains with its existing Worker.

Use Node.js 22.12 or newer. Run `npm run deploy:cloudflare` with Wrangler authenticated to the configured account. `npm run build:cloudflare` builds without publishing; `npx wrangler deploy --dry-run` checks packaging. The generated Wrangler config is under `dist/server` and should not be edited manually.

Run `node scripts/deployment-smoke.mjs https://tiagomf.com` to verify the live empty state, imports, metrics, language toggle, assets and API routing using small synthetic records. The public explanation endpoint must return 403, even when a provider configuration exists. Private explanation is intentionally unavailable in this deployment.

---

## Current scope and limitations

Pipeline Pulse is a **portfolio prototype**, not a production attribution platform.

It currently does not provide:

- a persistent database;
- live CRM or advertising-platform connectors;
- multi-touch attribution;
- automatic FX conversion;
- inferred timezone alignment;
- inferred sales-cycle lag;
- durable user accounts or saved analyses.

Uploaded data and results are cleared on reload.

The prototype assumes that the advertising and CRM exports represent a compatible business period and attribution model.

---

## Project approach

I developed Pipeline Pulse, with AI-assisted implementation, as an independent technical case study around a Marketing Operations data problem.

My focus was defining the operational problem, data contracts, reconciliation behavior, business rules, acceptance criteria, test scenarios, UX/product behavior, and release decisions. AI coding tools assisted with implementation, debugging, and iteration, while deterministic tests and manual review were used to validate the resulting behavior.

The project is meant to demonstrate a broader working pattern:

**find an operational bottleneck → understand the data → define explicit rules → build a testable internal tool → make the result inspectable.**

---

## Related links

- **Live application:** https://tiagomf.com/pipeline
- **Case study:** https://tiagomf.com/pipeline-pulse
- **Portfolio:** https://tiagomf.com
