import { test, expect } from '@playwright/test';

for (const language of ['en', 'pt']) {
  test(`one-click ${language} sample works offline, stays synthetic, and clears completely`, async ({ page, context }) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    if (language === 'pt') await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    // Changing language also confirms the app has hydrated before going offline.
    await page.getByRole('button', { name: 'Português', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Reúna seus dados' })).toBeVisible();
    if (language === 'en') await page.getByRole('button', { name: 'EN', exact: true }).click();
    const sample = page.getByRole('button', { name: language === 'pt' ? 'Carregar dados de exemplo' : 'Try sample data', exact: true });
    await expect(sample).toBeVisible();
    await expect(page.getByText(language === 'pt' ? 'Dados sintéticos para demonstração' : 'Synthetic demo data', { exact: true })).toBeVisible();
    const requests = []; page.on('request', request => requests.push(request.url()));
    await context.setOffline(true);
    await sample.click();
    await expect(page.locator('.metric-value')).toHaveCount(4);
    await expect(page.locator('.context-strip')).toContainText(language === 'pt' ? 'Dados de exemplo' : 'Sample data');
    await expect(page.locator('.context-strip')).toContainText('sample-advertising.csv + sample-crm.csv');
    await expect(page.locator('.detection-settings')).toHaveCount(0);
    await expect(page.locator('.campaign-panel tbody tr')).toHaveCount(7);
    await expect(page.locator('.metric-value').first()).toContainText(language === 'pt' ? '32.264' : '32,264');
    await expect(page.locator('.metric-value').nth(1)).toContainText('620');
    await expect(page.locator('.metric-value').nth(2)).toHaveText(language === 'pt' ? '2,71×' : '2.71×');
    await expect(page.locator('.metric-value').nth(3)).toContainText(language === 'pt' ? '114.925' : '114,925');
    await expect(page.locator('.recon-stat').nth(0)).toContainText('374');
    await expect(page.locator('.recon-stat').nth(1)).toContainText('10');
    await expect(page.locator('.recon-stat').nth(2)).toContainText('192');
    await expect(page.locator('.sample-note')).toContainText('Retargeting_CartAbandon');
    await expect(page.locator('.decision-badge').first()).toHaveText(language === 'pt' ? 'Revisar dados' : 'Review data');
    await page.locator('#data-quality > summary').click();
    await expect(page.locator('#data-quality')).toContainText('Q3 Brand Search');
    await expect(page.locator('#data-quality')).toContainText('Partner Briefing - Analytics');
    await expect(page.getByRole('button', { name: /Generate AI summary|Gerar resumo com IA/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/sample-${language}.png`, fullPage: true });
    await page.getByRole('button', { name: language === 'pt' ? 'Limpar dados' : 'Clear data', exact: true }).first().click();
    await expect(page.locator('.metric-value')).toHaveCount(0);
    await expect(page.locator('.context-strip')).toHaveCount(0);
    await expect(page.locator('.detection-result')).toHaveCount(0);
    await expect(sample).toBeVisible();
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    await context.setOffline(false);
  });
}

test('sample option does not replace a pending upload and real replacement removes the sample label', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('ads CSV file').setInputFiles({ name: 'own.csv', mimeType: 'text/csv', buffer: Buffer.from('Campaign,Spend\nOwn,10') });
  await expect(page.getByRole('button', { name: 'Try sample data' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear data', exact: true }).first().click();
  await page.getByRole('button', { name: 'Try sample data' }).click();
  await expect(page.locator('.context-strip')).toContainText('Sample data');
  for (const [kind, text] of Object.entries({ ads: 'Campaign,Spend\nOwn,10', crm: 'Campaign,Stage,Amount\nOwn,Won,100' })) {
    await page.getByLabel(`${kind} CSV file`).setInputFiles({ name: `own-${kind}.csv`, mimeType: 'text/csv', buffer: Buffer.from(text) });
  }
  await page.getByRole('button', { name: 'Analyze data', exact: true }).click();
  await expect(page.locator('.context-strip')).toContainText('Your data');
  await expect(page.locator('.context-strip')).not.toContainText('Sample data');
  await expect(page.locator('.metric-value').first()).toHaveText('$10');
});
