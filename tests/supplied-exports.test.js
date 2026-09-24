import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { analyze } from '../lib/pipeline.js';

const ads = readFileSync(new URL('./fixtures/media-spend.csv', import.meta.url), 'utf8');
const crm = readFileSync(new URL('./fixtures/crm-sales.csv', import.meta.url), 'utf8');
const model = analyze(ads, crm);
const reorder = text => { const [header, ...rows] = Papa.parse(text, { skipEmptyLines: true }).data; return Papa.unparse([header, ...rows.reverse()]); };

test('supplied exports detect amounts, different date conventions, and ID-less CRM automatically', () => {
  assert.equal(model.detection.ads.columns.spend, 'Total_Spend');
  assert.equal(model.detection.crm.columns.revenue, 'Revenue_Generated');
  assert.equal(model.detection.crm.columns.id, undefined);
  assert.deepEqual(model.dateRange, ['2026-03-01', '2026-06-28']);
  assert.equal(model.stats.raw, 700);
  assert.equal(model.stats.acceptedAds, 334);
  assert.equal(model.stats.acceptedCrm, 350);
  assert.equal(model.stats.duplicates, 10);
  assert.equal(model.stats.quarantined, 6);
  assert.equal(model.totals.spend, 185176.50);
  assert.equal(model.totals.revenue, 6156480);
  assert.equal(model.totals.closed, 240);
  assert.equal(model.totals.cac, 185176.50 / 240);
  assert.equal(model.totals.roas, 6156480 / 185176.50);
});

test('unmatched campaigns remain excluded and zero pipeline is traceable to source coverage', () => {
  assert.equal(model.stats.matched, 295);
  assert.equal(model.stats.unmatched, 55);
  assert.equal(model.totals.open, 55);
  const open = model.canonical.crm.filter(row => row.status === 'open');
  assert.ok(open.length > 0);
  assert.ok(open.every(row => row.amount === 0));
  assert.equal(model.totals.pipeline, 0);
  assert.ok(model.campaigns.every(row => row.decision === 'Review data'));
  assert.equal(model.stats.raw, model.stats.acceptedAds + model.stats.acceptedCrm + model.stats.duplicates + model.stats.quarantined);
});

test('shuffling supplied exports cannot change attribution or KPIs', () => {
  const reversed = analyze(reorder(ads), reorder(crm));
  assert.deepEqual(reversed.totals, model.totals);
  assert.deepEqual(reversed.stats, model.stats);
  assert.deepEqual(reversed.campaigns, model.campaigns);
});

test('repeating every supplied row cannot inflate KPIs', () => {
  const repeat = text => { const [header, ...rows] = Papa.parse(text, { skipEmptyLines: true }).data; return Papa.unparse([header, ...rows, ...rows]); };
  const doubled = analyze(repeat(ads), repeat(crm));
  assert.deepEqual(doubled.totals, model.totals);
  assert.equal(doubled.stats.acceptedAds, 334);
  assert.equal(doubled.stats.acceptedCrm, 350);
  assert.equal(doubled.stats.matched, 295);
  assert.equal(doubled.stats.duplicates, 704);
  assert.equal(doubled.stats.quarantined, 12);
});

test('formula injection into supplied CRM is quarantined without affecting KPIs', () => {
  const attacked = analyze(ads, crm.trimEnd() + '\n08-03-2026,=1+1,Closed Won,999999');
  assert.deepEqual(attacked.totals, model.totals);
  assert.equal(attacked.stats.quarantined, model.stats.quarantined + 1);
  assert.ok(attacked.issues.some(row => /formula/.test(row.reason)));
});
