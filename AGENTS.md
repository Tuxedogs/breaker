# Moonbreaker Agent Instructions

You are working on Moonbreaker / Scintel.

## Operating Philosophy

Breaker is a solo hobby project, not an enterprise SaaS platform. Optimize for working features, development speed, simplicity, and maintainability. This section takes precedence over conflicting process guidance in other docs, handoffs, or audits.

* No enterprise engineering by default. Do not add abstractions, release gates, CI workflows, frameworks, monitoring, or infrastructure unless the gate below is met.
* Local development stays frictionless. Staging verification, deployment configuration, and production-isolation checks must not block local dev, builds, or tests. Production protections belong at deployment boundaries.
* Staging is a test deployment with isolated data and working authentication. Keep the staging safeguards that already work; do not expand them without justification.
* Prefer the smallest correct solution. No speculative future-proofing, large refactors, or scope beyond the task.
* Testing is proportional to risk. Preserve existing domain tests (calculations, crafting, inventory, data integrity) and add domain tests when domain logic changes. Do not build validation infrastructure for trivial visual changes.
* Urgent work is limited to user-facing failures, data-loss risks, and security problems. Other risks go to the backlog.
* No unsolicited engineering projects. If infrastructure seems necessary, say so in one line in the report; do not implement it.
* Preserve what works. Do not remove infrastructure, tests, or PRs by category; evaluate each on whether it works, whether it creates friction, and what actually needs to change. Never weaken production data isolation, expose secrets, or delete meaningful domain tests.

Adding process or infrastructure requires all of:

1. A demonstrated need, credible risk, or measurable development bottleneck, named in the task or report. Preventing obvious problems qualifies.
2. Complexity proportional to that risk.
3. Tux's approval in the current task.

### Release Policy

There is no broad feature freeze. Normal feature development continues while beta is prepared. Keep each release focused.

Public beta is GO when all of the following are true:

* Discord authentication works end to end on staging.
* Inventory writes persist.
* Production isolation is verified: staging cannot read or write production data.
* Core domain tests pass.
* No known critical security or data-loss issue is open.

Nothing else is a beta prerequisite.

## Repository Locations

* Main UI repository: `D:/Moonbreaker`
* Extraction and source-data repository: `D:/scintel`
* Clean fitting worktree, when explicitly requested: `D:/Moonbreaker-push-clean`

Do not assume work should occur in the clean fitting worktree. Use the repository named in the task.

## Documentation Authority

For operational API, generated-data, publication, and deployment work, use:

* `docs/api-data-flow-runbook.md` for the current extraction-to-endpoint flow, endpoint catalog, publication commands, deployment wiring, and incident response.
* `docs/generated-data-manifest.md` for the concise data-authority and runtime-ownership registry.
* `docs/mission-offer-api-compatibility-manifest.md` for the implemented mission source-v4 / shaped-v3 / offer-v1 contract, compatibility rules, invariants, routes, and validation gates.
* `docs/mission-build-generation-audit-live-4.9.0-fdfd54f65b1f84a621899b21.json` for the pinned Headhunters golden tuples, contradiction ledger, immutable hashes, and current publication receipt. The filename retains the rollback generation ID for audit continuity; read `targetSourceV4.publicationState` for the active generation.

`public/api` is retired and must remain empty. Historical audits and handoffs may describe former static-file paths; preserve those documents as evidence, but do not use them as current operating instructions unless their status explicitly says they are current.

Mission agents must treat `server-data/missions/current.json` as the runtime selector. The current legal tuple is mission schema 3 / source contract 4 / offer schema 1. Schema 2 / source 3 remains a supported pointer rollback only. Never mix versions or edit an immutable generation in place.

For visual work, use `moonbreaker_design_canon.md` as the detailed design authority, `docs/CINEMATIC_VISUAL_DIRECTION.md` as the LOCKED 2026-10-29 cinematic target, and the current page source as functional implementation truth. Page-specific accepted canon remains authoritative for data meaning, behavior, and controls; older visual examples are not a veto on the new target.

## Working Style

