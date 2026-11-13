import postgres from "postgres";
import { assertStagingConfiguration, assertStagingDatabaseIdentity } from "./config.js";

// No cached success: revalidate before each authenticated request and its profile write.
export async function verifyStagingIsolation() {
  const { manifest, databaseUrl, authUrl } = assertStagingConfiguration();
  const client = postgres(databaseUrl, { max: 1, ssl: "require", prepare: false, connect_timeout: 10 });
  try {
    const [identity] = await client`
      SELECT current_database() AS database_name, current_user AS role_name,
        (SELECT isolation_id FROM public.breaker_staging_identity WHERE singleton = true) AS isolation_id,
        (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls FROM pg_roles WHERE rolname = current_user) AS elevated,
        EXISTS (SELECT 1 FROM pg_roles WHERE rolname <> current_user AND pg_has_role(current_user, oid, 'MEMBER')) AS role_membership,
        has_table_privilege(current_user, 'public.breaker_staging_identity', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS marker_write,
        (SELECT pg_get_userbyid(relowner) = current_user FROM pg_class WHERE oid = 'public.breaker_staging_identity'::regclass) AS marker_owner,
        has_database_privilege(current_user, current_database(), 'CREATE') AS database_create,
        has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create
    `;
    assertStagingDatabaseIdentity(identity, manifest);
    const response = await fetch(`${authUrl}/auth/v1/settings`, {
      headers: { apikey: process.env.SUPABASE_ANON_KEY! }, redirect: "error", signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Staging authentication service verification failed.");
    const settings = await response.json() as { external?: { discord?: boolean } };
    if (settings.external?.discord !== true) throw new Error("Staging Discord authentication is unavailable.");
    return { ready: true, environment: "staging", candidate: manifest.candidate };
  } catch {
    throw new Error("Staging services or database isolation could not be verified.");
  } finally {
    await client.end({ timeout: 2 });
  }
}
