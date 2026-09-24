import Papa from 'papaparse';

export const key = value => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export const label = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
export const CURRENCIES = ['USD', 'BRL', 'EUR', 'GBP', 'CAD', 'AUD'];
export const aliases = {
  campaignId: ['campaign id', 'utm campaign id', 'utm id', 'id campanha', 'id da campanha', 'identificador da campanha', 'id de campana'],
  campaign: ['campaign', 'campaign name', 'ad campaign', 'marketing campaign', 'utm campaign', 'primary campaign source', 'primary campaign source name', 'campaign source', 'original source drill-down 2', 'campanha', 'nome da campanha', 'nome campanha', 'campana', 'nombre de campana', 'campaign label'],
  spend: ['spend', 'cost', 'amount spent', 'total cost', 'ad spend', 'total ad spend', 'spend amount', 'spent amount', 'cost amount', 'advertising cost', 'advertising spend', 'total spend', 'media spend', 'media cost', 'spending', 'spent', 'cost micros', 'spend micros', 'custo', 'custo total', 'valor gasto', 'valor usado', 'valor investido', 'gasto', 'gastos', 'importe gastado', 'costo', 'inversion'],
  date: ['date', 'day', 'reporting starts', 'reporting start', 'date start', 'start date', 'close date', 'closedate', 'created date', 'create date', 'data', 'dia', 'inicio dos relatorios', 'data de fechamento', 'fecha', 'fecha de cierre'],
  id: ['opportunity id', 'deal id', 'record id', 'lead id', 'contact id', 'hs object id', 'id', 'email', 'email address', 'e-mail', 'id do negocio', 'id negocio', 'id do registro', 'id da oportunidade', 'id de oportunidad'],
  adId: ['ad id', 'id do anuncio', 'id anuncio'],
  status: ['stage', 'status', 'deal stage', 'stage name', 'lead status', 'opportunity stage', 'opportunity status', 'deal status', 'hs deal stage', 'etapa', 'fase', 'estagio', 'etapa do negocio', 'fase da oportunidade', 'situacao', 'estado'],
  revenue: ['revenue', 'amount', 'deal amount', 'total revenue', 'opportunity amount', 'deal value', 'value', 'sales revenue', 'closed won revenue', 'sale value', 'sales value', 'sale amount', 'sales amount', 'purchase value', 'conversion value', 'revenue generated', 'generated revenue', 'total contract value', 'contract value', 'deal size', 'receita', 'receita total', 'faturamento', 'valor', 'valor da venda', 'valor do negocio', 'valor da oportunidade', 'importe', 'ingresos'],
  currency: ['currency', 'currency code', 'account currency', 'currency iso code', 'deal currency code', 'moeda', 'codigo da moeda', 'divisa', 'moneda'],
};
export class DataError extends Error { constructor(message) { super(message); this.name = 'DataError'; } }
const headerKey = value => key(String(value).replace(/(?:R\$|US\$|CA\$|AU\$|[$€£])/gi, '')).replace(/(?:usd|brl|eur|gbp|cad|aud)$/, '').replace(/^(?:googleads|metaads|facebookads|salesforce|hubspot)/, '').replace(/(?:googleads|metaads|facebookads|salesforce|hubspot)$/, '');

