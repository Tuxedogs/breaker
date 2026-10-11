import { defineConfig } from "@playwright/test";

const fixturePath = "/industry/mining";
const port = 5178;
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
    command: `vite --mode fixtures --host 127.0.0.1 --port ${port}`,
    url: `${baseURL}${fixturePath}`,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "1",
    timeout: 180_000,
  },
});
