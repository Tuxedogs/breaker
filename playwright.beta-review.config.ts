import { defineConfig } from '@playwright/test';

const port = 5209;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/ui',
  testMatch: ['beta-review-regressions.spec.ts', 'build-queue-inventory-workflow.spec.ts'],
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: `vite --config vite.local-fixtures.config.ts --mode fixtures --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
