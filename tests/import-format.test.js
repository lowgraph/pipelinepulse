import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, decodeCSV, inspectCSV, parseCSV, money, resolveMappings } from '../lib/pipeline.js';
import { dateValue, inferDateOrder } from '../lib/import-format.js';
const crm = 'Record ID,Campaign,Stage,Amount\n1,Search,Won,500';

test('spend detection handles punctuation, namespaces, currencies and alternative names', () => {
  for (const header of ['Ad Spend', 'Total Ad Spend', 'Spend Amount', 'cost_usd', 'Amount Spent (USD)', 'Google Ads: Cost', 'Meta Ads - Amount Spent', 'advertising_cost', 'Media Spend']) {
    const m = analyze(`Campaign,${header}\nSearch,100`, crm);
    assert.equal(m.totals.spend, 100, header);
  }
});
test('CRM detection supports scoped properties and identifier variants', () => {
  for (const headers of ['customer_identifier,marketing_campaign,deal_outcome,contract_value', 'properties.hs_object_id,properties.utm_campaign,properties.dealstage,properties.amount', 'contact_email,primary_campaign_source,opportunity_status,sales_revenue']) {
    const m = analyze('Campaign,Cost\nSearch,100', `${headers}\nuser@example.com,Search,Closed Won,300`);
    assert.equal(m.stats.matched, 1); assert.equal(m.totals.revenue, 300);
  }
});
test('Portuguese headers, number formatting, currency and stages work automatically', () => {
  const m = analyze('Nome da campanha;Valor gasto (BRL);Dia\nPesquisa;R$ 1.234,56;25/08/2026', 'ID do negócio;Campanha;Etapa do negócio;Valor do negócio;Moeda\n1;Pesquisa;Fechado ganho;2.500,00;BRL');
  assert.equal(m.currency, 'BRL'); assert.equal(m.totals.spend, 1234.56); assert.equal(m.totals.revenue, 2500); assert.equal(m.stats.quarantined, 0);
});
test('all supported delimiters survive preambles, blank lines and separator declarations', () => {
  for (const delimiter of [',', ';', '\t', '|']) {
    const text = `sep=${delimiter}\nAccount report\n\nCampaign${delimiter}Cost\nSearch${delimiter}100\n`;
    assert.equal(analyze(text, crm).totals.spend, 100);
  }
});
test('unknown header content inference finds email IDs, monetary values and CRM outcomes', () => {
  const m = analyze('Campaign,Cost\nSearch,100', 'a,b,c,d\nu@example.com,Search,Won,$500');
  assert.equal(m.totals.revenue, 500); assert.equal(m.stats.matched, 1);
});
test('unique campaign overlap resolves arbitrary labels across both files', () => {
  const a = 'Audience bucket,Ad spend\nSearch,100\nRetargeting,200';
  const c = 'Lead ID,Tracking bucket,Stage,Amount\n1,Search,Won,500\n2,Retargeting,Won,700';
  const settings = resolveMappings(a, c);
  assert.equal(settings.adsMapping.campaign, 'Audience bucket'); assert.equal(settings.crmMapping.campaign, 'Tracking bucket');
  assert.equal(analyze(a, c).stats.matched, 2);
});
test('equally plausible campaign and amount columns are not silently guessed', () => {
  const a = 'Bucket A,Bucket B,Cost\nSearch,Search,100';
  assert.throws(() => analyze(a, crm), /Missing ads columns/);
  assert.throws(() => analyze('Campaign,Metric A,Metric B\nSearch,100,200', crm), /Missing ads columns: spend/);
});
test('counts and budgets are excluded from numeric spend inference', () => {
  for (const field of ['Clicks', 'Impressions', 'Budget', 'Conversion Count']) assert.throws(() => analyze(`Campaign,${field}\nSearch,100`, crm), /Missing ads columns: spend/);
});
test('mixed US and European money values work in the same column', () => {
  const a = 'Campaign;Cost\nSearch;1,234.56\nSearch;1.234,56\nSearch;1 234,56\nSearch;1’234.56';
  const m = analyze(a, crm); assert.equal(m.totals.spend, 1234.56); assert.equal(m.stats.duplicates, 3);
  assert.equal(money('123,45 EUR', 'auto'), 12345); assert.equal(money('1.234', 'auto'), 123400);
  assert.equal(money('12USD34', 'auto'), null);
});
test('Google API micros normalize to currency units', () => {
  const m = analyze('Campaign,cost_micros\nSearch,1500000', crm); assert.equal(m.totals.spend, 1.5);
});
test('file evidence infers date order; ambiguous dates require a choice', () => {
  const a = 'Campaign,Cost,Date\nSearch,100,25/08/2026\nSearch,200,04/08/2026';
  assert.equal(analyze(a, crm).stats.quarantined, 0);
  assert.equal(inferDateOrder(['08/25/2026', '08/04/2026']), 'mdy');
  const ambiguous = 'Campaign,Cost,Date\nSearch,100,03/04/2026';
  assert.equal(analyze(ambiguous, crm).stats.quarantined, 1);
  assert.deepEqual(analyze(ambiguous, crm, { adsDateOrder: 'dmy' }).dateRange, ['2026-04-03', '2026-04-03']);
});
test('ISO timestamps, named months, Excel serials and invalid calendar dates', () => {
  for (const value of ['2026/08/25', '2026-08-25T14:30:00Z', 'Aug 25, 2026', '25 agosto 2026']) assert.equal(dateValue(value), '2026-08-25');
  assert.equal(dateValue('45000'), '2023-03-15'); assert.equal(dateValue('31/02/2026', 'dmy'), false);
  assert.equal(dateValue('2026-08-25T99:99:00Z'), false);
});
test('UTF-8, UTF-16 LE/BE and Windows-1252 exports decode', () => {
  const text = 'Campanha;Custo\nAnúncios;100';
  const utf8 = Buffer.from(text); assert.equal(decodeCSV(utf8).text, text);
  const le = Buffer.concat([Buffer.from([255, 254]), Buffer.from(text, 'utf16le')]); assert.equal(decodeCSV(le).text, text);
  const be = Buffer.from(le); be.swap16(); assert.equal(decodeCSV(be).text, text);
  const legacy = Buffer.from(text, 'latin1'); assert.equal(decodeCSV(legacy).text, text); assert.equal(decodeCSV(legacy).encoding, 'windows-1252');
});
test('blank trailing columns are removed, repeated headers do not inflate spend', () => {
  const a = 'Campaign,Cost,\nSearch,100,\nCampaign,Cost,\nSearch,200,';
  const m = analyze(a, crm); assert.equal(m.totals.spend, 300); assert.equal(m.stats.quarantined, 1);
});
test('custom stages are explicitly configurable, not assumed won', () => {
  const c = 'Record ID,Campaign,Stage,Amount\n1,Search,Success!,500';
  assert.equal(analyze('Campaign,Cost\nSearch,100', c).stats.quarantined, 1);
  assert.equal(analyze('Campaign,Cost\nSearch,100', c, { statusMapping: { 'Success!': 'won' } }).totals.revenue, 500);
});
test('detected previews expose column meanings, examples, and unresolved fields', () => {
  const preview = inspectCSV('Campaign,Ad Spend\nSearch,$100', 'ads');
  assert.equal(preview.columns.spend, 'Ad Spend'); assert.deepEqual(preview.examples['Ad Spend'], ['$100']); assert.deepEqual(preview.missing, []);
  assert.throws(() => parseCSV('Campaign,Cost (USD),Cost (BRL)\nSearch,100,200', 'ads'), /Ambiguous/);
});
