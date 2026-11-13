import { assertStagingConfiguration } from "./config.js";
import { stagingManifest } from "./manifest.js";

// Configuration validation only: never loads env files, connects, or prints credentials.
export function assertStagingMigrationConfiguration(
  env: Record<string, string | undefined> = process.env,
  manifest = stagingManifest,
) {
  try {
    assertStagingConfiguration(env, manifest);
    const role = manifest.migrationRole;
    if (!role || /placeholder|replace|example|<|>/i.test(role)
      || role === manifest.databaseRole || manifest.productionDatabaseRoles.includes(role)) throw new Error();
    const migrationUrl = env.STAGING_MIGRATION_DATABASE_URL;
    if (!migrationUrl) throw new Error();
    const db = new URL(migrationUrl);
    const app = new URL(env.DATABASE_URL!);
    // Accept only the reviewed endpoint and TLS option; libpq options/host aliases
    // must not override the validated host, database, or role.
    for (const connection of [db, app]) {
      if (!["postgres:", "postgresql:"].includes(connection.protocol)
        || connection.hostname !== manifest.databaseHost
        || manifest.productionDatabaseHosts.includes(connection.hostname)
        || decodeURIComponent(connection.pathname.slice(1)) !== manifest.databaseName
        || !connection.password || connection.hash
        || (connection.port && connection.port !== "5432")
        || connection.searchParams.toString() !== "sslmode=require") throw new Error();
    }
    if (decodeURIComponent(db.username) !== role) throw new Error();
    return { databaseUrl: migrationUrl };
  } catch {
    // URL parsing/decoding errors can contain the input. Never retain their cause.
    throw new Error("Staging migration isolation is unverified; refusing access.");
  }
}
