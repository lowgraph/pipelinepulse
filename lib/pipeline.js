import Papa from 'papaparse';

export const STAGES = ['Schema validation', 'Normalization', 'Deduplication', 'Campaign reconciliation', 'Canonical dataset', 'Data-quality evaluation', 'Deterministic KPIs', 'Decision classification', 'Dashboard model', 'Explanation only'];
export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 25000;
import { key, label, DataError, parseCSV, money, dateValue, statusValue, currencyHint, inferDateOrder, CURRENCIES, inspectCSV, resolveMappings } from './import-format.js';
export { DataError, parseCSV, money, inspectHeaders, inspectCSV, decodeCSV, resolveMappings } from './import-format.js';

// Preserve every token (including years, regions and audience sizes); only normalize
// word order, separators, camel case and a small set of equivalent word forms.
function campaignTokens(name) {
  return String(name).normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
    .replace(/(\d)\s*(?:%|pct\b|percent\b)/g, '$1 percent')
    .match(/[\p{L}\p{N}]+/gu)?.map(token => ({ abandoners: 'abandon', abandoner: 'abandon', abandoned: 'abandon' }[token] || token)).sort().join('|') || '';
}

function normalize(parsed, kind, options) {
  const issues = []; const valid = []; let duplicates = 0;
  const signatures = new Set();
  const dateOrder = options[`${kind}DateOrder`] || options.dateOrder || 'auto';
  const inferredOrder = dateOrder === 'auto' ? inferDateOrder(parsed.rows.map(row => label(row[parsed.columns.date]))) : dateOrder;
  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i]; const line = parsed.headerLine + i + 1;
    const get = field => label(row[parsed.columns[field]]);
    const fail = reason => issues.push({ source: kind, line, reason });
    if (row.length !== parsed.headers.length) { fail('Column count does not match the header.'); continue; }
    if (row.every((cell, n) => key(cell) === key(parsed.headers[n]))) { fail('Repeated header row excluded.'); continue; }
    if (row.some(cell => String(cell).length > 2000)) { fail('A cell exceeds the 2,000 character limit.'); continue; }
    if (row.some(cell => /^[=+@]|^-(?!\d)/.test(label(cell)))) { fail('Spreadsheet formula or executable cell rejected.'); continue; }
    const campaign = get('campaign'), campaignId = get('campaignId');
    if (!key(campaign) && !campaignId) { fail('Missing or invalid campaign reference.'); continue; }
    const amountField = kind === 'ads' ? 'spend' : 'revenue';
    const micros = /micros$/i.test(key(parsed.headers[parsed.columns[amountField]]));
    const rawAmount = get(amountField);
    const amount = micros ? (/^\d+$/.test(rawAmount) && Number.isSafeInteger(Number(rawAmount)) && Number(rawAmount) <= 1e16 ? Math.round(Number(rawAmount) / 10000) : null) : money(rawAmount, options.decimal);
    if (amount === null && (kind === 'ads' || rawAmount !== '')) { fail('Amount is missing, negative, ambiguous, or invalid for the selected number format.'); continue; }
    const amountHeader = parsed.headers[parsed.columns[kind === 'ads' ? 'spend' : 'revenue']];
    const headerCurrency = currencyHint(amountHeader);
    const currency = get('currency').toUpperCase() || headerCurrency || currencyHint(rawAmount) || options.currency;
    const amountRaw = get(kind === 'ads' ? 'spend' : 'revenue');
    const symbolCurrency = currencyHint(amountRaw);
    if (currency !== options.currency || (headerCurrency && headerCurrency !== currency) || (symbolCurrency && symbolCurrency !== currency) || (/^\$/.test(amountRaw) && !['USD', 'CAD', 'AUD'].includes(currency))) { fail(`Currency differs from ${options.currency}; no exchange rate is assumed.`); continue; }
    const date = dateValue(get('date'), inferredOrder);
    if (date === false) { fail('Invalid or ambiguous date. Choose day/month or month/day in detection settings.'); continue; }
    const id = kind === 'crm' ? get('id') : get('adId');
    const override = options.statusMapping?.[get('status')];
    const status = kind === 'crm' ? (['won', 'lost', 'open'].includes(override) ? override : statusValue(get('status'))) : null;
    if (kind === 'crm' && !status) { fail('Unknown or ambiguous CRM stage; use a supported stage.'); continue; }
    // Include all source dimensions so distinct ad/day/device rows are never collapsed.
    const normalizedValues = { campaign: key(campaign), campaignId, spend: amount, revenue: amount, currency, date, id, adId: id, status };
    const normalizedRow = row.map(label);
    for (const [field, column] of Object.entries(parsed.columns)) normalizedRow[column] = normalizedValues[field];
    const signature = JSON.stringify(parsed.headers.map((h, n) => [key(h), normalizedRow[n]]).sort((a, b) => a[0].localeCompare(b[0])));
    if (signatures.has(signature)) { duplicates++; continue; }
    signatures.add(signature);
    valid.push({ kind, line, campaign, campaignId, nameKey: key(campaign), amount, currency, date, id, status, signature });
  }
  if (kind === 'crm') {
    const groups = new Map();
    for (const row of valid) {
      // The full normalized row is the fallback identity, never a fabricated customer ID.
      // Namespace real IDs to avoid collisions with row fingerprints.
      const identity = JSON.stringify(row.id ? ['id', row.id] : ['row', row.signature]);
      const group = groups.get(identity) || []; group.push(row); groups.set(identity, group);
    }
    const clean = [];
    for (const group of groups.values()) {
      const versions = new Set(group.map(r => JSON.stringify([r.campaignId, r.nameKey, r.amount, r.currency, r.status, r.date])));
      if (versions.size > 1) group.forEach(r => issues.push({ source: kind, line: r.line, reason: 'Conflicting versions of the same CRM record; all versions quarantined.' }));
      else { clean.push(group[0]); duplicates += group.length - 1; }
    }
    return { valid: clean, issues, duplicates };
  }
  return { valid, issues, duplicates };
}
const divide = (a, b) => a !== null && b > 0 ? a / b : null;
export function classify({ spend, closed, roas, unmatched = 0 }) {
  if (unmatched) return 'Review data';
  if (spend === 0 || closed < 3 || roas === null) return 'Gather data';
  if (roas >= 3) return 'Scale';
  if (roas >= 1) return 'Maintain';
  return 'Optimize';
}

