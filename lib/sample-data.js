import Papa from 'papaparse';

// Fictional daily media costs and deal records, not precomputed dashboard totals.
// Keep the seed, dates and record formulas stable: the production pipeline owns
// every match, aggregate and decision. The older demo.js remains a test fixture.
const campaigns = [
  ['brand', 'Q3 Brand Search', 19000, 14, 10, 6, 180000],
  ['summer', 'Summer Promo', 24500, 8, 12, 10, 110000],
  ['retarget', 'Retargeting - Cart Abandoners', 13000, 16, 8, 6, 150000],
  ['prospect', 'Prospecting Lookalike', 28500, 5, 12, 13, 45000],
  ['abm', 'LinkedIn ABM - Enterprise', 31000, 6, 14, 10, 240000],
  ['awareness', 'Always On - Awareness', 8000, 2, 10, 12, 35000],
  ['webinar', 'Webinar - Data Leaders', 10500, 1, 12, 5, 80000],
];
function shuffled(rows, seed) {
  const result = [...rows]; let state = seed;
  for (let i = result.length - 1; i > 0; i--) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    const j = (state >>> 0) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
const amount = cents => (cents / 100).toFixed(2);
const day = value => String(value).padStart(2, '0');

export function sampleFiles() {
  const ads = []; const crm = [];
  campaigns.forEach(([slug, name, dailyCents, won, open, lost, dealCents], index) => {
    const campaignId = `sample-campaign-${slug}`;
    for (let d = 1; d <= 24; d++) {
      ads.push([campaignId, name, `09/${day(d)}/2026`, amount(dailyCents + ((d * 13 + index * 7) % 11 - 5) * 175), 'USD']);
    }
    for (let i = 0; i < won + open + lost; i++) {
      const status = i < won ? 'Closed Won' : i < won + open ? ['Proposal', 'Negotiation', 'Open'][i % 3] : 'Closed Lost';
      // Name-only retargeting deliberately exercises the existing token matcher.
      // A separate punctuation/case variant exercises normalized-name matching.
      const nameOnly = slug === 'retarget' || (slug === 'summer' && i < 4);
      const crmName = slug === 'retarget' ? 'Retargeting_CartAbandon' : nameOnly ? ' summer_PROMO ' : name;
      const value = status === 'Closed Lost' && i % 4 === 0 ? '' : amount(dealCents + (i % 5) * 12500);
      crm.push([`sample-deal-${slug}-${i + 1}`, nameOnly ? '' : campaignId, crmName, status, value, 'USD', `${day(i % 28 + 1)}-09-2026`]);
    }
  });
  // Four valid but unattributed deals: two missing campaigns and two explicit
  // ID conflicts whose otherwise matching names MUST NOT override the IDs.
  crm.push(
    ['sample-review-1', '', 'Partner Briefing - Analytics', 'Proposal', '1700.00', 'USD', '19-09-2026'],
    ['sample-review-2', '', 'Partner Briefing - Analytics', 'Closed Won', '2200.00', 'USD', '20-09-2026'],
    ['sample-review-3', 'sample-unknown-brand', 'Q3 Brand Search', 'Closed Won', '2600.00', 'USD', '21-09-2026'],
    ['sample-review-4', 'sample-unknown-retarget', 'Retargeting_CartAbandon', 'Open', '1900.00', 'USD', '22-09-2026'],
  );
  ads.push(...ads.slice(3, 7));
  crm.push(...crm.slice(8, 14));
  return {
    ads: Papa.unparse({ fields: ['Campaign ID', 'Campaign Name', 'Date', 'Amount Spent', 'Currency'], data: shuffled(ads, 20260925) }),
    crm: Papa.unparse({ fields: ['Deal ID', 'Campaign ID', 'Campaign Name', 'Deal Stage', 'Amount', 'Currency', 'Close Date'], data: shuffled(crm, 20260926) }, { delimiter: ';' }),
  };
}
