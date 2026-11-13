import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import type { PlaywrightTestConfig } from "@playwright/test";

// Local Playwright servers must be the fixtures-only Vite config: vite.config.ts refuses dev and
// preview, and a reused server on the same port could be an unguarded one from another checkout.
const root = path.resolve(import.meta.dirname, "..");
const configFiles = readdirSync(root).filter(name => /^playwright\..+\.config\.ts$/.test(name)).sort();

async function loadConfig(file: string): Promise<PlaywrightTestConfig> {
  return (await import(pathToFileURL(path.join(root, file)).href)).default as PlaywrightTestConfig;
}

test("finds the Playwright configs", () => {
  assert.ok(configFiles.length >= 11, `expected at least 11 configs, found ${configFiles.length}`);
  assert.ok(configFiles.includes("playwright.staging.config.ts"));
});

test("staging config never starts a local server", async () => {
  assert.equal((await loadConfig("playwright.staging.config.ts")).webServer, undefined);
});

for (const file of configFiles.filter(name => name !== "playwright.staging.config.ts")) {
  test(`${file} starts only the isolated fixtures server`, async () => {
    const config = await loadConfig(file);
    const servers = [config.webServer ?? []].flat();
    assert.ok(servers.length > 0, "a local config must declare its webServer");
    for (const server of servers) {
      const command = server.command ?? "";
      assert.match(command, /^vite --config vite\.local-fixtures\.config\.ts --mode fixtures /);
      assert.match(command, / --host 127\.0\.0\.1 /);
      assert.match(command, / --strictPort$/);
      assert.equal(server.reuseExistingServer, false);
      assert.equal(server.env, undefined, "fixture servers take no backend or auth env");
      const port = command.match(/ --port (\d+) /)?.[1];
      assert.ok(port, "command must pin --port");
      assert.equal(new URL(server.url ?? "").port, port, "readiness URL must match the pinned port");
    }
  });
}