export function analyze(adsText, crmText, settings = {}) {
  const options = { currency: 'auto', decimal: 'auto', ...resolveMappings(adsText, crmText, settings) };
  if (![...CURRENCIES, 'auto'].includes(options.currency) || !['.', ',', 'auto'].includes(options.decimal)) throw new DataError('Unsupported currency or number format.');
  const adsParsed = parseCSV(adsText, 'ads', options.adsMapping);
  const crmParsed = parseCSV(crmText, 'crm', options.crmMapping);
  const detection = { ads: inspectCSV(adsText, 'ads', options.adsMapping), crm: inspectCSV(crmText, 'crm', options.crmMapping) };
  const detectedCurrencies = [...new Set([...detection.ads.currencies, ...detection.crm.currencies])];
  if (options.currency === 'auto') {
    if (detectedCurrencies.length > 1) throw new DataError(`Multiple currencies detected (${detectedCurrencies.join(', ')}). Select a reporting currency; other currencies will be quarantined, not converted.`);
    options.currency = detectedCurrencies[0] || 'USD';
    if (!CURRENCIES.includes(options.currency)) throw new DataError('Unsupported detected currency. Choose a supported reporting currency.');
  }
  const ads = normalize(adsParsed, 'ads', options); const crm = normalize(crmParsed, 'crm', options);
  const campaigns = new Map(); const names = new Map(); const idsByName = new Map();
  for (const row of ads.valid) if (row.campaignId && row.nameKey) {
    const ids = idsByName.get(row.nameKey) || new Set(); ids.add(row.campaignId); idsByName.set(row.nameKey, ids);
  }
  for (const row of ads.valid) {
    const candidates = idsByName.get(row.nameKey);
    const id = row.campaignId || (candidates?.size === 1 ? [...candidates][0] : null);
    const identity = id ? `id:${id}` : `name:${row.nameKey}`;
    const campaign = campaigns.get(identity) || { id: identity, name: row.campaign || row.campaignId, spendCents: 0, revenueCents: 0, pipelineCents: 0, missingWonAmounts: 0, missingOpenAmounts: 0, closed: 0, open: 0, leads: 0, adRows: 0 };
    campaign.spendCents += row.amount; campaign.adRows++;
    if (row.campaign && row.campaign.localeCompare(campaign.name) < 0) campaign.name = row.campaign;
    campaigns.set(identity, campaign);
    if (row.nameKey) { const matches = names.get(row.nameKey) || new Set(); matches.add(identity); names.set(row.nameKey, matches); }
  }
  const tokenNames = new Map();
  for (const row of ads.valid) {
    const token = campaignTokens(row.campaign);
    const identities = names.get(row.nameKey);
    if (!token || !identities) continue;
    const matches = tokenNames.get(token) || new Set();
    for (const identity of identities) matches.add(identity);
    tokenNames.set(token, matches);
  }
  const unmatched = []; const matched = [];
  for (const row of crm.valid) {
    let identity = row.campaignId ? `id:${row.campaignId}` : null;
    let candidates = names.get(row.nameKey);
    let matchMethod = row.campaignId ? 'campaign ID' : 'normalized name';
    if (!identity && !candidates?.size) { candidates = tokenNames.get(campaignTokens(row.campaign)); matchMethod = 'equivalent name tokens'; }
    if (!identity && candidates?.size === 1) identity = [...candidates][0];
    const campaign = campaigns.get(identity);
    if (!campaign) { unmatched.push({ ...row, reason: candidates?.size > 1 ? 'Ambiguous campaign name' : 'No matching ad campaign' }); continue; }
    campaign.leads++;
    if (row.status === 'won') { campaign.closed++; if (row.amount === null) campaign.missingWonAmounts++; else campaign.revenueCents += row.amount; }
    if (row.status === 'open') { campaign.open++; if (row.amount === null) campaign.missingOpenAmounts++; else campaign.pipelineCents += row.amount; }
    matched.push({ ...row, matchedCampaign: identity, matchMethod });
  }
  const issues = [...ads.issues, ...crm.issues];
  const rows = [...campaigns.values()].map(c => {
    const revenue = crmParsed.columns.revenue === undefined || c.missingWonAmounts ? null : c.revenueCents / 100;
    const pipeline = !c.open || crmParsed.columns.revenue === undefined || c.missingOpenAmounts ? null : c.pipelineCents / 100;
    const row = { ...c, spend: c.spendCents / 100, revenue, pipeline, cac: divide(c.spendCents / 100, c.closed), roas: divide(revenue, c.spendCents / 100) };
    return { ...row, decision: classify({ ...row, unmatched: unmatched.length + issues.length }) };
  }).sort((a, b) => b.spend - a.spend || a.id.localeCompare(b.id));
  const sum = field => rows.reduce((total, row) => {
    const result = total + row[field];
    if (!Number.isSafeInteger(result)) throw new DataError('Dataset totals exceed the supported precision. Split the export into smaller reporting periods.');
    return result;
  }, 0);
  const spend = sum('spendCents') / 100, closed = sum('closed');
  const revenue = crmParsed.columns.revenue === undefined || rows.some(c => c.revenue === null) ? null : sum('revenueCents') / 100;
  const open = sum('open');
  const pipeline = !open || crmParsed.columns.revenue === undefined || rows.some(c => c.open && c.pipeline === null) ? null : sum('pipelineCents') / 100;
  const raw = adsParsed.rows.length + crmParsed.rows.length;
  const duplicates = ads.duplicates + crm.duplicates;
  const adDates = ads.valid.map(r => r.date).filter(Boolean).sort();
  const missingDates = ads.valid.filter(r => !r.date).length;
  const warnings = [];
  const withoutId = crm.valid.filter(row => !row.id).length;
  if (withoutId) warnings.push(`${withoutId} accepted CRM rows have no record ID. Identical normalized rows are deduplicated; different rows cannot be linked to the same person or deal. CAC counts distinct accepted closed-won rows.`);
  if (crmParsed.columns.revenue === undefined) warnings.push('No revenue column detected. Revenue, ROAS, and pipeline value are unavailable. Match counts, closed-won counts, and CAC remain available. Map an amount column in detection settings if one exists.');
  else if (rows.some(c => c.missingWonAmounts || c.missingOpenAmounts)) warnings.push('Some matched CRM amounts are blank. Affected revenue, ROAS, or pipeline totals are unavailable rather than treating missing values as zero.');
  const tokenMatched = matched.filter(row => row.matchMethod === 'equivalent name tokens').length;
  if (tokenMatched) warnings.push(`${tokenMatched} CRM records matched by equivalent campaign words. Word order, camel case, percent notation and abandon/abandoner variants were normalized; years, regions and audience sizes were preserved.`);
  if (!open) warnings.push('No matched open opportunities. Pipeline value is unavailable, not zero.');
  if (missingDates) warnings.push(`${missingDates} ad rows have no date. This is an all-time snapshot, not a period comparison.`);
  if (unmatched.length) warnings.push(`${unmatched.length} CRM records are unmatched and excluded from attributed revenue, pipeline, CAC, and ROAS.`);
  if (issues.length) warnings.push(`${issues.length} rows were quarantined. Resolve them before acting on campaign recommendations.`);
  if (adsParsed.columns.currency === undefined || crmParsed.columns.currency === undefined) warnings.push(`Rows without a currency column are assumed to be ${options.currency}.`);
  if (adsParsed.skipped + crmParsed.skipped) warnings.push('Export preamble lines were skipped before the detected headers.');
  if (!ads.valid.length || !crm.valid.length) warnings.push('One or both sources have no accepted records. Attributed KPIs are incomplete.');
  return {
    version: 1, currency: options.currency,
    totals: { spend, revenue, pipeline, closed, open, cac: divide(spend, closed), roas: divide(revenue, spend) }, campaigns: rows,
    stats: { raw, adRows: adsParsed.rows.length, crmRows: crmParsed.rows.length, acceptedAds: ads.valid.length, acceptedCrm: crm.valid.length, duplicates, quarantined: issues.length, matched: matched.length, unmatched: unmatched.length, matchRate: divide(matched.length * 100, crm.valid.length), quality: divide((raw - duplicates - issues.length - unmatched.length) * 100, raw), campaigns: rows.length },
    dateRange: adDates.length ? [adDates[0], adDates.at(-1)] : null,
    issues, unmatched, warnings, canonical: { ads: ads.valid, crm: matched },
    schema: { ads: adsParsed.headers, crm: crmParsed.headers }, detection, stages: STAGES,
  };
}

export function explanationFacts(model) {
  // No raw rows, campaign names, emails, IDs, or imported free text cross the LLM boundary.
  return { currency: model.currency, totals: model.totals, stats: model.stats, decisions: model.campaigns.map((c, i) => ({ campaign: i + 1, spend: c.spend, revenue: c.revenue, roas: c.roas, closed: c.closed, decision: c.decision })) };
}

export function exportCanonical(model) {
  const safe = value => /^[=+\-@\t\r]/.test(String(value)) ? `'${value}` : value;
  return Papa.unparse(model.campaigns.map(c => ({ campaign_id: safe(c.id), campaign: safe(c.name), currency: model.currency, spend: c.spend, closed_won_revenue: c.revenue, open_pipeline: c.pipeline, closed_won_records: c.closed, CAC: c.cac ?? '', ROAS: c.roas ?? '', decision: c.decision })));
}

