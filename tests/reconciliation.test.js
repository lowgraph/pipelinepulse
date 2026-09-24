import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../lib/pipeline.js';

test('equivalent word order, camel case and percent notation match uniquely', () => {
  for (const [ad, crm] of [['LinkedIn ABM - Enterprise', 'ABM Enterprise LinkedIn'], ['Retargeting - Cart Abandoners', 'Retargeting_CartAbandon'], ['Prospecting_Lookalike_1pct', 'Prospecting Lookalike 1%']]) {
    const m = analyze(`Campaign,Spend\n${ad},100`, `Campaign,Stage,Amount\n${crm},Qualified,200`);
    assert.equal(m.stats.matched, 1);
    assert.equal(m.totals.pipeline, 200);
    assert.equal(m.canonical.crm[0].matchMethod, 'equivalent name tokens');
  }
});
test('ambiguous token matches and conflicting campaign IDs never guess', () => {
  const ads = 'Campaign ID,Campaign,Spend\n1,ABM Enterprise LinkedIn,100\n2,LinkedIn Enterprise ABM,200';
  assert.equal(analyze(ads, 'Campaign,Stage,Amount\nEnterprise ABM LinkedIn,Won,900').stats.unmatched, 1);
  assert.equal(analyze(ads, 'Campaign ID,Campaign,Stage,Amount\n3,ABM Enterprise LinkedIn,Won,900').stats.unmatched, 1);
});
test('years, regions and audience sizes remain significant', () => {
  for (const [ad, crm] of [['Summer Promo 2026', 'Promo Summer'], ['US Brand', 'Brand UK'], ['Lookalike 1pct', 'Lookalike 2%']]) {
    assert.equal(analyze(`Campaign,Spend\n${ad},100`, `Campaign,Stage,Amount\n${crm},Won,900`).stats.unmatched, 1);
  }
});
test('pipeline distinguishes no open records, missing values and explicit zero', () => {
  const ads = 'Campaign,Spend\nSearch,100\nOther,100';
  for (const [stage, amount, open, pipeline] of [['Won', '100', 0, null], ['Qualified', '', 1, null], ['Qualified', '0', 1, 0], ['Qualified', '200', 1, 200]]) {
    const m = analyze(ads, `Campaign,Stage,Amount\nSearch,${stage},${amount}`);
    assert.equal(m.totals.open, open);
    assert.equal(m.totals.pipeline, pipeline);
  }
});
