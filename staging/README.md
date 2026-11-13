# Permanent Breaker staging preparation

Status: NO-GO for activation. Local preparation and read-only Vercel/Supabase metadata inspection are complete; full provider isolation evidence is missing. See `provider-evidence-2026-10-25.md` for observations, including shared Preview database variable scopes. No provisioning, secret changes, migration, push, or deployment has been authorized.
Dedicated local branch `staging` starts at PR #50 candidate
`83eddd4b1cd2117a38b92bf7e7b4687e87b654f6`. No push, deployment, merge, or provisioning is authorized.
This branch's environment policy is intentionally staging-only; do not merge these safeguards into production.

## Activation gates (all required)

1. Vercel connector read access is available for team `produtux` (`team_zKjphtz5f6tksxfoXvtQ7giP`),
   and metadata was inspected without decrypting variables. Existing project `breaker`
   (`prj_EoP7acRV8sQtRM4NnzsCQWb7Qlpz`) has database variable names targeting Preview and Production.
   Record its actual production
   branch, repository link, deployment protection, branch alias, and the effective names/scopes of every
   inherited Preview variable. Do not export or print secret values.
2. Supabase connector metadata inspection identified the existing Scintel project but no separate persistent staging project. Neon provider inventory still requires verification. CLIs are optional;
   dashboard/API access suffices. Record production Supabase project references and Neon endpoint/role
   identities as deny lists. Do not connect to production databases or copy their write credentials.
3. Select a separate, persistent Supabase auth project and an empty, persistent Neon staging resource.
   No paid provisioning without explicit approval. Use a new empty database/project or verified schema-only
   root branch, never an ordinary data-copy branch from production. Confirm no expiration/reset automation.
   Inspect role grants/memberships and ensure staging cannot access production. Apply only reviewed schema
   migrations after separate authorization. Never copy actual player records or production auth users.
4. Configure staging-only Discord OAuth in that Supabase project. This app requires a Discord identity;
   email-only synthetic users do not satisfy its auth contract. User handles OAuth consent and provider
   credentials. Supabase Site URL = verified stable staging origin; allow its exact `/auth/callback`.
   Discord provider callback = staging Supabase project's `/auth/v1/callback`. Do not alter production OAuth.
5. Review `environment.template`. Every resource key must override generic Preview values for **Git branch
   staging only** in the existing project. Audit inherited integration aliases too: PG*, POSTGRES_*,
   DATABASE_URL_UNPOOLED and service-role keys are rejected. Do not remove shared or production variables
   to make this pass; if necessary plan staging-specific handling and re-review before activation.
   Confirm production and staging secret credentials differ without logging them. Secret changes require
   explicit user authorization; none have been performed. Do not create a paid custom Vercel environment.
6. Create the identity table with a separate staging migration role (`identity.template.sql`). Give the
   application role SELECT only on its marker, required DML on app tables, and no elevated role memberships.
   Verify the empty database's provenance and grants independently: the marker alone is not proof that a
   resource lacks production records or permissions.
7. Fill non-secret identities in `src/server/staging/manifest.ts` from verified provider metadata; set
   `verified: true` only after all preceding gates pass. Record the audit evidence and timestamp in this file's
   accompanying review. Empty identity fields and absent production deny lists are blocked deliberately.
8. Obtain explicit authorization before pushing/deploying. First verify that `staging` is NOT the production
   branch. Use branch-specific Preview in the existing project. No production flags, aliases, promotion or
   beta merge. Verify both immutable deployment and stable branch URLs after deployment; do not guess URLs.

## Local validation (no provider access)

```powershell
node --import tsx --test src/server/staging/config.test.ts src/server/staging/isolation.test.ts src/server/staging/viteConfig.test.ts
npm run lint
npx tsc -p tsconfig.app.json --incremental --tsBuildInfoFile .cache/staging-app.tsbuildinfo
npx tsc -p tsconfig.node.json --incremental --tsBuildInfoFile .cache/staging-node.tsbuildinfo
npm run build:staging
node --import tsx --test src/lib/logistics/buildQueueReservations.test.ts tests/logistics/inventoryTransferPersistenceContract.test.ts
npx playwright test --config=playwright.staging.config.ts --list
```

