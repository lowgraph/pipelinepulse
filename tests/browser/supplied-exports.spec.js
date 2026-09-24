import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

test('supplied exports upload and analyze without manual column mapping or IDs', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('ads CSV file').setInputFiles(fileURLToPath(new URL('../fixtures/media-spend.csv', import.meta.url)));
  await page.getByLabel('crm CSV file').setInputFiles(fileURLToPath(new URL('../fixtures/crm-sales.csv', import.meta.url)));
  await expect(page.locator('.detection-result').first()).toContainText('Total_Spend');
  await expect(page.locator('.detection-result').last()).toContainText('Revenue_Generated');
  await page.getByRole('button', { name: 'Analyze data' }).click();
  await expect(page.locator('.metric-value').nth(0)).toHaveText('$185,177');
  await expect(page.locator('.metric-value').nth(1)).toHaveText('$772');
  await expect(page.locator('.metric-value').nth(2)).toHaveText('33.25×');
  await expect(page.locator('.metric-value').nth(3)).toHaveText('$0');
  await expect(page.locator('.error-banner')).toHaveCount(0);
  await expect(page.locator('.campaign-panel tbody tr')).toHaveCount(6);
  expect(errors).toEqual([]);
});
