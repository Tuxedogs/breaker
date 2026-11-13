import { defineConfig } from "@playwright/test";

const fixturePath = "/industry/mining";
const port = 5173;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/ui",
  testMatch: "mining-three-panel.spec.ts",
  fullyParallel: false,
  reporter: [["list"]],
  timeout: 120_000,
  expect: {
    timeout: 30_000,
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `vite --config vite.local-fixtures.config.ts --mode fixtures --host 127.0.0.1 --port ${port} --strictPort`,
    url: `${baseURL}${fixturePath}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
