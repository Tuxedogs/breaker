# Legacy page retirement audit

Date: 2026-10-27. Worktree: `D:/Moonbreaker-deprecate-legacy`.
Branch: `chore/deprecate-legacy-pages`; starting HEAD: `368c507bd281dd4a168e193b275e435c4bb3a2e6`.
The worktree started clean. No commit, push, merge, PR, deployment, publication, or other-worktree modification was performed.

## Dependency audit before removal

Read `STYLE_UNIFICATION.md`, App routes, sidebar, top bar, mobile menu, old AppNav/AppShell, Fitting rail, Build Queue acquisition links, page imports, UI tests, package scripts, and current mission compatibility manifest. Consulted the vault hub and Crafting Blueprints + Missions index for context; repository consumers determined deletion safety.

- Blueprint Tracker: its route wrapper, implementation (including exported fallback icon), and stylesheet had no other presentation consumers. Removed those modules. Kept `blueprintTrackerStore.ts`, `userBlueprintTracker.ts`, saved-blueprint services, persistence keys, and server endpoints; retirement does not delete user state.
- Missions: only the two App route entries loaded `MissionBrowserPage.tsx`. Its six CSS files were page-owned. Shared Recipe Browser CSS remains because Crafting owns it. `ComponentRecipeTable.tsx` still calls `/api/missions/variant/:id` to enrich blueprint reward information: all mission services, schemas, immutable generations/selectors, eligibility, offer projections, compatibility helpers, URL helpers, and tests remain intact.
- Build Queue: `BlueprintSourceDisplay` was the only surviving rendered cross-page mission link. It still loads and displays the same source-backed mission names, fallback text, and tooltips, deduplicated by the same concept/mission identity. Names are now text rather than links to a retired detail page. Allocation, quality, availability, totals, and reservations are unchanged.
- Armor Threshold: Fitting's `ShipHeroPanel.tsx` and `fittingMockupAdapters.ts` import `tools/alpha-threshold/lib/ships/thumbnail.ts`. Preserved that helper, image map, types, all calculations/data/import tooling, and domain/state hooks. Removed only TSX presentation modules, their CSS tree, and the page export barrel.
- Component Mapping: no external consumer of its TSX presentation subtree was found. Removed that subtree and its page barrel export; retained all `.ts` models, datasets, state hooks, calculation/helper modules, and shared icon components.
- Global CSS: `src/index.css` also imported old Alpha Threshold and Gunnery styles. Alpha stylesheet class names had no surviving TSX consumers. Every Gunnery rule selector (including nested media rules) was scoped to `.gun-*` or `.cmap-*`; no surviving active page uses those prefixes. Removed those imports/styles. Shared stylesheets only lost retired body/page-shell selectors; active-page declarations are unchanged.
- Packages: dependency declarations and lockfile are unchanged. No package uninstall or cross-system cleanup was attempted. Supabase authentication, post-auth redirect allowlist, staging isolation, build guards, APIs, and generated/publication data were not edited. Old mission URL helpers remain compatibility utilities; they no longer have rendered page consumers and old URLs resolve via explicit redirects.

## Redirect inventory

All redirects use React Router `Navigate` with `replace`, retain the query string following existing redirect conventions, and do not carry the retired detail slug or fragment into the destination. A retired mission detail is not mapped to an invented Crafting selection.

| Retired URL | Active destination |
| --- | --- |
| `/industry/blueprint-tracker` | `/industry/crafting` |
| `/industry/missions` | `/industry/crafting` |
| `/industry/missions/:missionSlug` | `/industry/crafting` |
| `/dashboard/doctrine/armor-threshold` | `/dashboard` |
| `/doctrine/armor-threshold` | `/dashboard` |
| `/tools/alpha-threshold` | `/dashboard` |
| `/combat/component-mapping` | `/fitting` |
| `/tools/component-mapping` | `/fitting` |
| `/tools/gunnery` | `/fitting` |

Removed corresponding desktop/sidebar, mobile Bookmarks, old AppNav, and Fitting rail links. Doctrine, Crafting, Fitting, Mining, Logistics, Wikelo and other active routes remain. The style plan no longer schedules retired surfaces. Historical audits, source notes and screenshot artifacts remain historical evidence, not operating instructions.

## Validation and limits