`npm run build:staging` is expected to refuse the unverified manifest. Vercel runs it through `buildCommand`
in `vercel.json`; Vite builds with `vite.config.ts` also enforce the gate, even if Vercel's project build command
remains `vite build`. Plain `npm run dev`, `npm run build` and `npm run preview` use the local fixtures config
(see `LOCAL-UI-WORKFLOW.md`) and never load `vite.config.ts`. All `vite.config.ts` dev and preview commands are disabled before environment loading, including
`vite --mode production` and `vite preview --mode production`. This branch has no Vite API proxy or
local API middleware. Only production-mode builds proceed to the existing staging isolation gate;
use the verified Vercel staging Preview for runtime validation.
Database client configuration is checked before connection; authenticated API requests verify the actual
database name, role, restricted privileges, identity marker and staging Discord service before profile writes.
`GET /api/staging/isolation` returns only readiness/environment/candidate, or HTTP 503, with no secret values.
This route is a readiness probe, not a substitute for auditing provider routing and effective scopes.
When dependencies are linked from the main checkout, `npm run build` can also encounter sandbox permission
errors writing TypeScript/Vite caches under that shared dependency directory. The explicit TypeScript commands
above put caches inside this worktree; `npx vite build --configLoader runner` verifies the build gate without
writing Vite's bundled-config cache there. A blocked build is not a successful artifact build.

## Authenticated persistence harness (after explicit activation authorization)

Use two dedicated synthetic Discord test accounts. Log into the verified staging origin manually and save
each Playwright browser storage state under the ignored `artifacts/` directory. Do not commit these files,
tokens, account identifiers, or provider keys. No automated OAuth authorization is attempted by the harness.
Set these environment variables in the local process, without echoing their values:

- `STAGING_BASE_URL`: exact approved manifest origin.
- `STAGING_ACCOUNT_A_STATE`, `STAGING_ACCOUNT_B_STATE`: absolute paths to the two login-state files.
- `STAGING_SUPABASE_ANON_KEY`: staging public anon key, used for live session validation.

```powershell
npx playwright test --config=playwright.staging.config.ts
```

The test refuses unapproved metadata and failed readiness before opening accounts or issuing writes. It
checks real Supabase Discord sessions, unauthenticated API rejection, creates a uniquely tagged synthetic
physical box and queue reservation through unified persistence, reloads the browser, and checks server
state and exact box/reservation identity. Account B cannot list or delete A's records. A finally block deletes
only this run's queue item, queue, box and location, including IDs recovered after a partial create, then
verifies their absence. No bulk wipe, account deletion, or arbitrary cleanup endpoints exist.
Test profiles and sync metadata created by login remain on dedicated test accounts; authorize any account
retirement separately. If the network/auth expires during cleanup, the test fails; use the unique run ID to
review and remove only its records after service recovery. Never retry cleanup against another origin.

Traces, screenshots and video are disabled to avoid capturing sessions/player-like data. The browser blocks
off-origin network traffic except the approved staging Supabase service. The synthetic reservation probes
persistence; it does not claim to exercise recipe selection or the Build Queue allocation UI. Shared
reservation arithmetic is covered separately by its local domain tests. A manual acceptance pass must also
log in, create a box in Inventory, reserve it through Build Queue, reload, switch accounts and confirm UI
availability/reservation state before release acceptance. No live result is implied by test discovery.

## References

- https://vercel.com/docs/environment-variables/manage-across-environments
- https://vercel.com/docs/cli/env
- https://neon.com/docs/get-started-with-neon/workflow-primer
- https://supabase.com/docs/guides/auth/redirect-urls
