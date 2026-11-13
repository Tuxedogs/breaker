import assert from "node:assert/strict";
import test from "node:test";
import { assertStagingConfiguration, assertStagingDatabaseIdentity } from "./config.js";
import { stagingManifest } from "./manifest.js";

const manifest = {
  ...stagingManifest, verified: true, origin: "https://breaker-staging.vercel.app",
  supabaseRef: "isolated-auth", neonProjectId: "isolated-project", neonBranchId: "isolated-branch",
  databaseHost: "ep-isolated.neon.tech", databaseName: "breaker_staging", databaseRole: "breaker_staging_app",
  isolationId: "isolated-lineage", productionSupabaseRefs: ["live-auth"],
  productionDatabaseHosts: ["ep-live.neon.tech"], productionDatabaseRoles: ["live-app"],
};
const env = {
  VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "staging", VERCEL_PROJECT_ID: manifest.projectId,
  BREAKER_ENVIRONMENT: "staging", SUPABASE_URL: "https://isolated-auth.supabase.co",
  VITE_SUPABASE_URL: "https://isolated-auth.supabase.co", SUPABASE_ANON_KEY: "sb_publishable_test-only", VITE_SUPABASE_ANON_KEY: "sb_publishable_test-only",
  NEON_PROJECT_ID: manifest.neonProjectId, NEON_BRANCH_ID: manifest.neonBranchId,
  DATABASE_URL: "postgresql://breaker_staging_app:test-only@ep-isolated.neon.tech/breaker_staging?sslmode=require",
};
test("reviewed staging metadata and matching configuration pass the configuration gate", () => {
  assert.equal(assertStagingConfiguration(env, manifest).manifest.branch, "staging");
});
test("unreviewed checked-in manifest fails closed", () => {
  assert.throws(() => assertStagingConfiguration(env));
});
for (const [name, change] of Object.entries({
  production: { VERCEL_ENV: "production" }, wrongBranch: { VERCEL_GIT_COMMIT_REF: "main" },
  wrongProject: { VERCEL_PROJECT_ID: "different" }, missingMarker: { BREAKER_ENVIRONMENT: undefined },
  missingDatabase: { DATABASE_URL: undefined }, missingAuth: { SUPABASE_ANON_KEY: undefined },
  mixedAuth: { SUPABASE_URL: "https://live-auth.supabase.co" }, mixedKeys: { VITE_SUPABASE_ANON_KEY: "other" },
  wrongNeonBranch: { NEON_BRANCH_ID: "live" }, alternateCredential: { POSTGRES_URL: "forbidden" },
  ownerCredential: { DATABASE_URL: env.DATABASE_URL.replace("breaker_staging_app:", "live-app:") },
  productionHost: { DATABASE_URL: env.DATABASE_URL.replace("ep-isolated", "ep-live") },
  wrongDatabase: { DATABASE_URL: env.DATABASE_URL.replace("/breaker_staging?", "/production?") },
  noTls: { DATABASE_URL: env.DATABASE_URL.replace("sslmode=require", "sslmode=disable") },
  malformedUrl: { DATABASE_URL: "broken" }, unpooledCredential: { DATABASE_URL_UNPOOLED: "forbidden" },
  privilegedAuth: { SUPABASE_SERVICE_ROLE_KEY: "forbidden" },
})) {
  test(`rejects ${name} without disclosing credentials`, () => {
    assert.throws(() => assertStagingConfiguration({ ...env, ...change }, manifest), error => {
      assert.ok(error instanceof Error);
      assert.ok(!error.message.includes("test-only") && !error.message.includes("postgresql://"));
      return true;
    });
  });
}
test("missing production inventory and production resource identities fail closed", () => {
  assert.throws(() => assertStagingConfiguration(env, { ...manifest, productionDatabaseHosts: [] }));
  assert.throws(() => assertStagingConfiguration(env, { ...manifest, productionDatabaseHosts: [manifest.databaseHost] }));
  assert.throws(() => assertStagingConfiguration(env, { ...manifest, productionSupabaseRefs: [manifest.supabaseRef] }));
  assert.throws(() => assertStagingConfiguration(env, { ...manifest, productionDatabaseRoles: [manifest.databaseRole] }));
});

const databaseIdentity = {
  database_name: manifest.databaseName, role_name: manifest.databaseRole, isolation_id: manifest.isolationId,
  elevated: false, role_membership: false, marker_write: false, marker_owner: false, database_create: false, schema_create: false,
};
test("verified runtime database identity and restricted privileges pass", () => {
  assert.doesNotThrow(() => assertStagingDatabaseIdentity(databaseIdentity, manifest));
});
for (const field of Object.keys(databaseIdentity)) {
  test(`runtime database identity rejects altered or absent ${field}`, () => {
    assert.throws(() => assertStagingDatabaseIdentity({ ...databaseIdentity, [field]: true }, manifest));
    assert.throws(() => assertStagingDatabaseIdentity({ ...databaseIdentity, [field]: undefined }, manifest));
  });
}
test("unavailable runtime database identity fails closed", () => {
  assert.throws(() => assertStagingDatabaseIdentity(undefined, manifest));
});
test("legacy anon JWT must identify the staging project and reject service-role credentials", () => {
  for (const [role, ref, allowed] of [["anon", manifest.supabaseRef, true], ["service_role", manifest.supabaseRef, false], ["anon", "live-auth", false]] as const) {
    const key = `test.${Buffer.from(JSON.stringify({ role, ref })).toString("base64url")}.test`;
    const check = () => assertStagingConfiguration({ ...env, SUPABASE_ANON_KEY: key, VITE_SUPABASE_ANON_KEY: key }, manifest);
    if (allowed) assert.doesNotThrow(check); else assert.throws(check);
  }
});
