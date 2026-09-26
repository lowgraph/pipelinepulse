import { defineConfig } from '@playwright/test';

/**
 * Dedicated Playwright configuration for the local portfolio presentation site.
 *
 * This configuration isolates the portfolio preview tests from the core
 * Pipeline Pulse application browser suite.
 *
 * - Targets: tests/browser/portfolio.spec.js
 * - Default preview URL: http://127.0.0.1:3100
 * - Web Server: Automatically boots node portfolio/preview.mjs if not already running.
 */
export default defineConfig({
  testDir: './tests/browser',
  testMatch: /portfolio\.spec\.js$/,
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: process.env.PORTFOLIO_BASE_URL || 'http://127.0.0.1:3100',
    browserName: 'chromium',
    channel: 'msedge',
    viewport: { width: 1440, height: 1050 },
    screenshot: 'only-on-failure',
  },
  webServer: process.env.PORTFOLIO_BASE_URL
    ? undefined
    : {
        command: 'node portfolio/preview.mjs',
        url: 'http://127.0.0.1:3100',
        reuseExistingServer: !process.env.CI,
        timeout: 10000,
      },
  projects: [
    {
      name: 'portfolio',
      testMatch: /portfolio\.spec\.js$/,
    },
  ],
  reporter: 'list',
});
