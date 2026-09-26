import test from 'node:test';
import assert from 'node:assert/strict';
import Papa from 'papaparse';
import { sampleFiles } from '../lib/sample-data.js';
import { analyze, parseCSV, decodeCSV } from '../lib/pipeline.js';

const files = sampleFiles();
const model = analyze(files.ads, files.crm);

test('sample generation is repeatable and detector resolves both CSVs without overrides', () => {
  assert.deepEqual(sampleFiles(), files);
  for (const kind of ['ads', 'crm']) {
    const decoded = decodeCSV(new TextEncoder().encode(files[kind]).buffer);
    assert.equal(decoded.text, files[kind]);
    assert.ok(parseCSV(decoded.text, kind).rows.length);
    const detection = model.detection[kind];
    assert.deepEqual(detection.missing, []);
    assert.deepEqual(detection.ambiguous, []);
    assert.deepEqual(detection.unknownStages, []);
    assert.equal(detection.ambiguousDates, 0);
    assert.deepEqual(detection.currencies, ['USD']);
  }
  assert.equal(model.detection.ads.dateOrder, 'mdy');
  assert.equal(model.detection.crm.dateOrder, 'dmy');
  assert.deepEqual(model.dateRange, ['2026-09-01', '2026-09-24']);
  for (const kind of ['ads', 'crm']) {
    const parsed = parseCSV(files[kind], kind);
    for (const row of model.canonical[kind]) {
      const raw = parsed.rows[row.line - parsed.headerLine - 1][parsed.columns.date];
      const d = kind === 'ads' ? raw.split('/')[1] : raw.split('-')[0];
      assert.equal(row.date, `2026-09-${d}`);
    }
  }
});

test('sample totals, counts, duplicates, attribution and ratios are stable', () => {
  assert.deepEqual(model.stats, {
    raw: 374, adRows: 172, crmRows: 202, acceptedAds: 168, acceptedCrm: 196,
    duplicates: 10, quarantined: 0, matched: 192, unmatched: 4,
    matchRate: 192 * 100 / 196, quality: 360 * 100 / 374, campaigns: 7,
  });
  assert.deepEqual(model.totals, {
    spend: 32264.25, revenue: 87400, pipeline: 114925, closed: 52, open: 78,
    cac: 32264.25 / 52, roas: 87400 / 32264.25,
  });
  assert.equal(model.campaigns.reduce((sum, c) => sum + c.spendCents, 0), 3226425);
  assert.equal(model.campaigns.reduce((sum, c) => sum + c.revenueCents, 0), 8740000);
  assert.equal(model.campaigns.reduce((sum, c) => sum + c.pipelineCents, 0), 11492500);
  const ads = parseCSV(files.ads, 'ads'), crm = parseCSV(files.crm, 'crm');
  assert.equal(ads.rows.length - model.stats.acceptedAds, 4);
  assert.equal(crm.rows.length - model.stats.acceptedCrm, 6);
  assert.ok(crm.rows.some(row => row[crm.columns.revenue] === '' && row[crm.columns.status] === 'Closed Lost'));
});

test('sample preserves ID precedence and demonstrates both name matching rules', () => {
  const retargeting = model.canonical.crm.filter(r => r.id.startsWith('sample-deal-retarget-'));
  assert.equal(retargeting.length, 30);
  for (const row of retargeting) {
    assert.equal(row.campaign, 'Retargeting_CartAbandon');
    assert.equal(row.campaignId, '');
    assert.equal(row.matchMethod, 'equivalent name tokens');
    assert.equal(row.matchedCampaign, 'id:sample-campaign-retarget');
  }
  assert.equal(model.canonical.crm.filter(r => r.matchMethod === 'normalized name').length, 4);
  assert.equal(model.canonical.crm.filter(r => r.matchMethod === 'campaign ID').length, 158);
  for (const row of model.canonical.crm.filter(r => r.campaignId)) {
    assert.equal(row.matchMethod, 'campaign ID');
    assert.equal(row.matchedCampaign, `id:${row.campaignId}`);
  }
  assert.deepEqual(model.unmatched.map(r => r.id).sort(), ['sample-review-1', 'sample-review-2', 'sample-review-3', 'sample-review-4']);
  assert.ok(model.unmatched.find(r => r.id === 'sample-review-3').campaignId);
  assert.ok(model.unmatched.find(r => r.id === 'sample-review-4').campaignId);
  assert.equal(model.issues.length, 0);
  assert.ok(model.warnings.some(w => w.startsWith('4 CRM records are unmatched')));
  assert.ok(model.warnings.some(w => w.startsWith('30 CRM records matched')));
});

test('sample respects global review; resolving only its attribution gaps reveals varied rule outcomes', () => {
  assert.deepEqual([...new Set(model.campaigns.map(c => c.decision))], ['Review data']);
  const parsed = parseCSV(files.crm, 'crm');
  const resolved = Papa.unparse({ fields: parsed.headers, data: parsed.rows.filter(row => !row[parsed.columns.id].startsWith('sample-review-')) });
  const clean = analyze(files.ads, resolved);
  assert.deepEqual(clean.totals, model.totals);
  assert.deepEqual(Object.fromEntries(clean.campaigns.map(c => [c.name, c.decision])), {
    'LinkedIn ABM - Enterprise': 'Maintain', 'Prospecting Lookalike': 'Optimize',
    'Summer Promo': 'Maintain', 'Q3 Brand Search': 'Scale',
    'Retargeting - Cart Abandoners': 'Scale', 'Webinar - Data Leaders': 'Gather data',
    'Always On - Awareness': 'Gather data',
  });
});

test('sample replay cannot inflate KPIs and source order cannot change results', () => {
  const transform = (text, kind, repeat) => {
    const { headers, rows } = parseCSV(text, kind);
    return Papa.unparse({ fields: headers, data: repeat ? [...rows, ...rows] : [...rows].reverse() });
  };
  for (const repeat of [false, true]) {
    const result = analyze(transform(files.ads, 'ads', repeat), transform(files.crm, 'crm', repeat));
    assert.deepEqual(result.totals, model.totals);
    assert.equal(result.stats.matched, 192);
    assert.equal(result.stats.unmatched, 4);
  }
});