* Prefer small, isolated changes.
* Do not blindly follow a proposed solution when it harms usability, maintainability, or correctness.
* Explain important tradeoffs and recommend a better direction when appropriate.
* Do not expand a narrow task into a full-page or cross-system refactor.
* Do not make unrelated cleanup changes.
* Preserve existing behavior unless the task explicitly requests behavior changes.
* Finish migrations by removing superseded ownership paths; do not add wrappers, compatibility layers, or override stacks unless a current external contract requires them.

## Scope Safety

Visual and layout tasks must not change:

* APIs
* Database behavior
* Authentication
* Routing
* Crafting calculations
* Fitting calculations
* Mining calculations
* Material modifier calculations
* Inventory totals
* Reservation logic
* Allocation logic
* Solver behavior
* Production data contracts

If a requested visual feature needs data that does not currently exist:

1. Verify whether the value already exists elsewhere.
2. Reuse the existing source of truth when available.
3. Otherwise document the missing data requirement.
4. Use a deterministic development-only fixture for visual review when appropriate.
5. Do not invent production calculations inside a UI component.

## Data Truth

Do not infer or relabel gameplay data from frontend assumptions.

Modifier, component, crafting, and fitting truth must come from the extracted or server-provided data paths.

Do not duplicate calculations in presentation components when a shared calculation or solver already exists.

Normalize gameplay units and source aliases at the shared schema, service, or projection boundary. Do not apply page-local unit conversions or rename a source field only in JSX.

Treat zero, missing, loading, and unavailable as distinct data states. A valid numeric zero must not be filtered out as absent.

Build Queue component statistics must reuse the shared fitting/component-card delivery paths. Scalar rows, subtype-specific rows, and allocation curves must retain their source semantics; do not flatten an array or curve into an invented scalar.

## Build Queue Ownership

Build Queue mutations use the unified authenticated online persistence path. Do not recreate legacy `/api/user/build-queue` mutation behavior.

`buildQueueReservations.ts` owns physical inventory-lot reservation and availability arithmetic. Selectors and store consumers must derive from that owner rather than duplicate the arithmetic.

Material identity must use the generated material identity dataset through the shared canonicalizer. Do not add independent material alias dictionaries.

Readiness, progress, physical shortage, and planning coverage are distinct derived read models. Reuse their established owners and do not create parallel sources of truth or collapse their meanings.

## Shared Fitting Data

Fitting-detail consumers must route through the shared fitting component store rather than calling the low-level component endpoint directly.

Cache identity must preserve:

* Channel
* Build ID
* Source type
* Normalized component identity

When the persisted response contract expands or changes incompatibly, advance or migrate the persistent cache schema so legacy entries cannot mask newly delivered fields. FPS component cards and vehicle fitting detail remain separate source types.

## Quality Formatting

Never place the letter `Q` before or after a quality value.

Forbidden:

* `Q965`
* `965Q`
* `Q 965`
* `965 Q`

Required:

* `Quality 965`
* `Target 924`
* `Projected 911`
* `Minimum Quality 965`
* `0.42 SCU at Quality 965`

This rule applies to:

* Production UI
* Development fixtures
* Tests
* Screenshots
* Mockups
* Reports
* Documentation
* Agent-written examples

## Inventory and Crafting Terminology

Inventory records should be presented as physical boxes when each record represents a discrete container.

Do not expose backend terminology such as `stack` unless the UI is intentionally showing an aggregate rather than a physical box.

For location-based inventory, the default organizational model is:

`Location → Material → Individual Boxes`

Quality may be used as an intermediate disclosure level inside a material group when it improves comparison. It does not replace the material or individual-box levels.

The Inventory page may offer item-first and grouped-list alternatives, but location-first remains the default operational view.

Other workflows may use a different order when the user’s task requires it:

* Inventory: location first
* Build Queue allocation: craft requirement first
* Reserve selection: material requirement first
* Pull instructions: location and retrieval order first

Do not force one grouping model onto every workflow.

Location names must be understandable to users.

Never expose raw location UUIDs in normal UI.

Use:

* Joined location name when available
* `Unknown Location` when a location ID exists but its record cannot be resolved
* `Unassigned Stock` when no location is assigned