export function mapColumns(headers, mapping = {}, rows = [], kind = '') {
  const columns = {}; const ambiguous = []; const inferred = {};
  for (const [field, names] of Object.entries(aliases)) {
    if (mapping[field]) {
      const index = headers.indexOf(mapping[field]);
      if (index < 0) throw new DataError(`Mapped column ${mapping[field]} is missing.`);
      columns[field] = index; continue;
    }
    for (const name of names) {
      const candidates = headers.flatMap((h, i) => headerKey(h) === key(name) ? [i] : []);
      if (candidates.length > 1) { ambiguous.push(field); break; }
      if (candidates.length === 1) { columns[field] = candidates[0]; break; }
    }
  }
  const patterns = {
    campaignId: /(?:campaign|campanha|campana)(?:id|identifier|key)$/,
    campaign: /(?:campaign|campanha|campana)(?:name|title|label)?$/,
    spend: /(?:spend|spent|cost)(?:amount|value|total)?$/,
    revenue: /(?:revenue|sales?amount|sales?value|purchasevalue|contractvalue|dealvalue|bookingvalue|totalvalue|amount)$|^revenue(?:generated|total|amount|value)$/,
    id: /(?:^(?:id|email)$|(?:lead|contact|customer|client|record|deal|opportunity|person|object)(?:id|identifier|key)$|(?:contact|customer|client|lead)email(?:address)?$)/,
    status: /(?:stage|status|phase|outcome)$/,
    date: /(?:date|timestamp)$/,
  };
  for (const [field, pattern] of Object.entries(patterns)) {
    if (columns[field] !== undefined || ambiguous.includes(field)) continue;
    const matches = headers.flatMap((h, i) => pattern.test(headerKey(h)) && !Object.values(columns).includes(i) && !/perclick|perlead|perresult|average|avg|weighted|probability/.test(headerKey(h)) ? [i] : []);
    if (matches.length === 1) { columns[field] = matches[0]; inferred[field] = 'Header meaning'; }
    else if (matches.length > 1) ambiguous.push(field);
  }
  if (rows.length && kind) {
    const profiles = headers.map((_, column) => rows.slice(0, 1000).map(row => label(row[column])).filter(Boolean));
    const infer = (field, predicate) => {
      if (columns[field] !== undefined || ambiguous.includes(field)) return;
      const candidates = profiles.flatMap((values, i) => values.length && !Object.values(columns).includes(i) && predicate(values, headers[i]) ? [i] : []);
      if (candidates.length === 1) { columns[field] = candidates[0]; inferred[field] = 'Column values'; }
    };
    if (kind === 'crm') {
      infer('status', values => values.every(value => statusValue(value)));
      infer('id', values => values.every(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)));
    }
    infer('date', values => values.every(value => /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(value) && dateValue(value) !== false));
    const field = kind === 'ads' ? 'spend' : 'revenue';
    // Prefer strong monetary evidence. Counts/ratios/budgets are never treated as spending.
    const excluded = header => /click|impression|lead|count|conversion|budget|rate|ratio|percent|cpc|cpm|ctr|roas|cac|score|phone|zip|postal|probability|quantity|identifier|(?:^|record|customer|account|owner|row|user|transaction)id$/.test(headerKey(header));
    infer(field, (values, header) => !excluded(header) && values.every(value => money(value, 'auto') !== null) && values.some(value => currencyHint(value) || /[$€£]/.test(value)));
    // Amount detection is independent of record IDs. A sole remaining numeric
    // candidate can be inferred in ID-less tables; competing candidates stay unresolved.
    infer(field, (values, header) => !excluded(header) && values.every(value => money(value, 'auto') !== null));
  }
  return { columns, ambiguous, inferred };
}

export function detectTable(text, kind, mapping = {}) {
  if (typeof text !== 'string' || !text.trim()) throw new DataError('This file is empty. Choose a CSV with a header and data rows.');
  if (new TextEncoder().encode(text).length > 5 * 1024 * 1024) throw new DataError('Each file must be 5 MB or smaller.');
  const clean = text.replace(/^\uFEFF/, '');
  const sep = /^sep=([^\r\n])\s*(?:\r?\n|\r)/i.exec(clean);
  const content = sep ? clean.slice(sep[0].length) : clean;
  const delimiters = sep ? [sep[1]] : [',', ';', '\t', '|'];
  let best = null;
  for (const delimiter of delimiters) {
    const preview = Papa.parse(content, { delimiter, skipEmptyLines: 'greedy', preview: 80 });
    preview.data.forEach((row, index) => {
      if (row.length < 2 || row.length > 101) return;
      const { columns } = mapColumns(row.map(label));
      const match = Object.keys(columns).length;
      const hasMoney = columns[kind === 'crm' ? 'revenue' : 'spend'] !== undefined;
      const hasCampaign = columns.campaign !== undefined || columns.campaignId !== undefined;
      const mapped = Object.values(mapping).filter(Boolean).filter(h => row.map(label).includes(h)).length;
      const next = preview.data.slice(index + 1, index + 6);
      const consistency = next.filter(r => r.length === row.length).length;
      const score = match * 10 + (hasMoney ? 15 : 0) + (hasCampaign ? 15 : 0) + mapped * 20 + consistency - index * 0.01;
      if (!best || score > best.score) best = { delimiter, index, score };
    });
  }
  if (!best) throw new DataError('Could not find a delimited header. Use CSV, TSV, semicolon, or pipe-separated text.');
  const result = Papa.parse(content, { delimiter: best.delimiter, skipEmptyLines: 'greedy' });
  const fatal = result.errors.filter(e => e.type !== 'Delimiter' && (e.row === undefined || e.row >= best.index));
  if (fatal.length) throw new DataError(`CSV could not be read: ${fatal[0].message}`);
  let headers = result.data[best.index].map(label);
  let rows = result.data.slice(best.index + 1);
  // A trailing separator is common in hand-edited exports, but only remove a wholly empty column.
  while (headers.at(-1) === '' && rows.every(r => r.length === headers.length && label(r.at(-1)) === '')) { headers = headers.slice(0, -1); rows = rows.map(r => r.slice(0, -1)); }
  if (headers.some(h => !h) || new Set(headers.map(key)).size !== headers.length) throw new DataError('Headers must be nonempty and unique, including after normalization.');
  if (headers.length > 100) throw new DataError('A file can have at most 100 columns.');
  if (rows.length > 25000) throw new DataError('Each file can contain at most 25,000 rows.');
  const { columns, ambiguous, inferred } = mapColumns(headers, mapping, rows, kind);
  return { headers, columns, ambiguous, inferred, rows, delimiter: best.delimiter, headerLine: best.index + 1 + (sep ? 1 : 0), skipped: best.index + (sep ? 1 : 0) };
}

