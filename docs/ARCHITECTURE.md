# Pipeline Pulse — System Architecture

Pipeline Pulse is a deterministic marketing data reconciliation and performance intelligence system. It reconciles advertising spend data and CRM opportunity data to produce verified CAC, ROAS, and pipeline metrics.

---

## 1. Core Principles

1. **Deterministic by Design**: The calculation engine (`lib/pipeline.js`, `lib/import-format.js`) is completely deterministic. Identical inputs always produce bit-for-bit identical outputs. No LLM or probabilistic model participates in parsing, normalization, deduplication, reconciliation, KPI derivation, or decision rules.
2. **"The system calculates. AI explains."**: Calculation and explanation are strictly separated. The public web application provides rule-based summaries only. The public `/api/explain` route returns HTTP 403. An optional generative explanation layer exists strictly in an isolated local developer script (`scripts/local-chatgpt.mjs`) that communicates via CLI with a sandboxed Codex process, passing recomputed aggregate metrics rather than raw customer rows.
3. **Data Quality Gate**: If any record in an imported dataset is unmatched or quarantined due to conflicting identifiers, invalid amounts, or malformed stages, the recommendation gate defaults to `Review data` rather than guessing or presenting speculative business recommendations.

---

## 2. Ingestion & Processing Flow

The processing flow is implemented in `lib/pipeline.js` and `lib/import-format.js`:

```
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│        Advertising CSV          │      │             CRM CSV             │
└────────────────┬────────────────┘      └────────────────┬────────────────┘
                 │                                        │
                 ▼                                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. Format Detection & Decoding (lib/import-format.js)                   │
│    - Encoding (UTF-8, UTF-16, Windows-1252), delimiters, number/date    │
│    - Header meaning inference with multilingual aliases                 │
│    - Cell-length (≤2000 chars) and formula injection protection (=,+,-)  │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 2. Schema Validation & Normalization (lib/pipeline.js)                  │
│    - Currency validation (rejects mixed currencies, no implicit FX)      │
│    - Date normalization (day/month disambiguation via file evidence)     │
│    - Amount parsing in integer cents (rejects NaN, exponents, negatives)│
│    - Normalizes campaign name tokens (NFKD, case, punctuation, order)   │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 3. Deduplication                                                        │
│    - Ad rows: Exact signature match across all dimensions (preserves    │
│      legitimate multi-day or multi-device entries)                      │
│    - CRM rows: Single ID counted once; conflicting versions quarantined│
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 4. Campaign Reconciliation                                               │
│    - Primary: Exact campaign ID match                                    │
│    - Secondary (ID-less only): Unique normalized name fallback          │
│    - Mismatched IDs NEVER fall back to names                             │
│    - Ambiguous name collisions remain unmatched                          │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 5. Canonical Dataset & Data Quality Evaluation                           │
│    - Accepted unique counts, duplicate count, quarantine log            │
│    - Match rate: matched CRM records / accepted unique CRM records       │
│    - Quality score calculation                                           │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 6. Deterministic KPIs & Decision Rules                                   │
│    - Total Spend: Sum of accepted ad rows (integer cents)                │
│    - Attributed Revenue: Closed-won revenue from matched records         │
│    - CAC: Total spend / matched closed-won count (null if zero closed)   │
│    - ROAS: Attributed revenue / total spend (null if zero spend)         │
│    - Open Pipeline: Value of open opportunities (excludes won/lost)      │
│    - Decision Classifications: Scale, Maintain, Optimize, Gather data,   │
│      or Review data (triggered by any unmatched or quarantined row)      │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 7. UI Dashboard & Summary Model                                          │
│    - Client-side React 19 rendering with Tailwind CSS 4                  │
│    - Rule-based summary generated from computed facts                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Explanatory Layer Separation

- **Public Production**: The Next.js API route `app/api/explain/route.js` unconditionally responds with `403 Forbidden` (`{"error": "AI explanations are not enabled in the public demo."}`). No LLM credentials, provider endpoints, or environment tokens are bundled with public assets.
- **Local Private Launcher**: An optional local tool (`scripts/local-chatgpt.mjs`) starts an isolated local server on port 3002. It uses `scripts/local-chatgpt-adapter.mjs` to execute `codex exec` via CLI in a read-only, ephemeral sandbox. It passes only recomputed aggregate facts (spend, revenue, CAC, ROAS, match rates). Raw CRM rows, customer PII, and campaign names are excluded.

---

## 4. Sample Data Architecture

The project provides synthetic demo datasets for instant evaluation:
- **In-Memory**: `lib/sample-data.js` deterministically generates synthetic advertising and CRM datasets with known mathematical properties (374 total rows, 10 duplicates, 192 matched, 4 unmatched).
- **Exported Files**: Replicas of the synthetic CSVs reside in `data/sample-exports/` (`sample-advertising.csv`, `sample-crm.csv`) for manual upload testing.

---

## 5. Deployment Architecture

Pipeline Pulse supports two deployment pipelines:
1. **Next.js Standalone**: Standard `next build` producing `.next` server/static artifacts.
2. **Cloudflare Worker**: Built with `npm run build:cloudflare` (`vite build` via `@cloudflare/vite-plugin` and `vinext`) compiling to `dist/`, deployed under a `/pipeline` subpath worker.