## Physical Box Information

Where relevant, an individual box should clearly communicate:

* Material
* Quality
* Quantity or SCU
* Location
* Availability
* Reservation state
* Owning craft when reserved
* Pull or warehouse state
* Consumption order
* Expected remainder or refund

Do not turn every individual box into a large feature card.

Use compact rows or tiles optimized for scanning and comparison.

States such as available, selected, reserved, unavailable, missing, and completed must not rely on color alone.

## Visual Direction

The product should feel like a dark, premium spacecraft operations interface:

* Dense but readable
* Practical rather than ornamental
* Strong information hierarchy
* Controlled surface depth
* Quiet borders
* Restrained glow
* Compact controls
* No giant empty voids
* No decorative effects that interfere with data

LOCKED (2026-10-29): Breaker's future homepage is a cinematic five-slice module gateway: **Fitting (WIP), Craft, Build, Mine, Inventory**. Fitting is disabled; the other slices enter real existing modules. Each has full-height environmental artwork, softly diffused boundaries, minimal text, and restrained, accessible interactions. Do not recreate the old telemetry-card Dashboard as the new landing design. This is a visual design lock, **not permission to alter production routing or delete existing Dashboard behavior today**.

The approved interactive Mining concept is the new **visual quality benchmark**; the existing Mining implementation remains the **functional and dense-workspace reference**. Mining's segmented Direct Spawn Competition bars are mandatory in the redesigned location detail, between Selected Materials and Other Materials. Retain source-pool separation, actual delivered relative probabilities, canonical material colors, selected/competing roles, linkage, and unrepresented-share semantics. Redesign their appearance, not their mathematics. Preserve `getDisplayedLocationRank`: `T-{value}` signals a tied modeled rank (not a tier), ordinary numerals represent non-ties, and `R{value}` represents route order. Preserve the rank tooltip/accessibility explanation and actual score/coverage tie semantics.

Preserve the shared `--mb-*` palette, `AppPageShell`, the no-hero rule for operational pages, and domain logic. The navigation gateway is a deliberate exception to the operational no-page-header rule. The art creates atmosphere; opaque working surfaces protect readability. No heavy animation, per-module UI palette forks, fake data, or baked-in artwork text.

Detailed rules and implementation sequence are in `docs/CINEMATIC_VISUAL_DIRECTION.md` and `moonbreaker_design_canon.md`; read them before any homepage or module redesign.

## Styling rules (enforced by `npm run style:check`)
- The only styling vocabulary is the `--mb-*` tokens in src/styles/tokens.css.
- Never add hex/rgb/hsl colors, raw font-family, raw border-radius, `!important`,
  or new custom properties outside tokens.css. The style ratchet fails the build if you do.
- One interactive accent: `--mb-accent` for selection, focus, active. Semantic colors
  (`--mb-good`, `--mb-bad`, `--mb-warn`, `--mb-info`) carry meaning only, never decoration.
- No command/page header on **operational modules**. `AppPageShell` owns their full-height working content; do not add `CommandHeader`, page titles, heroes or banners above the workspace. The approved cinematic **homepage gateway is the explicit navigation-only exception**.
- Mining's **existing implementation** is the functional and compact-control reference. The owner-approved cinematic prototype is the **new visual direction** (see `docs/CINEMATIC_VISUAL_DIRECTION.md`). Crafting is the reference only for
  the detail drawer/dialog, long-form detail sections, mobile filter sheet and charts; never
  copy its colors, fonts, spacing or known issues (see `moonbreaker_design_canon.md`).
- Do not read from or copy styles out of src/archive or src/pages/_archive.
- A styling task is done only when `npm run style:check` passes and you ran
  `node scripts/style-ratchet.mjs --update` to lock in reductions.

## UI Implementation Rules

For visual work:

* State the exact page and component scope.
* Preserve all behavior and calculations.
* Use existing shared tokens and components where appropriate.
* Do not create a new global primitive for a single-page experiment.
* Do not spread page-local styling into unrelated pages.
* Keep Build Queue styling on its single canonical stylesheet path; do not restore redesign/legacy dual layers.
* Keep Mining styling on its single canonical stylesheet path; do not import the full Recipe Browser stylesheet into Mining.
* Check both populated and empty states.
* Check long names, many rows, and overflow behavior.
* Avoid hiding important data merely to simplify layout.
* Keep peer workflow regions as peer surfaces; do not nest a full statistics or allocation workspace inside an identity header.