export function parseCSV(text, kind, mapping = {}) {
  const table = detectTable(text, kind, mapping);
  if (table.ambiguous.length) throw new DataError(`Ambiguous ${kind} columns: ${table.ambiguous.join(', ')}. Choose the correct columns in detection settings.`);
  const missing = (kind === 'ads' ? ['spend'] : ['status']).filter(f => table.columns[f] === undefined);
  if (table.columns.campaign === undefined && table.columns.campaignId === undefined) missing.push('campaign or campaign ID');
  if (missing.length) throw new DataError(`Missing ${kind} columns: ${missing.join(', ')}. Select the matching columns in detection settings.`);
  if (!table.rows.length) throw new DataError('The CSV contains headers but no data rows.');
  const used = Object.values(table.columns);
  // Same source column cannot be both an ID, amount, or campaign.
  if (new Set(used).size !== used.length) throw new DataError('Each mapped column must have a distinct meaning. Check detection settings.');
  return table;
}
export function inspectHeaders(text, kind = 'ads') { return detectTable(text, kind).headers; }

export function currencyHint(value) {
  const input = label(value);
  const code = /(?:^|[^a-z])(USD|BRL|EUR|GBP|CAD|AUD)(?=$|[^a-z])/i.exec(input)?.[1].toUpperCase();
  return code || (/R\$/i.test(input) ? 'BRL' : /€/.test(input) ? 'EUR' : /£/.test(input) ? 'GBP' : /US\$/.test(input) ? 'USD' : /CA\$|C\$/.test(input) ? 'CAD' : /AU\$|A\$/.test(input) ? 'AUD' : null);
}
function numericText(value) {
  return label(value).replace(/(?:USD|BRL|EUR|GBP|CAD|AUD|R\$|US\$|CA\$|AU\$|C\$|A\$|\$|€|£)/gi, '').trim();
}
export function money(value, decimal = '.') {
  let input = label(value);
  if (!input || /[=<>@]|^[+\-]|[()]/.test(input)) return null;
  // Currency affixes only: removing text from the middle must not invent a number.
  const affix = '(?:USD|BRL|EUR|GBP|CAD|AUD|R\\$|US\\$|CA\\$|AU\\$|C\\$|A\\$|\\$|€|£)';
  input = input.replace(new RegExp(`^${affix}\\s*`, 'i'), '').replace(new RegExp(`\\s*${affix}$`, 'i'), '').trim().replace(/[’']/g, ' ');
  if (decimal === 'auto') {
    const dot = input.lastIndexOf('.'), comma = input.lastIndexOf(',');
    if (dot >= 0 && comma >= 0) decimal = dot > comma ? '.' : ',';
    else {
      const mark = dot >= 0 ? '.' : comma >= 0 ? ',' : null;
      const places = mark ? input.length - input.lastIndexOf(mark) - 1 : 0;
      decimal = mark && places <= 2 ? mark : mark === '.' ? ',' : '.';
    }
  }
  const pattern = decimal === ',' ? /^(?:\d+|\d{1,3}(?:[. ]\d{3})+)(?:,\d{1,2})?$/ : /^(?:\d+|\d{1,3}(?:[, ]\d{3})+)(?:\.\d{1,2})?$/;
  if (!pattern.test(input)) return null;
  const normalized = decimal === ',' ? input.replace(/[. ]/g, '').replace(',', '.') : input.replace(/[, ]/g, '');
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents <= 1e12 ? cents : null;
}

function calendar(year, month, day) {
  if (year < 1900 || year > 2200) return false;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const time = new Date(iso + 'T00:00:00Z');
  return !Number.isNaN(time.valueOf()) && time.toISOString().slice(0, 10) === iso ? iso : false;
}
export function inferDateOrder(values) {
  const orders = new Set();
  for (const value of values) {
    const match = /^(\d{1,2})[/.\-](\d{1,2})[/.\-]\d{4}(?:\s|$)/.exec(label(value));
    if (match && +match[1] > 12 && +match[2] <= 12) orders.add('dmy');
    if (match && +match[2] > 12 && +match[1] <= 12) orders.add('mdy');
  }
  return orders.size === 1 ? [...orders][0] : 'auto';
}
export function dateValue(value, order = 'auto') {
  if (!value) return null;
  const time = /(?:T|\s)(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (time && (+time[1] > 23 || +time[2] > 59 || +(time[3] || 0) > 59)) return false;
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:(?:T|\s)\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(value);
  if (iso) return calendar(+iso[1], +iso[2], +iso[3]);
  const parts = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})(?:\s\d{2}:\d{2}(?::\d{2})?)?$/.exec(value);
  if (parts) {
    const a = +parts[1], b = +parts[2];
    const resolved = a > 12 ? 'dmy' : b > 12 ? 'mdy' : a === b ? 'dmy' : order;
    if (resolved === 'auto') return false;
    return calendar(+parts[3], resolved === 'dmy' ? b : a, resolved === 'dmy' ? a : b);
  }
  const months = { jan: 1, january: 1, janeiro: 1, feb: 2, february: 2, fev: 2, fevereiro: 2, mar: 3, march: 3, marco: 3, apr: 4, april: 4, abr: 4, abril: 4, may: 5, maio: 5, jun: 6, june: 6, junho: 6, jul: 7, july: 7, julho: 7, aug: 8, august: 8, ago: 8, agosto: 8, sep: 9, september: 9, set: 9, setembro: 9, oct: 10, october: 10, out: 10, outubro: 10, nov: 11, november: 11, novembro: 11, dec: 12, december: 12, dez: 12, dezembro: 12 };
  const words = value.replace(/,/g, '').replace(/\bde\b/g, '').trim().split(/[\s-]+/);
  if (words.length === 3) {
    if (months[key(words[0])]) return calendar(+words[2], months[key(words[0])], +words[1]);
    if (months[key(words[1])]) return calendar(+words[2], months[key(words[1])], +words[0]);
  }
  // Excel serial dates are accepted only in a detected/mapped date column.
  if (/^\d{5}(?:\.\d+)?$/.test(value)) { const days = Math.floor(Number(value)); return new Date(Date.UTC(1899, 11, 30) + days * 86400000).toISOString().slice(0, 10); }
  return false;
}

export function statusValue(value) {
  const status = key(value);
  if (['closedwon', 'won', 'customer', 'closedwon100', 'ganho', 'fechadoganho', 'negocioganho', 'vendarealizada', 'ganado', 'cerradoganado', 'convertido', 'converted'].includes(status) || /^closedwon\d+$/.test(status)) return 'won';
  if (['closedlost', 'lost', 'disqualified', 'unqualified', 'perdido', 'fechadoperdido', 'desqualificado', 'cerradoperdido'].includes(status)) return 'lost';
  if (['open', 'new', 'working', 'qualified', 'proposal', 'negotiation', 'prospecting', 'qualification', 'needsanalysis', 'valueproposition', 'perceptionanalysis', 'iddecisionmakers', 'proposalpricequote', 'negotiationreview', 'appointmentscheduled', 'qualifiedtobuy', 'presentationscheduled', 'decisionmakerboughtin', 'contractsent', 'lead', 'marketingqualifiedlead', 'salesqualifiedlead', 'opportunity', 'aberto', 'novo', 'qualificado', 'proposta', 'negociacao', 'prospeccao', 'oportunidade', 'emnegociacao', 'enegociacion'].includes(status)) return 'open';
  return null;
}

export function inspectCSV(text, kind, mapping = {}) {
  const table = detectTable(text, kind, mapping);
  const missing = (kind === 'ads' ? ['spend'] : ['status']).filter(f => table.columns[f] === undefined);
  if (table.columns.campaign === undefined && table.columns.campaignId === undefined) missing.push('campaign');
  const amounts = table.rows.map(row => row[table.columns[kind === 'ads' ? 'spend' : 'revenue']]);
  const currencies = new Set([currencyHint(table.headers[table.columns[kind === 'ads' ? 'spend' : 'revenue']])]);
  for (const row of table.rows) { currencies.add(label(row[table.columns.currency]).toUpperCase() || null); currencies.add(currencyHint(row[table.columns[kind === 'ads' ? 'spend' : 'revenue']])); }
  currencies.delete(null);
  const dates = table.rows.map(row => label(row[table.columns.date]));
  const dateOrder = inferDateOrder(dates);
  const stages = [...new Set(table.rows.map(row => label(row[table.columns.status])).filter(Boolean))];
  return { headers: table.headers, columns: Object.fromEntries(Object.entries(table.columns).map(([f, n]) => [f, table.headers[n]])), inferred: table.inferred, examples: Object.fromEntries(table.headers.map((h, i) => [h, table.rows.slice(0, 3).map(r => label(r[i]))])), missing, ambiguous: table.ambiguous, delimiter: { ',': 'Comma', ';': 'Semicolon', '\t': 'Tab', '|': 'Pipe' }[table.delimiter] || table.delimiter, rows: table.rows.length, skipped: table.skipped, currencies: [...currencies], dateOrder, ambiguousDates: dates.filter(v => v && dateValue(v, dateOrder) === false).length, unknownStages: kind === 'crm' ? stages.filter(s => !statusValue(s)) : [], numberFormat: amounts.some(a => /,\d{1,2}$/.test(numericText(a))) ? 'Decimal comma / auto' : 'Decimal point / auto' };
}

export function resolveMappings(adsText, crmText, settings = {}) {
  const resolved = { ...settings, adsMapping: { ...settings.adsMapping }, crmMapping: { ...settings.crmMapping } };
  let ads, crm;
  try { ads = detectTable(adsText, 'ads', resolved.adsMapping); crm = detectTable(crmText, 'crm', resolved.crmMapping); } catch { return resolved; }
  const candidates = table => {
    if (table.columns.campaign !== undefined) return [table.columns.campaign];
    if (table.columns.campaignId !== undefined || table.ambiguous.includes('campaign')) return [];
    return table.headers.flatMap((_, i) => {
      if (Object.values(table.columns).includes(i)) return [];
      const values = table.rows.slice(0, 1000).map(r => label(r[i])).filter(Boolean);
      return values.length && values.every(v => key(v) && money(v, 'auto') === null && !statusValue(v) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) ? [i] : [];
    });
  };
  const pairs = [];
  for (const a of candidates(ads)) for (const c of candidates(crm)) {
    const names = new Set(ads.rows.map(r => key(r[a])).filter(Boolean));
    const references = new Set(crm.rows.map(r => key(r[c])).filter(Boolean));
    const overlap = [...references].filter(v => names.has(v)).length;
    if (overlap >= Math.min(2, references.size) && overlap / references.size >= .8) pairs.push([a, c]);
  }
  // Only infer when exactly one pair explains the shared values. Never guess between pairs.
  if (pairs.length === 1) {
    if (ads.columns.campaign === undefined) resolved.adsMapping.campaign = ads.headers[pairs[0][0]];
    if (crm.columns.campaign === undefined) resolved.crmMapping.campaign = crm.headers[pairs[0][1]];
  }
  return resolved;
}

export function decodeCSV(buffer) {
  const bytes = new Uint8Array(buffer);
  let encoding = 'utf-8';
  if (bytes[0] === 255 && bytes[1] === 254) encoding = 'utf-16le';
  else if (bytes[0] === 254 && bytes[1] === 255) encoding = 'utf-16be';
  else {
    const sample = bytes.slice(0, 1000); let even = 0, odd = 0;
    sample.forEach((b, i) => { if (b === 0) i % 2 ? odd++ : even++; });
    if (odd > sample.length / 5) encoding = 'utf-16le';
    else if (even > sample.length / 5) encoding = 'utf-16be';
    else { try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding }; } catch { encoding = 'windows-1252'; } }
  }
  return { text: new TextDecoder(encoding).decode(bytes).replace(/^\uFEFF/, ''), encoding };
}
