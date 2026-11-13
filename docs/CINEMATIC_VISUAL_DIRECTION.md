# Breaker cinematic visual direction

**Status: LOCKED design target, owner-approved 2026-10-29.** This specification records a visual decision, not implementation, merger, deployment, or acceptance of fictional mockup statistics.

## Authority

Read `AGENTS.md` and `moonbreaker_design_canon.md` before changing a page. This file governs the new cinematic visual goal. `src/styles/tokens.css` and `AppPageShell` remain implementation authorities; Mining's existing React code, source-backed data and `docs/mining-ui-design-spec.md` remain the functional and data-presentation baseline.

The five-slice homepage concept and interactive Mining mockup approved in the 2026-10-29 conversation are the **visual benchmark**: atmospheric industrial art, controlled depth, exceptional contrast, compact typography and purposeful spatial design. They are concept reviews, not exported, production-licensed or automatically available assets. Where original and mockup differ, retain real application behaviors and the truth of source values, but work toward the approved new look. Do not treat yesterday's screenshots as a forever-frozen aesthetic.

## Homepage: a five-slice navigation gateway

- Replace the old metric-heavy Dashboard **as the future home design**, when implementation is explicitly tasked. This approval does not authorize silently deleting the live Dashboard or changing routes today.
- Present five image-led vertical slices in this order: **Fitting (WIP), Craft, Build, Mine, Inventory**. At wide desktop widths all five remain visible. The ~440 px per slice reference assumes a roughly 2200 px content width; use responsive proportions instead of hard-coded 440 px widths or horizontal clipping.
- Artwork occupies the full height of each slice, with recognizable subjects: Fitting ship/hangar, Craft fabrication, Build production infrastructure, Mine asteroid extraction, Inventory warehouse/freight. Maintain photographic/cinematic sci-fi realism and a consistent industrial world.
- Separate slices with thin rules, soft diffusion, hazy color bleed and subtle atmospheric lighting. Distinct environmental color moods are allowed in **artwork**, but must not become competing UI interaction palettes. `--mb-accent` remains cyan for focus, selection and controls.
- Keep the overlay minimal: module name, concise action/purpose label, modest arrow/enter affordance, and WIP status where applicable. Render every label and control as HTML, not embedded in artwork. Strong gradient protection only where readable overlay text requires it.
- Avoid scroll-driven effects, autoplay, parallax, large motion, or animated panel reflow. Only tiny optional hover/focus lighting changes or an unobtrusive expanded explanation, without layout shifts. Respect reduced-motion settings.
- Craft, Build, Mine and Inventory navigate to existing real destinations. Fitting must be explicitly **WIP / unavailable** to users, with no misleading navigable action until its actual implementation is released.
- Support keyboard focus, touch input, screen readers, and an intentional narrow-screen composition. Do not squeeze five desktop columns into illegible slivers on mobile.

**Exception:** this cinematic *navigation gateway* may use prominent page-level environmental artwork and names. Active operational pages still use the full-height `AppPageShell` workspace **without a decorative page heading or extra hero band**.

## Module pages: atmospheric frame, operational core

- Maintain dense professional workflows. Surround the working area with composed environmental art, vignette, lighting and negative space; let imagery recede beneath sufficiently opaque tables and controls. Do not turn data workspaces into transparent-glass marketing cards.
- Mining is first design pilot. Preserve its **Filters & Materials -> Ranked Locations -> Location Detail** composition and all existing UI affordances: system filters (Stanton, Pyro, Nyx), Explore/Queue/Saved, material index, route strategies, rankings, bookmarks, search, coverage, selected/other resource tables, loading and empty/error states.
- **Location list rank notation is essential:** preserve the existing `getDisplayedLocationRank` presentation, with `T-{value}` for genuinely tied modeled ranks, ordinary numeric ranks for non-ties, and `R{value}` for route-ordered stops. `T` means *tie*, not a mining tier. Equal raw scores alone are insufficient when active queue coverage differs. Keep informative hover/focus tooltips and accessible labels; do not replace this with ordinal numbers or decorative tier chips. The presentation is source/model-derived, not new front-end scoring.
- **Direct Spawn Competition bars are essential and must not be removed.** They belong in the selected Location Detail *after Selected Materials and before Other Materials*. Style them to the new atmospheric visual system: one elegant, compact horizontal segmented distribution per source pool; subdued track and thin hairlines; legible value and material legend; crisp target highlights, quieter but still identifiable competitors, subtle hover/focus linkage, and enough dark backing to keep every color readable. No gratuitous glow and no conversion into generic completion bars.
- The bars are **source-backed comparisons**, not decorative charts: keep `buildMiningLocationCompetitionPools` / `miningCompetitionPresentation.ts` ownership, shared canonical material colors, role labels and linked focus behavior. Preserve Hand / Vehicle / Surface Ship pool boundaries. Use each delivered `relativeProbability` in percentage points; never renormalize partial pools to 100%, combine selected targets into an invented chance, manufacture missing competitors or treat missing/zero/unavailable as identical. Show unrepresented share where known and do not fake a remainder when unknown. A material absent from a location must not create a competition row. Render pools only with available source data.
- Same typography, spacing, neutral graphite/navy UI surfaces, compact controls, and semantic state tokens across modules. Distinct environmental identities: Mining extraction, Craft fabrication, Build industrial logistics, Inventory storage/freight, Fitting hangar/ship engineering (while WIP).
- Preserve real data, calculations, data contracts, persistence, recommendation semantics, routing, authentication, queue actions and responsiveness. Illustrative demo values must never escape the prototype.
- The interactive surface and the art remain **separate assets**. No UI labels, numbers, buttons or decorative fake indicators baked into production bitmaps.

## Implementation and review contract

1. Use a dedicated branch/worktree; do not overwrite unrelated active work or merge straight to release. First inspect actual working tree, branch and dirty status.
2. Prepare production-safe image-only assets for desktop/mobile with composition-specific crops and negative space, image rights/provenance checked, efficient formats and appropriate fallbacks. Concept art alone is not a completed asset handoff.
3. Implement the homepage as a navigation surface; handle WIP and mobile/keyboard states. Implement Mining as a visual pilot against **real existing React components, hooks and data**. Do not re-create mining mathematics in JSX or lift demo fixtures into production.
4. Compare screenshots against the approved concepts in populated, empty, loading and dense states, at 1920x1080, 2560x1440, and compact/mobile widths including ~390 px. Verify contrast, cropping, scanning speed, overflow, focus, and competition-bar meaning.
5. Check `npm run style:check` and other targeted repo validations proportional to the change. Preserve `--mb-*` tokens and CSS ownership. Never introduce a parallel style stack or broad per-page overrides.
6. Obtain owner review of the visual pilot before propagating across Craft, Build and Inventory. Do not claim this target is already implemented just because it is documented.

### Explicitly rejected

- Carrying the former Dashboard's telemetry-card layout forward as the desired landing screen.
- Replacing existing mining workflow or its competition bars with cinematic decoration.
- Five separately colored interface themes, large translucent floating cards, fake operational metrics, constant animation, or images with baked-in UI.
- Reversing style-unification or weakening data/security safeguards to make a screenshot look right.
