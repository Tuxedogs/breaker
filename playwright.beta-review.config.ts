import { defineConfig } from '@playwright/test';

const port = 5209;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/ui',
  testMatch: 'beta-review-regressions.spec.ts',
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: `vite --mode fixtures --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    env: {
      SCINTEL_LOCAL_API: '1',
      VITE_SUPABASE_URL: baseURL,
      VITE_SUPABASE_ANON_KEY: 'fixture-only-anon-key',
    },
    timeout: 180_000,
  },
});
