---
name: Phase 6 backend deferred
description: Phase 6 (Supabase + Discord OAuth backend) is planned but deferred until frontend feature surface stabilizes
type: project
---

Phase 6 backend implementation is deferred. Full plan is documented at `docs/phase-6-backend-plan.md`.

**Why:** Frontend feature surface not yet stable — adding a backend now would create churn as pages and data shapes continue to change.

**How to apply:** Do not implement Supabase, auth context, or database hooks until the user explicitly resumes Phase 6. When they do, start from the migration order in the plan doc (infrastructure → reference data → locations → inventory → build queue).

**Current focus:** Frontend product completion — navigation gaps, remaining feature pages, polish, missing tools.
