# Scintel / Moonbreaker — Claude Context

Updated: 2026-10-29 (cinematic design lock)

@AGENTS.md

`AGENTS.md` (imported above) is the repository-wide working and safety authority, including its Operating Philosophy. Where this file conflicts with it, AGENTS.md wins.

For visual work, use `moonbreaker_design_canon.md` as the design authority and `docs/CINEMATIC_VISUAL_DIRECTION.md` as the owner-approved LOCKED 2026-10-29 visual target. The current Mining implementation remains the functional baseline, not the final visual ceiling. Do not recreate or override shared palette, hierarchy, terminology, quality-formatting, or validation rules here.

For operational API, generated-data, publication, and deployment work, use `docs/api-data-flow-runbook.md` and `docs/generated-data-manifest.md`. `public/api` is retired and must remain empty; treat older audits and handoffs that describe static files there as historical evidence rather than current operating instructions.

## Project Overview

Scintel is a Star Citizen organization dashboard and companion tool suite. It includes:

- Dashboard and operational handoffs
- Doctrine and knowledge-base content
- Logistics: Inventory, locations, Build Queue, and refinery import
- Industry crafting
- Fitting and component-performance views
- Combat tools, including Alpha Threshold and Component Mapping
- Ship maps and visualization

## Stack

- React 19, Vite 7, and strict TypeScript
- React Router 7
- Zustand stores
- Tailwind CSS plus substantial page-scoped custom CSS
- Framer Motion
- React Three Fiber and Three.js where ship visualization requires them
- MDX content under `content/`

Preserve the existing custom CSS and lazy route boundaries. Do not add dependencies or migrate page styling systems without explicit approval.

## Key Areas

- Dashboard: `src/pages/DashboardPage.tsx`, `src/components/dashboard/`
- Logistics: `src/pages/logistics/`, `src/components/logistics/`
- Crafting: `src/pages/industry/`, `src/components/industry/crafting/`
- Shared crafting and fitting projection: `src/lib/crafting/`, `src/lib/fitting/`
- Alpha Threshold: `src/tools/alpha-threshold/`
- Application routes: `src/App.tsx`
- Data import and generation: `scripts/`
- Client stores: `src/stores/`

## Decision log
LOCKED = agents must not revisit it. Ideas to change a LOCKED item go in docs/DESIGN_BACKLOG.md
and work continues. The owner unlocks one by writing "unlock #N" in chat. Backlog is reviewed
weekly, never mid-task.

| # | Decision | Status |
|---|---|---|
| 1 | Existing Mining is the functional control/density reference; the 2026-10-29 cinematic design is the visual target; Crafting supplies specific drawer/dialog/chart patterns | LOCKED |
| 2 | Cyan is the single structural accent; good/bad/warn/quality keep their meaning | LOCKED |
| 3 | Operational pages have no headers and use full-height AppPageShell; the cinematic home navigation gateway is the explicit exception | LOCKED |
| 4 | Shell gutter is --mb-shell-padding (8px) and the only outer spacing | LOCKED |
| 5 | Frozen pages: Blueprint Tracker, Armor/Alpha Threshold, Doctrine | LOCKED |
| 6 | Radius scale: sm 2px controls, md 4px panels, lg 6px floating layers | OPEN until you reply "lock it", then LOCKED |
| 7 | Section label + hairline breakup component: opt-in, rules above | OPEN until first use, then LOCKED |
| 8 | Fonts: Segoe UI (system-ui fallback) is the single UI, display and numeric face, matching V31 as rendered; hierarchy comes from V31 sizes, weights and spacing; numeric data uses tabular numerals; mono Share Tech Mono for IDs/codes only; no Inter, Rajdhani or Roboto Mono | LOCKED 2026-11-05 (owner decision) |
| 9 | Local runs use only vite.local-fixtures.config.ts; the staging guard is never loosened; release verification happens on the Vercel staging Preview | LOCKED |
| 10 | style/unify never merges directly into a release branch; a landing plan (what lands, what is excluded) is required first | LOCKED |
| 11 | Home direction: cinematic 5-slice navigation gateway (Fitting WIP / Craft / Build / Mine / Inventory); minimal motion; existing Dashboard remains live until implementation explicitly tasked | LOCKED 2026-10-29 |
| 12 | Mining cinematic visual pilot must retain Direct Spawn Competition bars, meaningful `T-{rank}` ties, ordinary non-tied ranks, and `R{position}` route ordering, using existing source truth | LOCKED 2026-10-29 |

