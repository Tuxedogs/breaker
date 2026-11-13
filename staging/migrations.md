# Local staging migration configuration

`drizzle.config.ts` uses only `STAGING_MIGRATION_DATABASE_URL` for database
operations. There is no fallback to `DATABASE_URL` or environment files.
The existing staging application configuration must also pass its isolation gate.
`DATABASE_URL` remains the restricted application role; the migration URL must use
the distinct, audited `migrationRole` in the non-secret staging manifest, on the
same approved host/database. Both URLs must use port 5432 (or omit it) and exactly
`?sslmode=require`, with no other connection options.

Keep the migration credential in an authorized local migration process only;
do not add it to the application/Preview environment template or client variables.
Never print URLs or filled environment values. This change does not populate any
credentials, authorize a migration, or enable the unverified manifest.

Before activation, independently audit that the application role has restricted
grants and no migration-role membership, and that the migration role cannot access
production. Configuration checks cannot prove database grants or empty provenance.
Those provider checks and all migration execution need separate authorization.

Offline regression command (uses synthetic credentials only):

```powershell
node --import tsx --test src/server/staging/migrationConfig.test.ts src/server/staging/config.test.ts src/server/staging/isolation.test.ts src/server/staging/viteConfig.test.ts
```