- Cached install: `npm ci --offline --ignore-scripts --no-audit --no-fund` succeeded; no lockfile change.
- `git diff --check`: passed (Git emits an LF/CRLF normalization notice for the ratchet JSON).
- `npx tsc -b`: passed. An initial stale `href` deduplication reference was corrected to its equivalent stable identity.
- `npm run lint`: passed.
- `node scripts/style-ratchet.mjs --update`, then `npm run style:check`: passed; only reductions locked in (5462 color literals / 68 raw fonts / 776 raw radii / 244 important / 786 local tokens).
- `node --test --test-isolation=none tests/legacy-page-routes.test.mjs`: 9 passed. Parses real App routes and executes their actual redirect helpers with a router-location stub. Confirms active destinations, query retention and `replace`; this is not browser-history proof. An initial test parser omitted paired JSX Route elements; corrected the parser and all nine passed.
- `node --import tsx --test --test-isolation=none scripts/missions/mission-offer-ui-compatibility.test.ts`: 5 passed.
- `node --import tsx --test --test-isolation=none server/routes/missions.routes.test.ts src/lib/logistics/buildQueueReservations.test.ts`: 14 passed. Node-only reservation tests emitted the expected unavailable-browser-storage warning.
- Default Node test process isolation initially failed with `spawn EPERM`; running these same tests in-process succeeded, without changing application or staging guards.
- `npm run build`: TypeScript completed; Vite stopped at the unchanged guard with `Staging isolation is unverified; refusing access.` Bundle generation is blocked, not passed. No guard bypass or isolated alternative build was used.
- `npm run ui:legacy-routes`: blocked before browser execution by `spawn EPERM`. The normal Vite dev command is also explicitly disabled by the unchanged branch guard. No browser/history/manual layout proof is claimed.
- New browser suite covers the nine redirects, history replacement, and navigation at 1920x1080, 768x900 and 393x852. Planned screenshots: `artifacts/legacy-retirement/navigation-{1920,768,393}.png`. None were generated. Existing mobile-menu and Build Queue source-label expectations were updated; their browser suites were not executed because local browser/server verification is blocked.
- No active page was restyled. Populated/empty active-page rendering, overflow, contrast and screenshot comparison remain unverified. Review the diff and run browser checks in an authorized guarded environment before accepting visual equivalence.

## Exact changed files

Status is relative to the starting HEAD; new files are listed as A. This inventory includes this report. The Playwright config is replaced with the retirement suite config, and obsolete mission-only browser suites/configs are deleted. No screenshot binary changed.