## Current Architecture Snapshot

- Build Queue uses a compact queue rail and three peer workspace regions: selected craft, Component Statistics, and Material Allocation.
- Component statistics flow through shared fitting or component-card delivery, then shared projection/view-model code. Presentation components must not recreate calculations, aliases, or unit conversions.
- Fitting-detail consumers use the shared component store. Cache identity preserves channel, build ID, source type, and normalized identity; the persistent cache schema must advance when the response contract changes incompatibly.
- Inventory defaults to Location → Material → Quality → Individual Boxes, with item-first and grouped-list alternatives.
- Discrete inventory records are physical boxes in user-facing language. Legacy aggregate records must be labeled as aggregates.
- Recipe Browser uses a permanent horizontal filter bar, search-over-filter precedence with `Non-Filter Match` disclosure, sortable family tables, and a peer detail drawer at wide desktop widths.
- Crafting Detail has full-page and wide-screen drawer presentations. Both reuse the same delivered recipe and shared component-stat paths; the drawer provides Overview, Materials, and Statistics tabs plus an explicit route to full details.
- Full-page Crafting Detail uses Build Queue-style compact statistics, `Material | Required | Target | Input | Effect`, and charts below Material Requirements.

For the current Crafting implementation map and validation contract, read `docs/crafting-browser-detail-handoff.md`.

## Styling rules (enforced by `npm run style:check`)
- The only styling vocabulary is the `--mb-*` tokens in src/styles/tokens.css.
- Never add hex/rgb/hsl colors, raw font-family, raw border-radius, `!important`,
  or new custom properties outside tokens.css. The style ratchet fails the build if you do.
- One interactive accent: `--mb-accent` for selection, focus, active. Semantic colors
  (`--mb-good`, `--mb-bad`, `--mb-warn`, `--mb-info`) carry meaning only, never decoration.
- No command/page header on **operational pages**. `AppPageShell` owns their full-height working area; do not add `CommandHeader`, page titles, heroes or banners above workspace content. The cinematic **home navigation gateway is the explicit exception**, not a module-page template.
- Mining's **existing implementation** is the functional density/control reference; the cinematic homepage and Mining prototypes are the visual-quality target (see `docs/CINEMATIC_VISUAL_DIRECTION.md`). Crafting is the reference only for
  the detail drawer/dialog, long-form detail sections, mobile filter sheet and charts; never
  copy its colors, fonts, spacing or known issues (see `moonbreaker_design_canon.md`).
- Do not read from or copy styles out of src/archive or src/pages/_archive.
- A styling task is done only when `npm run style:check` passes and you ran
  `node scripts/style-ratchet.mjs --update` to lock in reductions.

## Working Rules

- Prefer small, isolated diffs and preserve behavior outside the requested scope.
- Keep APIs, persistence, routing, calculations, solvers, and production data contracts unchanged during visual tasks.
- Use shared tokens and components when they already fit; keep workflow-specific layout page-scoped.
- Distinguish zero, missing, loading, and unavailable states.
- Never invent source data or production calculations to complete a visual.
- Scale visual validation to the change (see Visual Validation in AGENTS.md): layout and component changes need a populated state and review at the relevant resolutions; small tweaks need a quick check of the affected page.
- Run `npm run lint` and `npm run build` (the local fixtures build) for TypeScript, React, or stylesheet changes, plus targeted tests for the changed area.
- `npm run dev`, `npm run build` and `npm run preview` use `vite.local-fixtures.config.ts` (same as the `:isolated-ui` scripts) and need no staging credentials. The guarded staging build is `npm run build:staging` (`vite.config.ts`); Vercel runs it via `buildCommand` in `vercel.json`, and it refuses locally ("Staging isolation is unverified") by design.
- Local Playwright configs start only `vite.local-fixtures.config.ts` (enforced by `npm run test:playwright-configs`). Known fixture gaps are listed in `docs/KNOWN_TEST_FAILURES.md`.
