# Pipeline Pulse

A marketing intelligence prototype built with **Next.js 16, React 19, JavaScript / Node.js, Tailwind CSS 4, and PostCSS**. CSV processing is browser-local. The page starts empty; users upload an advertising CSV and a CRM CSV. Synthetic fixtures are included for reproducible tests.

## Run

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. For production, run `npm run build` then `npm start`. The app includes an optional server-side explanation route. A separate vinext build targets Cloudflare Workers; see deployment instructions below.

```sh
npm test
npx playwright test
```

## Import

Everything stays on one page: inline imports, KPI cards, reconciliation stats, campaign charts and decisions, expandable diagnostics, and the summary at the bottom. The top navigation scrolls between sections. **Clear data** removes uploads and results.

Use the inline upload cards to supply one advertising CSV and one CRM CSV. Detection runs immediately and shows the selected spend, ID, revenue, and campaign columns. Open **Detection settings** for column previews, date order, currency, and custom stage meanings. Failed imports preserve the current results.

The detector combines normalized multilingual header aliases, header meaning, column-value profiles, and unambiguous campaign-value overlap across the two files. It can detect nonstandard CRM headers from email/UUID identifiers, monetary values, and known stage values. Unknown or equally plausible fields remain an explicit inline choice. Format detection cannot invent absent revenue, stable IDs, or attribution data.

Combine exports of the same kind before importing; record IDs and campaign IDs must be globally unique within each combined source. Use exports covering the same business period and attribution model.

- Ads: campaign ID or name, spend. Optional date, currency, ad ID, and additional dimensions. Google API `cost_micros` values are converted to currency units.
- CRM: campaign ID or name and stage. Record IDs are optional; without an ID, exact normalized row contents are used for deduplication, preserving rows with different names or other fields. Amount detection works independently of IDs. A deal/opportunity ID, when present, takes precedence over a contact ID. Missing amount columns or blank amounts produce unavailable affected revenue/ROAS/pipeline metrics, while record counts and CAC still work.
- Comma, semicolon, tab, and pipe delimiters; quoted/multiline fields; `sep=` declarations; UTF-8, UTF-16 LE/BE and Windows-1252; unsorted rows; common report preambles; and wholly blank trailing columns are handled. Repeated header records are quarantined.
- Numbers default to automatic parsing per value: decimal comma/point, currency prefixes/suffixes, spaces, and apostrophe grouping. A sole separator followed by three digits means thousands, not three decimal places. Explicit format overrides are available.
- Dates accept ISO dates/timestamps, year-first slashes, day-first/month-first numeric dates, English/Portuguese month names, and Excel serial dates. File-level evidence resolves day/month order. Ambiguous dates require an explicit choice; impossible dates remain quarantined.
- Currency is detected from column values, amount headers, and symbols. Without evidence it defaults to USD with a warning. Mixed currencies require selecting a reporting currency; other currencies are quarantined, never converted.
- Limits: 5 MB, 25,000 rows, 100 columns per file; 2,000 characters per cell. Amounts have up to two decimal places and a bounded magnitude; unsafe totals fail rather than lose precision.

## Deterministic processing

`lib/import-format.js` handles format and field inference. `lib/pipeline.js` implements schema validation → normalization → deduplication → reconciliation → canonical dataset → quality evaluation → KPIs → decision rules → dashboard model. No LLM participates in these steps.

Identical normalized advertising rows are deduplicated including all additional source dimensions, so separate devices, ad groups, and days are preserved. Without source transaction IDs, two genuinely distinct but identical rows cannot be distinguished; export at a documented grain. CRM IDs count once. Conflicting versions of a CRM ID are all quarantined rather than selecting an arbitrary winner. Unknown/ambiguous stages (including bare `Closed`), negative or malformed amounts, impossible dates, mixed currencies, ragged rows, and executable spreadsheet cells are quarantined.

Campaign reconciliation uses exact IDs. Only CRM records without campaign IDs can fall back to a unique normalized name. Normalization removes punctuation, folds case, and normalizes Unicode. A unique set of equivalent name tokens also handles reordered words, camel case, percent notation, and abandon/abandoner variations. Years, regions and audience sizes remain significant. Name collisions are ambiguous and never guessed. Explicit mismatched IDs never fall back to names. IDs must refer to the same shared campaign identifier; a Salesforce internal campaign ID is not assumed to equal a Google Ads ID. Map these identifiers before importing when systems use different IDs. Unmatched CRM records remain visible in Data quality and are excluded from attributed KPIs.

