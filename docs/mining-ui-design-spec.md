# Mining Intelligence UI Design Specification

## 1. Purpose and status

This is the authoritative visual and interaction specification for Breaker Mining Intelligence at `/industry/mining`.

**Baseline:** October 14, 2026 approved implementation on `codex/mining-intelligence-migration`, committed as `e04bc32e8`.

**Authority:** The current application implementation and the actual-browser captures listed in [References and supporting screenshots](#20-references-and-supporting-screenshots) govern current presentation. The earlier [Mining Page Redesign Plan](mining-page-redesign-plan.md) is preserved as design history and must not be rewritten to imply that its earlier proposals are the final interface.

**Visual status:** USER APPROVED and IMPLEMENTED. The page's layout, visual language, typography, spacing, selection treatment, material selector, ranked list, profile header, competition presentation, and material tables are frozen. This freeze does not prove that all live source data or production-network behavior has been validated.

## 2. Design principles

1. **Operational evidence before ornament.** Mining is a dense comparison workspace, not a generic science-fiction dashboard. Information hierarchy comes from layout, typography, quiet borders, and source-backed values.
2. **Graphite/navy continuity.** Use the shared Breaker graphite/navy operational surfaces and `--ops-*` tokens. Cyan identifies selection and keyboard focus; semantic material and mining-method colors retain their data meaning.
3. **Stable scanning.** Material order, table columns, method order, coverage position, and bookmarked actions must not shift as selection changes.
4. **Artwork supports identity.** Location imagery aids recognition in ranked rows and profile headers, but data remains readable and operational controls remain above it.
5. **Truthful absence.** Valid zero, unavailable, missing, and confirmed material absence are separate states. Presentation must not turn missing source data into zero or a fabricated probability.
6. **No local gameplay mathematics.** Recommendation, material identity, coverage, quality, and direct-spawn competition calculations remain owned by their existing data and presentation modules.

## 3. Decision provenance

The October 14, 2026 visual freeze and its change-control requirement are **explicit user decisions**. The remaining entries record **user-approved final visual behavior**: they are accepted implementation outcomes, not evidence that each implementation detail was individually requested. Implementation evidence identifies code ownership only; it is not approval evidence. Assertions about live source completeness remain unverified unless separately marked as such.

| Decision | Status | Implementation evidence |
| --- | --- | --- |
| The October 14, 2026 Mining UI is visually approved and frozen. | EXPLICIT USER DECISION, IMPLEMENTED | This document and `e04bc32e8`. |
| Desktop is one compact browse rail plus one Location Profile workspace. | USER-APPROVED FINAL BEHAVIOR, IMPLEMENTED | `.mining-shell` at `min-width:1321px`. |
| The Quiet Index uses stable, equal-width four-column material cells with no span rules. | USER-APPROVED FINAL BEHAVIOR, IMPLEMENTED | `.mining-filter-chips--quiet-index`; `MiningFilterBar.tsx`. |
| Clicking a material only toggles selection. No separate last-clicked visual state is allowed. | USER-APPROVED FINAL BEHAVIOR, IMPLEMENTED | Only `is-active` is emitted for selected chips; chips use `aria-pressed`. |
| Ranked rows use text-only Hand, Ship, Vehicle percentages in that order. Method icons belong in the profile header only. | USER-APPROVED FINAL BEHAVIOR, IMPLEMENTED | `LocationListItem.tsx`. |
| Ranked rows retain thumbnail, name, system, coverage, bookmark, and API-delivered/static-index-shaped method data at compact density. | USER-APPROVED FINAL BEHAVIOR, IMPLEMENTED | `LocationListItem.tsx`, canonical CSS. |
| The profile keeps compact location-specific artwork, the bookmark, and Hand/Ship/Vehicle icons. The small independent body icon was removed. | USER-APPROVED FINAL BEHAVIOR, IMPLEMENTED | `LocationDetail.tsx`; `planetAssets.ts`. |
| Header method positions are fixed slots: Hand, Ship, Vehicle. An absent method leaves its slot empty. | USER-APPROVED FINAL BEHAVIOR, IMPLEMENTED | `HEADER_METHOD_SLOT_ORDER`; `.mdet-method-rack`. |
| Competition is source-pool-specific. Absent selected materials must not create competition rows. | USER-APPROVED FINAL BEHAVIOR, IMPLEMENTED | `buildMiningLocationCompetitionPools` and regression tests. |
| Selected materials precede competition; Other Materials follows competition. | USER-APPROVED FINAL BEHAVIOR, IMPLEMENTED | `LocationDetail.tsx` render order. |
| Occurrence displays only primary share. Spawn roll and location rank are not rendered. | USER-APPROVED FINAL BEHAVIOR, IMPLEMENTED | `MiningOccurrenceCell`. |
| Visual changes after approval require explicit approval. | EXPLICIT USER DECISION, IMPLEMENTED | [Change-control rules](#19-change-control-rules). |

## 4. Current UI architecture and component ownership

| Concern | Canonical owner | Notes |
| --- | --- | --- |
| Page state, filtering, Queue/Saved/Explore modes, selected location, desktop/mobile composition | `src/components/industry/mining/MiningPage.tsx` | Owns state orchestration, not mining mathematics. |
| Scope controls and Quiet Index material buttons | `src/components/industry/mining/MiningFilterBar.tsx` | Material buttons are native buttons with `aria-pressed`. |
| Ranked location row | `src/components/industry/mining/LocationListItem.tsx` | Uses the shared source-backed survey projection and asset lookup. |
| Location Profile, selected and other ledgers, profile method rack | `src/components/industry/mining/LocationDetail.tsx` | Controls section order and renders presentation values. |
| Competition labels, formatting, rendering boundary | `src/components/industry/mining/miningCompetitionPresentation.ts` | Must not duplicate probability logic. |
| Source-backed environment, method and source-pool projection | `src/features/mining/miningPresentationModels.ts` | The canonical source-group membership path. |
| Location and artwork lookup | `src/features/mining/planetAssets.ts`, `public/assets/planetsandmoons/manifest.json` | Manifest provides asset and framing metadata. |
| Material identity, artwork, and color | `src/lib/materialPresentation.ts` | Competition colors derive from canonical identity, never list position. |
| Canonical Mining stylesheet | `src/components/industry/mining/mining.css` | No second Mining redesign stylesheet is active. |
| Shared tokens and global focus/reduced-motion baseline | `src/styles/tokens.css` | Use shared `--ops-*`, font, text, and focus tokens. |

## 5. Desktop layout contract

### Fixed desktop composition

At `min-width:1321px`, `.mine-page.mine-page--v2 .mining-shell` is a two-column grid:

```css
grid-template-columns: minmax(360px, 430px) minmax(0, 1fr);
gap: 6px;
```

The left `.mining-browser-column` is a vertical grid: Survey Control followed by Ranked Locations. The right `.mining-detail-column` owns vertical profile scrolling. It must use `min-width:0` and must not introduce a horizontal void or a second desktop filter/list column.

Measured live fixture geometry:

| Viewport | Browse rail | Gap | Detail workspace | Header | Body horizontal overflow |
| --- | ---: | ---: | ---: | ---: | --- |
| 1695×927 | 430px | 6px | 1191px | 128px | None |
| 1920×1080 | 430px | 6px | 1416px | 128px | None |
| 2560×1440 | 430px | 6px | 2056px | 128px | None |

At the fixture's 1695×927 baseline, Survey Control measures 430×429px and Ranked Locations 430×412px. The 404px-wide Quiet Index is inset within its rail. These are observed values, not new token requirements.

### Desktop density rules

- The command header is 48px high at desktop.
- Ranked Location rows have a 58px minimum. The observed outer selected row including its border is 60px.
- The profile header is exactly 128px tall in the approved implementation. It must not be turned into a larger hero.
- Result-table headers are 34px; the final cascade renders current desktop body rows at approximately 72px with 8px by 12px cell padding. Do not restore a forced full-height empty profile surface.
- The rail and detail are peer workspaces separated by 6px, not nested cards.

## 6. Material selector contract

### Quiet Index

The material selector is a text-first Quiet Index under the `Materials` label. It is always visible in the desktop browse rail and preserves source/catalog ordering from `allMaterialResources`, which is alphabetically sorted by display label.

```css
.mining-filter-chips--quiet-index {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 3px 4px;
}
.mining-filter-chip--material {
  grid-column: auto;
  width: 100%;
  min-width: 0;
  height: 18px;
  min-height: 18px;
}
```

Every material occupies exactly one equal-width cell. Do not add `grid-column: span 2`, `grid-auto-flow:dense`, selection-driven reordering, a material icon, or a last-clicked active treatment. Long names may truncate only when a responsive width genuinely requires it; their button `aria-label` retains the full label.

**Selection:** selected cells receive `.is-active` only. It applies the persistent leading cyan edge, selected surface, and readable copy. Keyboard focus remains an independent two-pixel focus-visible outline. Clearing selection restores the identical unselected treatment.

**Catalog baseline:** the current selector starts from **38 seeded canonical mining resources**, including `Carinite Pure`. It can additionally surface canonical Build Queue, manual-demand, or static-index resources, so 38 is the approved local baseline rather than a permanent live-data count. The historical plan's 37-material statement remains historical evidence; it is not a reason to remove a valid resource.

## 7. Ranked Locations contract

### Anatomy

Each `.mlist-item` has fixed scan columns:

1. Rank
2. 34px desktop thumbnail
3. Location identity and method text
4. 54px coverage value
5. 28px bookmark action

The final desktop selector is:

```css
grid-template-columns: 22px 34px minmax(0, 1fr) 54px 28px;
gap: 7px;
min-height: 58px;
```

Rows use the mapped `thumbnail` and `thumbnail2x` asset. Missing mappings render the existing initial-letter fallback tile. The thumbnail is decorative to assistive technology because the row itself identifies the location.

### Content and behavior

- Name is one line with ellipsis in the constrained identity column. Full raw-key information is available by title where the display name differs.
- System uses the existing Stanton, Pyro, and Nyx badge colors when no single system filter is active. Lagrange child groups use their own summary rather than a misleading system badge.
- Method values are text only, with no ranked-row method icon. They render Hand, Ship, Vehicle order; colors are Hand `#f2c94c`, Ship `#f28b39`, Vehicle `#67c9ee`.
- Coverage is `X / Y` with tabular numerals when materials are relevant. With no selection it is a meaningful dash, not an invented zero.
- The bookmark is a native button with Save/Remove saved label, `aria-pressed`, tooltip association, and propagation control so it does not select the row.
- The location row is keyboard-operable with Enter and Space, exposes `role="button"`, `tabIndex=0`, and `aria-pressed`.
- The scrollable `.mlist-items` region owns overflow so every filtered desktop location remains reachable. A row-cap proposal from the historical plan is superseded by the implemented scrollable list.

## 8. Location Profile contract

### Balanced Strip

The profile starts with `.mdet-survey-stage`, a 128px compact Balanced Strip. The system label and location name are left aligned. The mapped artwork occupies the right portion. The Save/Remove saved bookmark stays in the upper-right corner.

The profile header retains the original location-specific atmospheric linework. It does not render a separate circular planet/body control. Artwork itself may depict a body when that is the mapped source image.

### Mining method rack

The profile method rack is anchored beneath the identity rather than moved to the far right. It is a three-track grid with permanent, ordered slots:

```css
left: 200px;
bottom: 10px;
width: 396px;
grid-template-columns: repeat(3, 132px);
```

| Slot | Method | Rule |
| --- | --- | --- |
| 1 | Hand | Icon, label and source-backed percentage stay together. |
| 2 | Ship | Icon, label and source-backed percentage stay together. |
| 3 | Vehicle | Icon, label and source-backed percentage stay together. |

An absent method renders an empty fixed-width slot. Slots do not collapse, recenter, or exchange positions. Percentages use `font-variant-numeric:tabular-nums`. A true delivered numeric zero is valid data and must be visible in the profile slot. Completely unavailable method data renders `Methods unavailable` rather than zero.

### Profile content

- The profile is content-driven. Empty profile surfaces must not consume the remaining viewport height.
- The selected-material ledger appears before Direct Spawn Competition.
- Direct Spawn Competition appears before Other Materials.
- Source-backed nearby-station records remain conditional. The current fixture has no validated nearby-station relationship; do not infer one.

## 9. Direct Spawn Competition contract

The section has no decorative heading in the current approved presentation. It renders only when `competitionPools.length > 0`.

### Truth boundary

- `buildMiningLocationCompetitionPools` renders pools only after the location reference index has loaded.
- `buildMiningSelectedSpawnCompetitionPools` finds selected material membership from canonical location-specific source records.
- A selected material absent from those records remains reflected in coverage and missing-material accounting, but **does not** produce a competition row.
- Selected materials sharing one delivered source pool render once in that pool. Selected materials in different source groups remain separate.
- Ship/surface-ship, Vehicle, and Hand/FPS source groups must not be merged.
- The visual bar uses delivered `relativeProbability` percentage points. It must not normalize a partial pool to fill 100%, fabricate a remainder, or sum multiple selected materials into an aggregate chance.

### Presentation

- Each ordinary pool has a 206px source-pool copy column and a flexible readout column, with a minimum height of 88px.
- The source label is humanized by `miningCompetitionSourceLabel`, such as `Hand-mining spawn pool`, `Vehicle-mining spawn pool`, and `Surface-ship spawn pool`.
- Selected members use their canonical material color plus selected emphasis. Competitors keep their canonical material color and a `Competing` role label.
- Pool labels use singular grammar for `1 competing resource` and plural grammar otherwise.
- Unknown/unavailable source shares remain unavailable. A partial published pool visibly retains unrepresented mass rather than pretending completeness.

## 10. Material tables and data presentation

### Selected Materials at This Location

The selected ledger is rendered when covered demand rows exist. It uses the columns:

`Material | Method | Occurrence | 800+ or target quality | 900+ | Composition`

The quality header is source- and demand-state dependent. It must retain the existing quality probability semantics. Method is a distinct source field, not inferred from a material name. Material icon, name, trace-material information, and method association remain visible.

### Other Materials at This Location

Other Materials follows competition and retains the same scanning rhythm:

`Material | Method | Occurrence | 800+ | 900+ | Composition`

Rows are source-method-aware, ordered Ship then Vehicle then Hand, alphabetically within a method, and retain their association keys. Do not collapse a material that occurs in more than one method into an arbitrary single row.

### Values and state semantics

- **Occurrence:** probability rows display only `primary` share. Legacy rows keep their existing source-tier presentation. Spawn-roll and location-rank values are not presented in the approved UI.
- **Quality:** 800+ values use the established blue treatment; 900+ values use the established purple treatment. Their values remain source-backed probability labels.
- **Composition:** an average composition within an encountered source, not encounter chance.
- **Unavailable:** explicit unavailable/unknown source data remains distinct from numeric zero.
- **Zero:** a real source-provided numeric `0` is valid and must not disappear or become unavailable.

Desktop uses a minimum 720px table width inside a horizontal-safe surface. At narrow mobile widths, desktop tables are hidden and existing mobile material cards carry equivalent field labels and values.

## 11. Imagery and asset presentation

`public/assets/planetsandmoons/manifest.json` is the location asset manifest. `planetAssets.ts` resolves normalized names and aliases and supplies:

- `thumbnail`, `thumbnail2x`
- `main`, `main2x`
- optional `headerImage`, `headerImage2x`
- optional `headerFit` (`cover` or `contain`)
- `headerPositionX`, `headerPositionY`
- `headerArtWidth`

### Header framing

`.mdet-header-art-region` is right anchored and defaults to 60% width. It fades into the dark header with a left-edge mask. The art receives the per-location fit and position via CSS custom properties and uses restrained saturation, brightness, and contrast filtering. The identity and controls remain on the dark left side.

| Asset type | Required treatment |
| --- | --- |
| Surface landscape | `cover` with manifest framing that retains terrain and a recognizable feature. |
| Full planetary/orbital portrait | `contain`, centered where a complete disc matters; unused region blends into the dark header. |
| Asteroid/ring scene | `cover`, centered or manifest-framed around recognizable objects. |
| No mapping | Existing neutral fallback. Do not invent or reuse unrelated artwork. |

Custom header framing currently exists for Cellin, Daymar, Yela, Crusader, and Asteroidcluster Medium Yield. The manifest uses 62% art width for the three landscapes, 58% for Crusader's contained portrait, and 60% for the asteroid cluster.

## 12. Typography, colors, spacing, and design tokens

### Typography

- Primary Mining text uses `--font-primary` / `--font-ui`: system UI, `-apple-system`, and Segoe UI fallback. Rajdhani is limited to compact actions elsewhere in the product, not general Mining copy.
- Command title: 15px, 800 weight, uppercase with 0.09em tracking.
- Profile name: 20px, 700 weight. System label: 10px uppercase.
- Quiet Index label: 10px, 500 weight; material cell: 11px desktop.
- Ranked name: 13px, selected 14px; method metadata: 9px; coverage: 12px tabular numeric.
- Table header: 10px, 700 weight; occurrence: 13px; table score: 14px.
- Use tabular numerals for coverage, method percentages, competition values, and numerical table columns.

### Surface and semantic colors

Mining owns page-scoped aliases in `.mine-page.mine-page--v2` and maps them to shared `--ops-*` tokens on wide desktop:

| Purpose | Current token/value |
| --- | --- |
| Canvas | `--ops-canvas` wide desktop; `#0c1218` base alias |
| Primary workspace | `--ops-surface-primary` |
| Row | `--ops-surface-row` |
| Hover | `--ops-surface-hover` |
| Selected | `--ops-surface-selected` |
| Borders | `--ops-border-default`, `--ops-border-soft` |
| Selection/focus | `--ops-highlight-color`, `--ops-focus-ring` |
| Nested radius | `--ops-radius-nested: 4px` |
| Mining outer radius | `--mine-radius: 2px` |
| Hand method | `#f2c94c` |
| Ship method | `#f28b39` |
| Vehicle method | `#67c9ee` |

Use quiet borders and restrained inset/operational shadows. Do not add generic glass cards, unscoped gradients, or new page-global tokens for a Mining-only exception.

## 13. Interaction and accessibility rules

- Use native `<button>` elements for actions. Row selection remains keyboard-operable with Enter and Space.
- Material, scope, system, coverage, and bookmark toggles expose `aria-pressed` where appropriate.
- Search has a visible label for assistive technology and a labeled clear action.
- Bookmark actions retain Save/Remove saved labels, tooltip association, and visible focus.
- Mining controls use a two-pixel `:focus-visible` outline. Do not replace it with mouse-only hover affordance.
- Method labels accompany icons in the profile. Icons do not carry the only meaning.
- Color never stands alone for selected, unavailable, or competition-member state. Labels, role text, coverage, and source labels remain visible.
- Tables use table semantics, headers, visible column labels, and infotip buttons for source-language explanation.
- Empty and status messages use the existing status/alert roles where implemented.

Accessibility review remains incomplete for live production data and every compact browser combination. See [Outstanding functional and data-validation requirements](#17-outstanding-functional-and-data-validation-requirements).

## 14. Responsive design requirements

| Range | Required composition |
| --- | --- |
| `>=1321px` | Two-column rail/profile composition. Browse rail is 360-430px; current approved view renders 430px. |
| `1181-1320px` | Two-column intermediate workspace: browse column is `minmax(480px, 43%)`; ranked rows use their two-row 84px layout through 1300px. |
| `901-1180px` | Single-column shell with a browse region followed by profile; avoid clipped desktop profile. |
| `761-900px` | Stack browse above detail. Browse region uses `height:min(520px, 62dvh)` and list overflow. |
| `<=760px` | Mobile filter-sheet trigger is available; the browse/list region becomes auto-height, selected row can show inline detail, and desktop tables are replaced by mobile cards. |
| `<=480px` | Scope/system controls stack and general legacy material wrapping may reduce to two columns. |

Observed at 768×900: the app has no horizontal overflow, the 700px main shell stacks a 520px browse region above a 700px detail region, and the profile header remains 128px. The live 768 screenshot contains a selected location and source-backed zero method values. This is an IMPLEMENTED compact behavior, not a recommendation to alter mobile layout.

## 15. Loading, empty, missing, unavailable, and error states

| State | Current behavior | Status |
| --- | --- | --- |
| Recommendations loading with no data | `Loading recommendations…` status state. | IMPLEMENTED |
| Recommendations error with no data | Alert stating failure and source message. | IMPLEMENTED |
| Refreshing with retained data | Command-header status says it is refreshing. | IMPLEMENTED |
| No filtered locations | Contextual empty message and Clear filters action where appropriate. | IMPLEMENTED |
| Queue fully covered / no active Queue need | Explicit route message. | IMPLEMENTED |
| No selected location on desktop | Content-driven `Select a location to view details` surface. | IMPLEMENTED |
| Static location reference index loading/error | Source-backed detail warning; competition is withheld until loaded. | IMPLEMENTED |
| No material rows | Explicit no-row message. | IMPLEMENTED |
| No method data | `Methods unavailable`, not zero. | IMPLEMENTED |
| Valid delivered zero | Must remain numeric zero when rendering the relevant source field. | USER-APPROVED FINAL BEHAVIOR; IMPLEMENTED and regression-tested in shared ranked/profile projection |
| Missing material at a location | Coverage/missing accounting only; no synthetic competition row. | USER APPROVED, IMPLEMENTED |

## 16. Original-to-current design reconciliation

The original plan contains discovery studies, recommendations, and initial measurements. It is historical evidence. The table below records differences without claiming every implementation adaptation was a direct user decision.

| Area | Original decision | Current implementation | Status | Reason |
| --- | --- | --- | --- | --- |
| Visual authority | Original plan was the working design plan. | This specification is the current visual source of truth; plan remains history. | USER APPROVED, IMPLEMENTED | Visual baseline was explicitly frozen. |
| Quiet Index columns | Six-column matrix; unusual long labels could span two tracks. | Four equal columns; every cell occupies one track. | USER APPROVED, IMPLEMENTED | Prevents holes, unstable scanning, and selected-cell geometry changes. |
| Quiet Index catalog | Plan says 37 visible materials. | Selector baseline is 38 seeded canonical resources, and may be augmented by canonical runtime demand/index inputs. | VERIFIED IMPLEMENTATION FACT | The earlier count was historical wording, not a live-catalog contract. |
| Material chip height | Earlier canon described 28px controls. | Final scoped Quiet Index chips are 18px. | USER APPROVED, IMPLEMENTED | Explicit compact-density adjustment after final baseline review. |
| Browse rail | Historical full-page mockup specified 540px. | Current approved desktop rail measures 430px at 1695, 1920, and 2560 widths. | USER APPROVED, IMPLEMENTED | Final two-column implementation fixed the regression and preserved usable detail width. |
| Desktop structure | Earlier pilot used filters, list, divider, and profile as desktop columns. | One browse rail stacks filters and list; profile is the second primary column. Divider is hidden at wide desktop. | USER APPROVED, IMPLEMENTED | Corrected the documented layout regression. |
| Ranked-row method presentation | Earlier studies described plain method text but did not lock exact text format. | Source-backed, colored text percentages: Hand, Ship, Vehicle. No icons. | USER APPROVED, IMPLEMENTED | Explicit request to restore readable textual values. |
| Ranked row artwork | Pilot described an oversized clipped 68px asset. | Final desktop uses a 34px thumbnail inside a 58px row, with fallback tile. | USER APPROVED, IMPLEMENTED | Prevents collisions and improves row scanability. |
| Ranked row height | Balanced Row proposed 58px. | `min-height:58px`; observed outer selected row 60px. | Existing approved decision preserved, IMPLEMENTED | Border accounting explains observed outer size. |
| Location header height | Plan chose 112px Balanced Strip. | Final header is 128px. | USER APPROVED, IMPLEMENTED | Needed slightly more artwork while retaining compact header geometry. |
| Header decorative body icon | Earlier original treatment included a small circular planet/body icon. | No separate icon container; mapped artwork remains. | USER APPROVED, IMPLEMENTED | Explicit removal without removing location identity artwork. |
| Header method placement | Original study put methods on the right. | Fixed-slot method rack is beneath/alongside left identity, anchored at `left:200px`. | USER APPROVED, IMPLEMENTED | Explicit hierarchy request and stable slots prevent horizontal shifting. |
| Method slots | Earlier design had flexible available-method treatment. | Three permanent 132px slots; absent methods leave blank slots. | USER APPROVED, IMPLEMENTED | Explicit acceptance test for no movement between locations. |
| Location imagery | Earlier plan allowed imagery with generic fallback. | Manifest adds header image variants, fit, focal position, and art-width metadata. | USER APPROVED, IMPLEMENTED | Uses supplied location-specific artwork and prevents generic replacement. |
| Selected ledger | Plan used an Operational Ledger with 40px rows. | Final rendered table rows are approximately 72px because the final cascade accommodates source detail; content includes source-backed primary occurrence only. | Implementation adaptation, IMPLEMENTED | Spawn roll/rank were later explicitly removed from presentation. |
| Direct Spawn Competition heading | Earlier iterations included a visible section label and explanatory text. | No decorative heading or complete-pool sentence; pools appear only when truthful and relevant. | USER APPROVED, IMPLEMENTED | Explicit compactness and clarity request. |
| Competition pool grouping | Historical plan was less specific about multiple targets. | Pools are coalesced only within the same delivered source group. | USER APPROVED, IMPLEMENTED | Protects method/source semantics and prevents fake aggregate chances. |
| Competition bar coverage | Not fully specified in original plan. | Partial pools retain unrepresented share; unavailable share is not fabricated. | USER APPROVED, IMPLEMENTED | Correctness pass on delivered probabilities. |
| Other Materials order | Original plan placed it as the continuation ledger beneath selected results. | It is beneath Direct Spawn Competition. | USER APPROVED, IMPLEMENTED | Explicit post-competition ordering request. |
| Empty profile | Earlier layouts risked a viewport-filling detail surface. | Profile content is content-driven. | USER APPROVED, IMPLEMENTED | Explicit request to remove unnecessary empty height. |
| Occurrence description | Original plan expected primary, spawn roll, and rank. | Only primary share is rendered. | USER APPROVED, IMPLEMENTED | Pure presentation-only request. |
| Fixed desktop result cap | Plan identified a historical 12-location cap to remove. | Scrollable list renders all filtered entries in current fixture. | Existing approved decision preserved, IMPLEMENTED | Current desktop source returns a scrollable result list. |

## 17. Outstanding functional and data-validation requirements

These are not visual redesign proposals.

1. **Live catalog parity:** 38 is the selector seed baseline, while the current local static index has 33 raw material names. Reconcile accepted Scintel publication, static-index publication, and selector augmentation before claiming an exact live catalog count.
2. **Live-data validation:** all capture evidence in this document is local fixture-mode evidence. The purple `FIXTURE MODE - NETWORK DISABLED` marker is visible in screenshots. Validate live endpoint availability, source-row completeness, exact material catalog, and artwork mappings separately.
3. **Nearby stations:** do not infer station proximity. Source-backed data remains required before this conditional region can be considered validated.
4. **Accessibility matrix:** verify keyboard selection, bookmark tooltip, focus order, compact filter sheet, table card equivalent, and readable states with production data at the specified viewports. Current source has the core semantics, but a full assistive-technology audit was not performed by this documentation pass.
5. **Responsive test coverage:** retain and run current Mining tests. Add focused test coverage if an approved functional repair changes selector count, zero-method behavior, asset fallback, competition grouping, or mobile overflow.

## 18. Explicitly rejected or superseded treatments

- A third desktop filter/list column or a persistent wide void between list and profile.
- Separate 150px filter and ranked-location desktop columns.
- A larger image-led location hero or a full-height decorative empty profile.
- The standalone circular planet/body icon in the profile header.
- Mining-method icons in ranked location rows.
- Long material chips spanning multiple grid tracks or any dense-flow reordering.
- A separate focused-material or last-clicked material appearance.
- Decorative Direct Spawn Competition heading and the claim that published records represent a complete pool.
- Competition rows for selected materials absent from source-backed location records.
- Combining Hand, Vehicle, and Ship competition into one distribution or inventing multi-material competition mathematics.
- Reintroducing spawn roll or location rank into the visible occurrence cell.
- Generic background art that replaces a mapped location-specific header asset.
- CSS-only hiding as a substitute for correcting source-membership presentation logic.

## 19. Change-control rules

The October 14, 2026 baseline is USER APPROVED and visually frozen.

Future work may address functional defects, data correctness, accessibility, performance, responsive bugs, or an explicitly requested feature. It may not change approved layout, typography, spacing, component hierarchy, material-selection styling, visual language, or artwork framing without explicit user approval.

For every future Mining change:

1. Classify it as functional, data correctness, accessibility, performance, responsive bug, or an explicitly requested feature.
2. Keep existing calculation, material identity, Scintel, ranking, coverage, and source-contract owners intact unless separately authorized.
3. Update this specification only when a new decision is explicitly approved or a verified implementation fact changes.
4. Preserve the historical plan. Add reconciliation entries instead of editing old proposals to look final.
5. Run `npm run mining:test`, relevant focused tests, `npm run build`, and a real-browser viewport review proportional to the changed area.
6. Record any fixture-only evidence as fixture evidence, not live production proof.

## 20. References and supporting screenshots

### Source references

- [Historical Mining Page Redesign Plan](mining-page-redesign-plan.md)
- [Mining Three-Panel Pilot](mining-three-panel-pilot.md)
- [Breaker Design Canon](../moonbreaker_design_canon.md)
- `src/components/industry/mining/MiningPage.tsx`
- `src/components/industry/mining/MiningFilterBar.tsx`
- `src/components/industry/mining/LocationListItem.tsx`
- `src/components/industry/mining/LocationDetail.tsx`
- `src/components/industry/mining/mining.css`
- `src/components/industry/mining/miningCompetitionPresentation.ts`
- `src/features/mining/miningPresentationModels.ts`
- `src/features/mining/planetAssets.ts`
- `public/assets/planetsandmoons/manifest.json`

### Actual local application captures

All screenshots below were captured from `http://localhost:4312/industry/mining` on October 14, 2026. They are real local application output in fixture mode, not standalone HTML mockups.

| Capture | State | File |
| --- | --- | --- |
| 1695×927 | No manually selected materials; selected profile state supplied by current fixture | [PNG](../artifacts/mining-design-baseline/mining-1695x927-no-selection.png) |
| 1920×1080 | No manually selected materials | [PNG](../artifacts/mining-design-baseline/mining-1920x1080-no-selection.png) |
| 2560×1440 | No manually selected materials | [PNG](../artifacts/mining-design-baseline/mining-2560x1440-no-selection.png) |
| 768×900 | Compact stack, no manually selected materials | [PNG](../artifacts/mining-design-baseline/mining-768x900-no-selection.png) |
| 1920×1080 | Eight selected materials with three source-backed competition pools | [PNG](../artifacts/mining-design-baseline/mining-1920x1080-multi-selection.png) |
| 1920×1080 | Queue mode | [PNG](../artifacts/mining-design-baseline/mining-1920x1080-queue.png) |

The captures demonstrate multiple mining methods, ship-only locations, selected material treatment, competition, art-backed locations, desktop sizing, and compact stacking. They do not validate live network data because fixture mode disables network access.
