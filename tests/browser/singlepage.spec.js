import { demoFiles } from '../../lib/demo.js';
import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => { page.errors = []; page.on('pageerror', error => page.errors.push(error.message)); });
test.afterEach(async ({ page }) => { expect(page.errors).toEqual([]); });
async function upload(page, kind, text, name = `${kind}.csv`) { await page.getByLabel(`${kind} CSV file`).setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(text) }); }

test('empty start requires uploads before results, filters and AI summary', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Performance overview' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bring your data together' })).toBeVisible();
  await expect(page.locator('.sidebar')).toHaveCount(0);
  await expect(page.locator('.metric-value')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Analyze data' })).toBeDisabled();
  await expect(page.locator('#summary')).toHaveCount(0);
  const files = demoFiles();
  await upload(page, 'ads', files.ads);
  await expect(page.locator('.metric-value')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Analyze data' })).toBeDisabled();
  await upload(page, 'crm', files.crm);
  await page.getByRole('button', { name: 'Analyze data' }).click();
  await expect(page.locator('.metric-value').first()).toHaveText('$46,800');
  await expect(page.locator('.campaign-panel tbody tr')).toHaveCount(6);
  await page.getByLabel('Search campaigns').fill('Brand');
  await expect(page.locator('.campaign-panel tbody tr')).toHaveCount(2);
  await page.getByLabel('Search campaigns').fill('');
  await page.getByLabel('Filter decision').selectOption('Optimize');
  await expect(page.locator('.campaign-panel tbody tr')).toHaveCount(1);
  await page.getByLabel('Filter decision').selectOption('All decisions');
  await page.getByRole('button', { name: 'Generate AI summary' }).click();
  await expect(page.locator('.ai-error')).toContainText('not configured');
  await page.goto('/'); await expect(page.locator('.metric-value')).toHaveCount(0); await page.screenshot({ path: 'test-results/onepage-desktop.png', fullPage: true });
});