### Definitions

- **Total spend:** all accepted advertising rows, calculated in integer cents.
- **CAC:** total spend / matched closed-won record count. Zero closed-won records → unavailable. This is record-based, not a cross-deal unique-person count.
- **ROAS:** matched closed-won revenue / total spend. Zero spend → unavailable.
- **Open pipeline:** amounts of matched open opportunities; excludes won and lost. No matched open opportunities or missing contributing amounts makes this metric unavailable; explicit zero amounts remain zero.
- **Match rate:** matched CRM records / accepted unique CRM records.
- **Scale:** ≥ 3 closed-won records, positive spend, ROAS ≥ 3.
- **Maintain:** same evidence floor, ROAS ≥ 1 and < 3.
- **Optimize:** same evidence floor, ROAS < 1.
- **Gather data:** evidence floor not met.
- **Review data:** any unmatched or quarantined record pauses all recommendations.

The dashboard is an all-imported-data snapshot. Dates describe the accepted ad rows; no fake previous-period comparisons are shown. It does not infer cross-source attribution, multi-touch attribution, FX rates, timezone alignment, sales-cycle lag, or profit.

## Optional LLM explanation

Without configuration, the bottom panel is explicitly labeled **Rule-based preview**. It does not impersonate an AI response. Configure a trusted server-side LLM adapter in `.env.local` using `.env.example`:

```text
LLM_EXPLANATION_URL=https://your-service.example/explain
LLM_EXPLANATION_TOKEN=your-server-side-token
```

The adapter contract is `POST { instructions, facts }` → `{ text: string }`. Connect your preferred LLM behind that adapter. Keys stay server-side. Clicking Generate sends source CSVs to this application's server for independent recomputation; only anonymous aggregate metrics and fixed decision labels are forwarded to the external adapter. Campaign names, IDs, emails, and raw cells are not forwarded. The explanation is rendered as plain text and cannot update KPIs or decisions. Requests time out after 20 seconds. Missing configuration and service failure leave calculations usable.

The prototype binds to loopback locally. Add authentication, durable rate limits, and deployment-specific access controls before exposing the paid explanation route on a public network. No database or live advertising/CRM connector is configured. Reloading clears uploaded data and results; the selected English/Portuguese language preference persists.

## Verification

Node tests cover duplicate replay, conflicting CRM versions, order invariance, unmatched IDs, normalized and ambiguous names, dimensions, zero denominators, precise amounts, currencies, malformed CSV, custom mappings, schema errors, row/cell limits, formula/prototype/prompt injection, safe CSV exports, fixed decision thresholds, and LLM boundary/failure behavior. Browser tests cover import, filtering, navigation, language switching, honest AI fallback, and mobile overflow.

Framework configuration follows the official [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation) and [Tailwind CSS PostCSS setup](https://tailwindcss.com/docs/installation/framework-guides/nextjs).

## Cloudflare deployment

Production: https://tiagomf.com/pipeline

The original Next.js development commands remain available. Cloudflare uses the separate vinext/Vite build, with a `/pipeline` base path and a dedicated `pipeline-pulse` Worker. Only `/pipeline` and `/pipeline/*` routes belong to this Worker; the portfolio homepage remains with its existing Worker.

Use Node.js 22.12 or newer (the initial deployment used Node 24). Run `npm run deploy:cloudflare` with Wrangler authenticated to the configured account. `npm run build:cloudflare` builds without publishing; `npx wrangler deploy --dry-run` checks packaging. The generated Wrangler config is under `dist/server` and should not be edited manually.

Run `node scripts/deployment-smoke.mjs https://tiagomf.com` to verify the live empty state, imports, metrics, language toggle, assets and API routing using small synthetic records. The explanation service remains optional and requires `LLM_EXPLANATION_URL` and, if needed, a secret `LLM_EXPLANATION_TOKEN`; no external AI service is configured by this deployment.
