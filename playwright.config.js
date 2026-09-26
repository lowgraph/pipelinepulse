import { defineConfig } from '@playwright/test';

/**
 * Default Playwright configuration for the Pipeline Pulse application.
 *
 * Excludes local portfolio presentation tests (tests/browser/portfolio.spec.js),
 * which belong to a separate presentation layer served on port 3100.
 * To run portfolio tests, use: npm run test:portfolio
 */
export default defineConfig({
  testDir: './tests/browser',
  testIgnore: ['**/portfolio.spec.js'],
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: process.env.PIPELINE_TEST_URL || 'http://127.0.0.1:3000',
    browserName: 'chromium',
    channel: 'msedge',
    viewport: { width: 1440, height: 1050 },
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'app',
      testIgnore: ['**/portfolio.spec.js'],
    },
  ],
  reporter: 'list',
});