test('auto import removes duplicates and exposes unmatched records inline', async ({ page }) => {
  await page.goto('/');
  await upload(page, 'ads', 'Campaign ID,Total Ad Spend (USD),Campaign\na,100,Brand\na,100,Brand');
  await upload(page, 'crm', 'customer_identifier,campaign_name,deal_status,contract_value\n1,Brand,Won,500\n1,Brand,Won,500\n2,Missing,Won,900');
  await expect(page.locator('.detection-result').first()).toContainText('Total Ad Spend (USD)');
  await page.getByRole('button', { name: 'Analyze data' }).click();
  await expect(page.locator('.metric-value').first()).toHaveText('$100');
  await expect(page.locator('.metric-value').nth(2)).toHaveText('5.00×');
  await expect(page.locator('.decision-badge')).toHaveText('Review data');
  await page.locator('#data-quality > summary').click();
  await expect(page.locator('#data-quality')).toContainText('No matching ad campaign');
  await page.getByRole('button', { name: 'Clear data', exact: true }).click();
  await expect(page.locator('.metric-value')).toHaveCount(0);
  await expect(page.locator('.detection-result')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Analyze data' })).toBeDisabled();
});

test('Portuguese semicolon exports, BRL, numbers and dates are automatic', async ({ page }) => {
  await page.goto('/');
  await upload(page, 'ads', 'sep=;\nRelatório de campanhas\nNome da campanha;Valor gasto (BRL);Dia\nPesquisa;1.234,56;25/08/2026');
  await upload(page, 'crm', 'ID do negócio;Campanha;Etapa;Valor;Moeda\n1;Pesquisa;Ganho;2.500,00;BRL');
  await expect(page.locator('.detection-result').first()).toContainText('Semicolon');
  await page.getByRole('button', { name: 'Analyze data' }).click();
  await expect(page.locator('.metric-value').first()).toContainText('1,235');
  await expect(page.locator('.currency-label')).toHaveText('BRL');
  await expect(page.locator('.error-banner')).toHaveCount(0);
});

test('content detection reconciles arbitrary headers across files', async ({ page }) => {
  await page.goto('/');
  await upload(page, 'ads', 'Tracking bucket,Ad Spend\nSearch,100');
  await upload(page, 'crm', 'a,b,c,d\nuser@example.com,Search,Won,$500');
  await expect(page.locator('.detection-result').last()).toContainText('campaign: b');
  await page.getByRole('button', { name: 'Analyze data' }).click();
  await expect(page.locator('.metric-value').nth(2)).toHaveText('5.00×');
});

test('ambiguous numeric columns can be mapped inline', async ({ page }) => {
  await page.goto('/');
  await upload(page, 'ads', 'Campaign,Metric A,Metric B\nSearch,100,999');
  await upload(page, 'crm', 'Record ID,Campaign,Stage,Amount\n1,Search,Won,500');
  await expect(page.getByLabel('ads spend column')).toBeVisible();
  await page.getByLabel('ads spend column').selectOption('Metric A');
  await page.getByRole('button', { name: 'Analyze data' }).click();
  await expect(page.locator('.metric-value').first()).toHaveText('$100');
  await expect(page.locator('.error-banner')).toHaveCount(0);
});

test('invalid data preserves results and invalid replacement clears stale selection', async ({ page }) => {
  await page.goto('/');
  await upload(page, 'ads', 'Thing,Value\na,1');
  await upload(page, 'crm', 'Record ID,Campaign,Stage,Amount\n1,A,Won,100');
  await page.getByRole('button', { name: 'Analyze data' }).click();
  await expect(page.locator('.error-banner')).toContainText('Missing ads columns');
  await expect(page.locator('.metric-value')).toHaveCount(0);
  await upload(page, 'ads', 'not a CSV', 'invalid.xlsx');
  await expect(page.getByRole('button', { name: 'Analyze data' })).toBeDisabled();
});

test('mobile page has no overflow and imported HTML stays text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/onepage-mobile.png', fullPage: true });
  const name = '<img src=x onerror=alert(1)>';
  await upload(page, 'ads', `Campaign,Cost\n${name},100`);
  await upload(page, 'crm', `Record ID,Campaign,Stage,Amount\n1,${name},Won,100`);
  await page.getByRole('button', { name: 'Analyze data' }).click();
  await expect(page.locator('.campaign-panel tbody')).toContainText(name);
  await expect(page.locator('.campaign-panel tbody img')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('explanation API rejects cross-origin and malformed requests', async ({ request }) => {
  expect((await request.post('/api/explain', { data: {} })).status()).toBe(403);
  expect((await request.post('/api/explain', { headers: { origin: 'http://127.0.0.1:3000' }, data: {} })).status()).toBe(400);
});

test('ID-less CRM detects revenue, removes duplicates and computes KPIs', async ({ page }) => {
  await page.goto('/');
  await upload(page, 'ads', 'Campaign,Cost\nSearch,100');
  await upload(page, 'crm', 'Campaign,Stage,Booked cash,Name\nSearch,Won,500,Alice\nSearch,Won,500,Alice\nSearch,Won,700,Bob');
  await expect(page.locator('.detection-result').last()).toContainText('Optional · deduplicating by row contents');
  await expect(page.locator('.detection-result').last()).toContainText('revenue: Booked cash');
  await expect(page.locator('.error-text')).toHaveCount(0);
  await page.getByRole('button', { name: 'Analyze data' }).click();
  await expect(page.locator('.metric-value').nth(1)).toHaveText('$50');
  await expect(page.locator('.metric-value').nth(2)).toHaveText('12.00×');
  await expect(page.locator('.revenue-total')).toContainText('$1,200');
  await expect(page.locator('.recon-stat').nth(1)).toContainText('1');
});

test('truly missing revenue loads counts but shows unavailable monetary results', async ({ page }) => {
  await page.goto('/');
  await upload(page, 'ads', 'Campaign,Cost\nSearch,100');
  await upload(page, 'crm', 'Campaign,Stage,Name\nSearch,Won,Alice');
  await page.getByRole('button', { name: 'Analyze data' }).click();
  await expect(page.locator('.metric-value').nth(1)).toHaveText('$100');
  await expect(page.locator('.metric-value').nth(2)).toHaveText('Unavailable');
  await expect(page.locator('.metric-value').nth(3)).toHaveText('—');
  await expect(page.locator('.metric-3')).toContainText('No matched open opportunities');
  await expect(page.locator('#summary')).toContainText('No matched open opportunities.');
  await expect(page.locator('.revenue-stack')).not.toBeVisible();
  await expect(page.locator('.error-banner')).toHaveCount(0);
});
