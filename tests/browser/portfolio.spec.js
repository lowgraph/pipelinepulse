import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const portfolioBase = process.env.PORTFOLIO_BASE_URL || 'http://127.0.0.1:3100';

for (const width of [390, 1440]) {
  for (const file of ['index.html', 'pipeline-pulse.html', 'silt-strider.html']) {
    test(`portfolio ${file} bilingual at ${width}px`, async ({ page }) => {
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${portfolioBase}/${file}`);
      for (const lang of ['pt', 'en']) {
        await page.locator(`#btn-${lang}`).click();
        await expect(page.locator('html')).toHaveAttribute('lang', lang === 'pt' ? 'pt-BR' : 'en');
        await expect(page.locator(`#btn-${lang}`)).toHaveAttribute('aria-pressed', 'true');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const mismatches = await page.locator('[data-pt][data-en]').evaluateAll((els, language) => els.filter(el => el.textContent !== el.getAttribute(`data-${language}`)).map(el => el.tagName), lang);
        expect(mismatches).toEqual([]);
        if (file !== 'pipeline-pulse.html') {
          const img = page.locator('.architecture img');
          await img.scrollIntoViewIfNeeded();
          await expect(img).toHaveAttribute('src', `./silt-strider-architecture-${lang}.png`);
          await expect(img).toHaveAttribute('alt', new RegExp(lang === 'pt' ? '^Arquitetura do' : '^Silt Strider Tools architecture'));
          await expect.poll(() => img.evaluate(el => el.complete && el.naturalWidth === 1672)).toBe(true);
          expect(await img.evaluate(el => el.currentSrc)).toContain(`architecture-${lang}.webp`);
        }
        if (file === 'index.html') {
          const cv = page.locator('[data-href-pt$=".pdf"]');
          const name = `Tiago_Marcal_Ferreira_CV_MarkOps_${lang.toUpperCase()}_2026.pdf`;
          await expect(cv).toHaveAttribute('href', `./${name}`);
          const pdf = await page.request.get(`${portfolioBase}/${name}`);
          expect(pdf.status()).toBe(200);
          expect((await pdf.body()).equals(fs.readFileSync(`portfolio/assets/updates/${name}`))).toBe(true);
          expect(await page.locator('.project h3').allTextContents()).toEqual(['Pipeline Pulse', 'Silt Strider Tools']);
          await expect(page.locator('.pipeline-preview img')).toHaveAttribute('src', './pipeline-pulse-dashboard.png');
        } else {
          await expect(page.locator('.role-block h2')).toHaveText(lang === 'pt' ? 'Meu papel' : 'My role');
          await expect(page.locator('.professional-cta a[href="mailto:contato@tiagomf.com"]')).toHaveCount(1);
          await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
          if (file === 'pipeline-pulse.html') await expect(page.locator('body')).toContainText(lang === 'pt' ? 'Essa integração não é habilitada na demonstração pública.' : 'This integration is intentionally not enabled in the public demo.');
          else await expect(page.locator('body')).toContainText(lang === 'pt' ? 'campo de condição pertencente a um container' : 'condition field belonging to a container');
        }
        for (const image of await page.locator('img').all()) {
          await image.scrollIntoViewIfNeeded();
          await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
        }
        for (const meta of await page.locator('meta[data-content-pt]').all()) {
          expect(await meta.getAttribute('content')).toBe(await meta.getAttribute(`data-content-${lang}`));
        }
        await page.screenshot({ path: `test-results/portfolio-${file}-${lang}-${width}.png`, fullPage: true });
      }
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      expect(errors).toEqual([]);
    });
  }
}