```text
M	docs/STYLE_UNIFICATION.md
A	docs/legacy-page-retirement.md
M	docs/mission-offer-api-compatibility-manifest.md
M	package.json
A	playwright.legacy-routes.config.ts
D	playwright.mission-offers.config.ts
D	playwright.missions.config.ts
M	src/App.tsx
M	src/components/AppNav.tsx
M	src/components/AppShell.tsx
M	src/components/dashboard/DashboardSidebar.tsx
M	src/components/dashboard/DashboardTopBar.tsx
M	src/components/dashboard/MobileIndustryNav.tsx
M	src/components/fitting/mockup/FittingRail.tsx
D	src/components/industry/crafting/BlueprintTrackerPage.tsx
D	src/components/industry/crafting/blueprint-tracker.css
M	src/components/logistics/BuildQueueGroup.tsx
M	src/index.css
D	src/pages/industry/BlueprintTrackerPage.tsx
D	src/pages/industry/MissionBrowserPage.tsx
D	src/pages/industry/mission-browser-cards.css
D	src/pages/industry/mission-browser-modal.css
D	src/pages/industry/mission-browser-responsive.css
D	src/pages/industry/mission-browser-shell.css
D	src/pages/industry/mission-browser-workspaces.css
D	src/pages/industry/mission-browser.css
D	src/styles/alpha-threshold.css
M	src/styles/components.css
M	src/styles/dashboard.css
D	src/tools/alpha-threshold/AlphaThresholdToolPage.tsx
D	src/tools/alpha-threshold/alpha-onboarding-modal.css
D	src/tools/alpha-threshold/components/AlphaThresholdMobileOnboardingTip.tsx
D	src/tools/alpha-threshold/components/AlphaThresholdOnboardingCoachmarks.tsx
D	src/tools/alpha-threshold/components/AlphaThresholdOnboardingModal.tsx
D	src/tools/alpha-threshold/components/ArmorInteractionSummaryPanel.tsx
D	src/tools/alpha-threshold/components/ControlsPanel.tsx
D	src/tools/alpha-threshold/components/DataSourceSelector.tsx
D	src/tools/alpha-threshold/components/HeatmapLane.tsx
D	src/tools/alpha-threshold/components/HeatmapLegend.tsx
D	src/tools/alpha-threshold/components/HeatmapShipColumn.tsx
D	src/tools/alpha-threshold/components/HeatmapTooltip.tsx
D	src/tools/alpha-threshold/components/HeatmapWeaponTrace.tsx
D	src/tools/alpha-threshold/components/LoadoutDrawer.tsx
D	src/tools/alpha-threshold/components/MobileThresholdComparisonLayout.tsx
D	src/tools/alpha-threshold/components/PenetrationMarker.tsx
D	src/tools/alpha-threshold/components/RecommendationsBoard.tsx
D	src/tools/alpha-threshold/components/ShipBalanceChangelogPanel.tsx
D	src/tools/alpha-threshold/components/ShipCascadeDropdown.tsx
D	src/tools/alpha-threshold/components/ShipFlipCard.tsx
D	src/tools/alpha-threshold/components/ShipHeaderPill.tsx
D	src/tools/alpha-threshold/components/ShipOverrideEditor.tsx
D	src/tools/alpha-threshold/components/ShipSelectionSidebar.tsx
D	src/tools/alpha-threshold/components/ShipSelectorOverlay.tsx
D	src/tools/alpha-threshold/components/TargetAnalysisSurface.tsx
D	src/tools/alpha-threshold/components/ThresholdComparisonMatrix.tsx
D	src/tools/alpha-threshold/components/ThresholdHeatmapBoard.tsx
D	src/tools/alpha-threshold/components/ThresholdSummaryBoard.tsx
D	src/tools/alpha-threshold/components/TopControlStrip.tsx
D	src/tools/alpha-threshold/components/WeaponCard.tsx
D	src/tools/alpha-threshold/components/WeaponComparisonSlots.tsx
D	src/tools/alpha-threshold/components/WeaponOverrideEditor.tsx
D	src/tools/alpha-threshold/components/WeaponSelector.tsx
D	src/tools/alpha-threshold/components/WeaponSelectorOverlay.tsx
D	src/tools/alpha-threshold/components/WeaponSelectorPanel.tsx
D	src/tools/alpha-threshold/components/mobile/AlphaMobileControlStrip.tsx
D	src/tools/alpha-threshold/components/mobile/AlphaMobileControls.tsx
D	src/tools/alpha-threshold/components/mobile/AlphaMobileResults.tsx
D	src/tools/alpha-threshold/components/mobile/AlphaMobileResultsOnly.tsx
D	src/tools/alpha-threshold/components/mobile/AlphaMobileSlotSections.tsx
D	src/tools/alpha-threshold/index.ts
D	src/tools/alpha-threshold/panels/panel-attacker-balance.css
D	src/tools/alpha-threshold/panels/panel-balance-changelog-head-wide.css
D	src/tools/alpha-threshold/panels/panel-command-analysis-filter.css
D	src/tools/alpha-threshold/panels/panel-command-heatmap-lanes.css
D	src/tools/alpha-threshold/panels/panel-command-heatmap-tooltip.css
D	src/tools/alpha-threshold/panels/panel-command-loadout-drawer.css
D	src/tools/alpha-threshold/panels/panel-command-responsive.css
D	src/tools/alpha-threshold/panels/panel-command-selection-overlay.css
D	src/tools/alpha-threshold/panels/panel-command-stage.css
D	src/tools/alpha-threshold/panels/panel-command-target-analysis.css
D	src/tools/alpha-threshold/panels/panel-command-threshold-board-shell.css
D	src/tools/alpha-threshold/panels/panel-command-top-strip.css
D	src/tools/alpha-threshold/panels/panel-compare-strip.css
D	src/tools/alpha-threshold/panels/panel-heatmap-legend.css
D	src/tools/alpha-threshold/panels/panel-ship-cascade.css
D	src/tools/alpha-threshold/ship-flip-card.css
D	src/tools/alpha-threshold/threshold-layout.css
D	src/tools/alpha-threshold/threshold-overrides.css
D	src/tools/alpha-threshold/threshold-panels.css
D	src/tools/alpha-threshold/threshold-recommendations.css
D	src/tools/alpha-threshold/threshold.css
D	src/tools/gunnery/ComponentMappingPage.tsx
D	src/tools/gunnery/components/GunneryContentArea.tsx
D	src/tools/gunnery/components/GunnerySectionNav.tsx
D	src/tools/gunnery/components/diagnosis/DiagnosisSection.tsx
D	src/tools/gunnery/components/mode/ModeRecommender.tsx
D	src/tools/gunnery/components/subtarget/AnchoredInspector.tsx
D	src/tools/gunnery/components/subtarget/SubTargetSection.tsx
D	src/tools/gunnery/gunnery.css
M	src/tools/gunnery/index.ts
M	style-ratchet.baseline.json
A	tests/legacy-page-routes.test.mjs
M	tests/ui/build-queue-stats.spec.ts
M	tests/ui/crafting-mobile.spec.ts
A	tests/ui/legacy-page-redirects.spec.ts
D	tests/ui/mission-browser.spec.ts
D	tests/ui/mission-offer-browser.spec.ts
```
