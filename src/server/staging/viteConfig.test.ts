import assert from "node:assert/strict";
import test from "node:test";
import { resolveConfig } from "vite";
import type { ConfigEnv, UserConfig, UserConfigFnObject } from "vite";
import config from "../../../vite.config.ts";

const configure = config as UserConfigFnObject;
const refusal = /local dev and preview servers are disabled/;

for (const mode of ["production", "development", "local-api", "fixtures", "staging", "custom"]) {
  for (const isPreview of [false, true]) {
    test(`rejects ${isPreview ? "preview" : "dev"} in ${mode} mode before environment validation`, () => {
      assert.throws(() => configure({ command: "serve", mode, isPreview }), refusal);
    });
  }
}

test("preview flag cannot bypass refusal with a build command", () => {
  assert.throws(() => configure({ command: "build", mode: "production", isPreview: true }), refusal);
});

test("non-production builds remain disabled", () => {
  assert.throws(() => configure({ command: "build", mode: "fixtures" }), refusal);
});

test("production-mode builds still enforce the staging isolation gate", () => {
  const context: ConfigEnv = { command: "build", mode: "production" };
  assert.throws(() => configure(context), /Staging isolation is unverified; refusing access/);
});

for (const isPreview of [false, true]) {
  test(`Vite resolved ${isPreview ? "preview" : "dev"} production mode refuses before starting a server`, async () => {
    await assert.rejects(
      resolveConfig({ configFile: false, ...configForResolution() }, "serve", "production", "production", isPreview),
      refusal,
    );
  });
}

// Exercise the exported callback through Vite's normal config hook without reading env files.
function configForResolution(): UserConfig {
  return { plugins: [{ name: "staging-config-regression", config: (_config, env) => configure(env) }] };
}

