import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/staging",
  workers: 1,
  retries: 0,
  timeout: 120000,
  reporter: "list",
  use: { trace: "off", screenshot: "off", video: "off" },
  // Deliberately no webServer: never start the production-proxying development server.
});
