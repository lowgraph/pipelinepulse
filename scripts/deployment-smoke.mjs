import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

const base = process.argv[2] || 'http://127.0.0.1:8787';
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto(`${base}/pipeline`);
  assert.equal(response.status(), 200);
  await page.getByRole('heading', { name: 'Performance overview' }).waitFor();
  assert.equal(await page.locator('.metric-value').count(), 0);
  // Wait for hydration before dispatching native input events on a remote page.
  await expect(async () => {
    await page.getByRole('button', { name: 'Português', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Visão geral de desempenho' })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30000 });
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('heading', { name: 'Performance overview' }).waitFor();
  const sampleRequests = [];
  const trackSample = request => sampleRequests.push(request.url());
  page.on('request', trackSample);
  await page.context().setOffline(true);
  await page.getByRole('button', { name: 'Try sample data', exact: true }).click();
  await page.locator('.metric-value').first().waitFor();
  assert.equal(await page.locator('.metric-value').first().textContent(), '$32,264');
  assert.equal(await page.locator('.metric-value').nth(3).textContent(), '$114,925');
  assert.match(await page.locator('.context-strip').textContent(), /Sample data/);
  await page.getByRole('button', { name: 'Clear data', exact: true }).first().click();
  await page.getByRole('button', { name: 'Try sample data', exact: true }).waitFor();
  assert.equal(await page.locator('.metric-value').count(), 0);
  page.off('request', trackSample);
  assert.deepEqual(sampleRequests, []);
  await page.context().setOffline(false);
  for (const [kind, text] of Object.entries({ ads: 'Campaign,Spend\nSearch,100', crm: 'Campaign,Stage,Amount\nSearch,Won,500\nSearch,Proposal,200' })) {
    await page.getByLabel(`${kind} CSV file`).setInputFiles({ name: `${kind}.csv`, mimeType: 'text/csv', buffer: Buffer.from(text) });
  }
  await page.getByRole('button', { name: 'Analyze data', exact: true }).click();
  await page.locator('.metric-value').first().waitFor();
  assert.equal(await page.locator('.metric-value').first().textContent(), '$100');
  assert.equal(await page.locator('.metric-value').nth(3).textContent(), '$200');
  assert.equal(await page.getByRole('button', { name: 'Generate AI summary' }).count(), 0);
  assert.match(await page.locator('#summary').textContent(), /RULE-BASED SUMMARY/);
  await page.getByRole('button', { name: 'Português', exact: true }).click();
  await page.getByRole('heading', { name: 'Visão geral de desempenho' }).waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'pt-BR');
  await page.reload();
  await page.getByRole('heading', { name: 'Visão geral de desempenho' }).waitFor();
  assert.equal(await page.locator('.metric-value').count(), 0);
  const icon = await page.request.get(`${base}/pipeline/favicon.svg`);
  assert.equal(icon.status(), 200);
  assert.match(icon.headers()['content-type'], /image\/svg/);
  const invalid = await page.request.post(`${base}/pipeline/api/explain`, { headers: { origin: 'https://tiagomf.com' }, data: {} });
  assert.equal(invalid.status(), 403);
  assert.deepEqual(errors, []);
  console.log('PASS: /pipeline, assets, empty start, offline sample loading and clearing, CSV upload, KPIs, Portuguese, reload, API routing.');
} finally { await browser.close(); }