For layout or responsive changes, inspect:

* `1920×1080`
* `2560×1440`
* `3840×2160` for Recipe Browser or Crafting Detail changes

Check mobile when the affected component already supports mobile or when the task explicitly requests it.

For an existing responsive logistics hierarchy, use `768×900` as the standard compact review viewport unless the task specifies another size.

## Visual Validation

Scale visual validation to the change.

Layout and component changes require:

* A populated state (existing fixture or real data)
* Review at the relevant resolutions
* Inspection of hierarchy, overflow, clipping, contrast, and density

Small visual tweaks (color, spacing, copy, a single control) need a quick check of the affected page, not a fixture or multi-resolution pass.

Do not claim a visual task is complete solely because the build passes.

## Recipe Browser Behavior

Recipe Browser search and filters have a deliberate precedence:

* Manual text search spans the full component inventory and overrides selected filters.
* Results outside the selected filters remain visible with an informational `Non-Filter Match` badge.
* Clearing search restores the selected filters.
* When an FPS weapon and its magazine both match a weapon search, the weapon is the preferred selected result.

Do not change this precedence while adjusting presentation. Material lookup, bookmarks, pagination, queue state, selection, and detail routing must remain functional.

Family tables use source-backed sortable columns. Ship DPS routes through the shared weapon-stat resolver. Radar power-pip and aim-assist range columns use delivered component-card fields; do not recreate them in JSX.

Crafting Detail material rows use `Material | Required | Target | Input | Effect`. The editable `Target N` badge belongs in Target and the 1–1000 control belongs in Input. Do not restore a redundant Quality column or `Band N` cell.

## Validation

Run the checks relevant to the changed area.

At minimum for TypeScript, React, or stylesheet changes:

```bash
npm run lint
tsc -b && npm run build:isolated-ui
```

`npm run dev`, `npm run build`, and `npm run preview` use `vite.local-fixtures.config.ts` and need no staging credentials. The guarded staging build is `npm run build:staging`; it refuses outside the verified Vercel staging Preview by design, and Vercel runs it as the build command. That refusal is not a blocker to report.

Local Playwright configs start only `vite.local-fixtures.config.ts`; `npm run test:playwright-configs` enforces this. Known fixture gaps are listed in `docs/KNOWN_TEST_FAILURES.md`.

Also run targeted tests when the changed code has an existing test suite.

Report:

* Files changed
* Behavior changed
* Behavior intentionally preserved
* Tests run
* Build result
* Screenshot or fixture route used, for layout or component changes
* Any unresolved visual or data limitations

## Stop Conditions

Stop when the requested scope is complete.

Do not continue into:

* Global theme implementation
* Unrelated page cleanup
* Architecture migration
* API redesign
* Calculation changes
* Additional speculative features unless the task explicitly requests them.

## Codex Orchestration

The primary Codex session is the orchestrator. Reuse the project-scoped roles in `.codex/agents/` only when their bounded expertise will cost less than direct work. The durable routing, handoff, vault-memory, and recovery rules are in `docs/agents/HIERARCHY.md`, `docs/agents/HANDOFF_CONTRACT.md`, and the authoritative vault note `D:\Vaults\Star Citizen Projects\Projects\Breaker\20 Architecture\Codex Orchestration.md`.

Before a non-trivial task, establish the actual repository, worktree, branch, HEAD, and dirty state. Do not assume that the current directory is the intended worktree. Preserve unrelated WIP, particularly the active Mining workstream and the paused Fitting V2 checkpoint.

Use the Obsidian vault as durable project memory, not chat summaries. Start from the hub and relevant concise index note; read the smallest set of task-relevant notes and current repository evidence. Vault notes record decisions, current state, ownership, and checkpoints; source code and accepted runtime selectors remain the authority for executable behavior and live data.
