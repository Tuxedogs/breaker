import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { assertStagingMigrationConfiguration as check } from "./migrationConfig.js";
import { assertStagingConfiguration } from "./config.js";
import { stagingManifest } from "./manifest.js";

const manifest = {
  ...stagingManifest, verified: true, origin: "https://breaker-staging.vercel.app",
  supabaseRef: "isolated-auth", neonProjectId: "isolated-project", neonBranchId: "isolated-branch",
  databaseHost: "ep-isolated.neon.tech", databaseName: "breaker_staging",
  databaseRole: "breaker_staging_app", migrationRole: "breaker_staging_migrator",
  isolationId: "isolated-lineage", productionSupabaseRefs: ["live-auth"],
  productionDatabaseHosts: ["ep-live.neon.tech"], productionDatabaseRoles: ["live-owner"],
};
const url = (role: string) => `postgresql://${role}:synthetic-secret@ep-isolated.neon.tech/breaker_staging?sslmode=require`;
const env = {
  VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "staging", VERCEL_PROJECT_ID: manifest.projectId,
  BREAKER_ENVIRONMENT: "staging", SUPABASE_URL: "https://isolated-auth.supabase.co",
  VITE_SUPABASE_URL: "https://isolated-auth.supabase.co", SUPABASE_ANON_KEY: "sb_publishable_test-only",
  VITE_SUPABASE_ANON_KEY: "sb_publishable_test-only", NEON_PROJECT_ID: manifest.neonProjectId,
  NEON_BRANCH_ID: manifest.neonBranchId, DATABASE_URL: url(manifest.databaseRole),
  STAGING_MIGRATION_DATABASE_URL: url(manifest.migrationRole),
};

test("migration selects only the distinct migration role; application keeps its restricted role", () => {
  assert.equal(check(env, manifest).databaseUrl, env.STAGING_MIGRATION_DATABASE_URL);
  assert.equal(assertStagingConfiguration(env, manifest).databaseUrl, env.DATABASE_URL);
  assert.deepEqual(Object.keys(check(env, manifest)), ["databaseUrl"]);
});

const changes: Record<string, Record<string, string | undefined>> = {
  missingMigration: { STAGING_MIGRATION_DATABASE_URL: undefined },
  missingApplication: { DATABASE_URL: undefined },
  productionEnvironment: { VERCEL_ENV: "production" }, wrongBranch: { VERCEL_GIT_COMMIT_REF: "main" },
  wrongProject: { VERCEL_PROJECT_ID: "other" }, wrongNeon: { NEON_BRANCH_ID: "live" },
  wrongAuth: { SUPABASE_URL: "https://live-auth.supabase.co" },
  applicationRoleReused: { STAGING_MIGRATION_DATABASE_URL: env.DATABASE_URL },
  migrationRoleInApplication: { DATABASE_URL: env.STAGING_MIGRATION_DATABASE_URL },
  productionRole: { STAGING_MIGRATION_DATABASE_URL: url("live-owner") },
  alias: { POSTGRES_URL: "synthetic-secret" }, privilegedAuth: { SUPABASE_SERVICE_ROLE_KEY: "synthetic-secret" },
};
for (const [name, value] of Object.entries({
  productionHost: url(manifest.migrationRole).replace("ep-isolated", "ep-live"),
  wrongDatabase: url(manifest.migrationRole).replace("/breaker_staging?", "/production?"),
  noTls: url(manifest.migrationRole).replace("require", "disable"),
  wrongProtocol: url(manifest.migrationRole).replace("postgresql:", "https:"),
  emptyPassword: url(manifest.migrationRole).replace("synthetic-secret", ""),
  malformed: "postgresql://synthetic-secret@[", malformedEncoding: url("%ZZ"),
  port: url(manifest.migrationRole).replace(".tech/", ".tech:5433/"),
  fragment: `${url(manifest.migrationRole)}#synthetic-secret`,
  hostOverride: `${url(manifest.migrationRole)}&host=ep-live.neon.tech`,
  roleOverride: `${url(manifest.migrationRole)}&options=-c%20role%3Dlive-owner`,
  duplicateTls: `${url(manifest.migrationRole)}&sslmode=disable`,
})) changes[name] = { STAGING_MIGRATION_DATABASE_URL: value };
changes.applicationOverride = { DATABASE_URL: `${env.DATABASE_URL}&options=-c%20role%3Dlive-owner` };

for (const [name, change] of Object.entries(changes)) {
  test(`fails closed with redacted error: ${name}`, () => {
    assert.throws(() => check({ ...env, ...change }, manifest), error => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "Staging migration isolation is unverified; refusing access.");
      assert.ok(!error.stack?.includes("synthetic-secret"));
      assert.equal(error.cause, undefined);
      return true;
    });
  });
}

test("unreviewed, missing, reused, or prohibited manifest identities are rejected", () => {
  assert.throws(() => check(env));
  for (const change of [
    { verified: false }, { migrationRole: "" }, { migrationRole: "REPLACE_ME" },
    { migrationRole: manifest.databaseRole }, { productionDatabaseRoles: [manifest.migrationRole] },
    { productionDatabaseRoles: [manifest.databaseRole] }, { productionDatabaseRoles: [] },
    { productionDatabaseHosts: [] }, { productionSupabaseRefs: [] },
    { productionDatabaseHosts: [manifest.databaseHost] }, { productionSupabaseRefs: [manifest.supabaseRef] },
  ]) assert.throws(() => check(env, { ...manifest, ...change }));
});

test("Drizzle entry point uses the migration guard without dotenv or a database client", () => {
  const source = readFileSync(new URL("../../../drizzle.config.ts", import.meta.url), "utf8");
  assert.match(source, /const \{ databaseUrl \} = assertStagingMigrationConfiguration\(\)/);
  assert.match(source, /url: databaseUrl/);
  assert.doesNotMatch(source, /dotenv|assertStagingConfiguration\(|process\.env|from ["']postgres/);
});

test("actual Drizzle config import refuses the unverified manifest without secret output", async () => {
  await assert.rejects(import("../../../drizzle.config.js"), {
    message: "Staging migration isolation is unverified; refusing access.",
  });
});
