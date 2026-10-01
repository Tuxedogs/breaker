import { defineConfig } from '@playwright/test';

const port = 5176;

export default defineConfig({
  testDir: './tests/ui',
  testMatch: 'inventory-add-modal.spec.ts',
  timeout: 60_000,
  expect: { timeout: 30_000 },
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: `vite --mode fixtures --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/logistics/build-queue/__fixture/add-inventory`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
