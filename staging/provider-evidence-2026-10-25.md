# Staging provider inventory (2026-10-25)

Status: **NO-GO: provider isolation is not yet verified.** This is a read-only metadata review, not evidence that either Preview or production credentials point to any specific database.

## Vercel

Authenticated project `breaker` (project ID `prj_EoP7acRV8sQtRM4NnzsCQWb7Qlpz`) is available. Custom environments list is empty. The following existing variable **names** are scoped to Production, Preview and Development simultaneously: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL`, `NEON_PROJECT_ID`, plus other Postgres connection variables. Variable values were not decrypted or inspected. Consequently, default Preview cannot be certified isolated. Latest returned deployment is READY but is a non-production Git deployment from `codex/beta-queue-crafting-acceptance`; readiness does not imply staging isolation.

## Supabase

The account returns one project, `Scintel` (`toobryzjjzqnluthoawj`), and lists a `main` branch marked `persistent: false`. No separate persistent staging auth project was observed. This does not prove one cannot be provisioned or that another account cannot hold it.

## Dedicated staging hosting project (created 2026-10-25)

A separate Vercel project `breaker-staging` (`prj_vbJxKdXwkV23mEHHdZMwVb89UMHl`) was created in the existing team, with Vite framework, Preview deployment disabled, and Vercel Authentication configured for all deployment types. A subsequent read confirmed **zero environment variables**, no domain, no deployment, and `live: false`. It is not yet connected to Git or any database/authentication provider. Production Vercel project `breaker` was not modified.

## Dedicated staging Supabase project (created 2026-10-25)

The `Breaker Staging` Supabase project (`bqmqszakdhitogqluels`) was provisioned under the existing Scintel organization (`lagjovryfqpovabhkeot`) in `us-east-1`. The project was quoted at $0/month, confirmation was obtained, and `get_project` returned `ACTIVE_HEALTHY`. Its distinct API/database host is `db.bqmqszakdhitogqluels.supabase.co`; this is **not** the original Scintel project (`toobryzjjzqnluthoawj`). This confirms distinct project identity, but not configured Discord OAuth, persistence tests or provider integration. No production users or credentials were copied.

## Conditions before activation

1. Identify a dedicated, persistent, independently provisioned Neon staging database, restricted application role, separate migration role, and audited production deny lists. Prove real database identity, role memberships/grants, marker ownership and empty/schema-only provenance without sharing credentials.
2. Provision and verify isolated staging Supabase authentication and Discord OAuth callbacks. Do not reuse production auth resources.
3. Establish explicitly isolated Vercel Preview branch scoping or a separate staging project, and review **all effective inherited variables**, aliases, production branch settings and protection controls before deployment.
4. Update the non-secret staging manifest only from verified evidence; keep `verified: false` until checks are complete. Separately authorize schema migrations and deployment only after isolation is proven.
5. Run live readiness and authenticated two-account persistence tests in the isolated environment before beta use.

This review created separate empty Vercel and Supabase staging projects. No existing production project settings, deployments, player data, or credentials were modified; no migration or application deployment was performed.
