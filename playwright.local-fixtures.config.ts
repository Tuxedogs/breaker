import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  testMatch: "inventory-add-modal.spec.ts",
  fullyParallel: false,
  reporter: [["list"]],
  // Cold Vite compilation on Tuxxy may take >45 seconds on the first route.
  timeout: 120_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    browserName: "chromium",
  },
  webServer: {
    command: "vite --config vite.local-fixtures.config.ts --mode fixtures --host 127.0.0.1 --port 5173 --strictPort",
    url: "http://127.0.0.1:5173/logistics/build-queue/__fixture/add-inventory",
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
