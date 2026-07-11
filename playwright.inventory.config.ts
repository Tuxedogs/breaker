import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  testMatch: "inventory-layout.spec.ts",
  fullyParallel: false,
  reporter: [["list"]],
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "vite --host 127.0.0.1 --port 5173",
    url: "http://127.0.0.1:5173/logistics/inventory/__fixture/layout",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
