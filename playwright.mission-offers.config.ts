import { defineConfig } from "@playwright/test";
import path from "node:path";

const port = 5182;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/ui",
  testMatch: "mission-offer-browser.spec.ts",
  fullyParallel: false,
  reporter: [["list"]],
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `vite --host 127.0.0.1 --port ${port}`,
    url: `${baseURL}/industry/missions`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      SCINTEL_LOCAL_API: "1",
      MISSION_DATA_ROOT: process.env.MISSION_DATA_ROOT ?? path.resolve("server-data/missions"),
    },
  },
});
