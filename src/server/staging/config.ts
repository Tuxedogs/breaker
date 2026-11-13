import { stagingManifest } from "./manifest.js";

export type StagingManifest = typeof stagingManifest;
type Environment = Record<string, string | undefined>;

function requireCondition(value: unknown): asserts value {
  if (!value) throw new Error("Staging isolation is unverified; refusing access.");
}

export function assertStagingConfiguration(env: Environment = process.env, manifest = stagingManifest) {
  requireCondition(manifest.verified && manifest.branch === "staging");
  requireCondition(env.VERCEL_ENV === "preview" && env.VERCEL_GIT_COMMIT_REF === manifest.branch);
  requireCondition(env.VERCEL_PROJECT_ID === manifest.projectId);
  requireCondition(env.BREAKER_ENVIRONMENT === "staging");
  for (const value of [manifest.origin, manifest.supabaseRef, manifest.neonProjectId,
    manifest.neonBranchId, manifest.databaseHost, manifest.databaseName, manifest.databaseRole, manifest.isolationId]) {
    requireCondition(value && !/placeholder|replace|example|<|>/i.test(value));
  }
  requireCondition(manifest.productionSupabaseRefs.length && manifest.productionDatabaseHosts.length && manifest.productionDatabaseRoles.length);
  requireCondition(!manifest.productionSupabaseRefs.includes(manifest.supabaseRef));
  requireCondition(!manifest.productionDatabaseHosts.includes(manifest.databaseHost));
  requireCondition(!manifest.productionDatabaseRoles.includes(manifest.databaseRole));
  const origin = new URL(manifest.origin);
  requireCondition(origin.protocol === "https:" && origin.origin === manifest.origin);
  requireCondition(!["scintel.app", "www.scintel.app"].includes(origin.hostname));
  const authUrl = `https://${manifest.supabaseRef}.supabase.co`;
  requireCondition(env.SUPABASE_URL === authUrl && env.VITE_SUPABASE_URL === authUrl);
  requireCondition(env.SUPABASE_ANON_KEY && env.SUPABASE_ANON_KEY === env.VITE_SUPABASE_ANON_KEY);
  const publicKey = env.SUPABASE_ANON_KEY;
  if (publicKey.startsWith("sb_publishable_")) {
    requireCondition(publicKey.length > 20);
  } else {
    try {
      const claims = JSON.parse(Buffer.from(publicKey.split(".")[1] ?? "", "base64url").toString("utf8"));
      requireCondition(claims.role === "anon" && claims.ref === manifest.supabaseRef);
    } catch { throw new Error("Staging public authentication key is invalid."); }
  }
  requireCondition(env.NEON_PROJECT_ID === manifest.neonProjectId && env.NEON_BRANCH_ID === manifest.neonBranchId);
  requireCondition(env.DATABASE_URL);
  let db: URL;
  try { db = new URL(env.DATABASE_URL); } catch { throw new Error("Staging database configuration is invalid."); }
  requireCondition(["postgres:", "postgresql:"].includes(db.protocol));
  requireCondition(db.hostname === manifest.databaseHost && db.password);
  requireCondition(decodeURIComponent(db.username) === manifest.databaseRole);
  requireCondition(decodeURIComponent(db.pathname.slice(1)) === manifest.databaseName);
  requireCondition(db.searchParams.get("sslmode") === "require");
  // Unused integration aliases must not silently supply a second database credential.
  requireCondition(!Object.keys(env).some(key => /^(PG|POSTGRES_)/.test(key) && env[key]));
  requireCondition(!env.DATABASE_URL_UNPOOLED && !env.SUPABASE_SERVICE_ROLE_KEY);
  return { manifest, databaseUrl: env.DATABASE_URL, authUrl };
}

export function assertStagingDatabaseIdentity(identity: Record<string, unknown> | undefined, manifest = stagingManifest) {
  requireCondition(identity && identity.database_name === manifest.databaseName && identity.role_name === manifest.databaseRole);
  requireCondition(identity.isolation_id === manifest.isolationId);
  for (const flag of ["elevated", "role_membership", "marker_write", "marker_owner", "database_create", "schema_create"]) {
    requireCondition(identity[flag] === false);
  }
}
