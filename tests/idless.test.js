import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, inspectCSV, exportCanonical, explanationFacts } from '../lib/pipeline.js';
const ads = 'Campaign,Cost\nSearch,100';

test('ID-less CRM detects an unfamiliar numeric revenue column without manual mapping', () => {
  const crm = 'Campaign,Stage,Booked cash,Name\nSearch,Won,500,Alice\nSearch,Won,700,Bob';
  const preview = inspectCSV(crm, 'crm');
  assert.deepEqual(preview.missing, []); assert.equal(preview.columns.revenue, 'Booked cash');
  const model = analyze(ads, crm);
  assert.equal(model.totals.revenue, 1200); assert.equal(model.totals.closed, 2); assert.equal(model.totals.cac, 50); assert.equal(model.totals.roas, 12);
});
test('ID-less rows deduplicate normalized contents while preserving distinct contacts', () => {
  const crm = 'Campaign,Stage,Amount,Name\nSearch,Won,500,Alice\nSearch,Closed Won,$500.00,Alice\nSearch,Won,500,Bob';
  const model = analyze(ads, crm);
  assert.equal(model.stats.duplicates, 1); assert.equal(model.stats.acceptedCrm, 2); assert.equal(model.stats.quarantined, 0); assert.equal(model.totals.revenue, 1000);
  assert.ok(model.warnings.some(w => /no record ID/.test(w)));
  const [header, ...rows] = crm.split('\n');
  assert.deepEqual(analyze(ads, [header, ...rows.reverse()].join('\n')).totals, model.totals);
});
test('partially blank IDs do not all group into one conflicting record', () => {
  const crm = 'Record ID,Campaign,Stage,Amount,Name\n,Search,Won,500,Alice\n,Search,Won,600,Bob\n1,Search,Won,700,Charlie\n1,Search,Won,700,Charlie';
  const model = analyze(ads, crm); assert.equal(model.stats.quarantined, 0); assert.equal(model.stats.duplicates, 1); assert.equal(model.totals.closed, 3); assert.equal(model.totals.revenue, 1800);
});
test('genuinely absent revenue remains unknown while ID-less counts and CAC work', () => {
  const model = analyze(ads, 'Campaign,Stage,Name\nSearch,Won,Alice\nSearch,Proposal,Bob');
  assert.equal(model.totals.revenue, null); assert.equal(model.totals.roas, null); assert.equal(model.totals.pipeline, null); assert.equal(model.totals.cac, 100);
  assert.equal(model.campaigns[0].decision, 'Gather data'); assert.equal(explanationFacts(model).totals.roas, null);
  assert.ok(!exportCanonical(model).includes('NaN'));
});
test('partially missing amounts never masquerade as zero or a complete total', () => {
  const model = analyze(ads, 'Campaign,Stage,Amount,Name\nSearch,Won,500,Alice\nSearch,Won,,Bob\nSearch,Proposal,300,Charlie');
  assert.equal(model.totals.closed, 2); assert.equal(model.totals.cac, 50); assert.equal(model.totals.revenue, null); assert.equal(model.totals.roas, null); assert.equal(model.totals.pipeline, 300);
});
test('competing numeric columns remain unresolved and can be mapped without an ID', () => {
  const crm = 'Campaign,Stage,Metric A,Metric B\nSearch,Won,500,900';
  assert.equal(inspectCSV(crm, 'crm').columns.revenue, undefined);
  assert.equal(analyze(ads, crm, { crmMapping: { revenue: 'Metric A' } }).totals.revenue, 500);
});
