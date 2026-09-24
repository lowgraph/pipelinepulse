import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, workers: 1, timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:3000', browserName: 'chromium', channel: 'msedge', viewport: { width: 1440, height: 1050 }, screenshot: 'only-on-failure' },
  reporter: 'list',
});
