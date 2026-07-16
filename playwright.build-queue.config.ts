import { defineConfig } from "@playwright/test";

const fixturePath = "/logistics/build-queue/__fixture/stats";
const port = 5175;
const baseURL = `http://127.0.0.1:${port}`;

const fixtureCommand = `vite --mode fixtures --host 127.0.0.1 --port ${port}`;

export default defineConfig({
  testDir: "./tests/ui",
  testMatch: "build-queue-stats.spec.ts",
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
    command: fixtureCommand,
    url: `${baseURL}${fixturePath}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
