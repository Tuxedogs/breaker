# Mining Page Redesign Plan

Status: Quiet Index materials, location filters, Balanced Row ranked locations, queue route strategy tooltips, the Balanced Strip location header with 20-pixel color-matched method icons, the Inline Ledger coverage summary, the Operational Ledger selected-material table, the Continuation Ledger other-materials index, and the combined detail workspace are approved. Both result ledgers use the existing shared raw-material icons; the always-visible material filter remains text-only. Repeated top-right covered/resource counts are removed from both table section headings. The full-page composition is the current final mockup review. No production Mining components, calculations, APIs, routes, or styles have been changed.

## Recommendation

Use the **Quiet Index** treatment for the always-visible material selector.

- Keep all 37 materials in stable alphabetical positions.
- Use a six-column text matrix inside the existing browse rail.
- Give unselected materials no box or border; they read as quiet navigation text.
- Give selected materials a subtle cyan wash and a two-pixel leading edge. Do not use material icons or dots.
- Let only unusually long names span two grid tracks rather than truncating or shrinking every label.
- Keep queue selection count in the section header; do not reorder materials when Queue mode changes.
- At a 430–455 pixel browse-rail width, the study measures 167 pixels for the material-button matrix and 197 pixels for the complete section including its header.

This makes the selector persistent and fast without presenting 37 competing card-like controls. Full-page composition and the right-side profile are intentionally deferred.

## Material Selector Study

- [Comparison study](../artifacts/mining-redesign/material-selector-study.png)
- [Interactive-size HTML study](../artifacts/mining-redesign/material-selector-study.html)

The study compares three treatments using all current material names and the real selected queue set. The earlier full-page concepts were rejected and are no longer the design baseline.

### Option A — Quiet Index (recommended)

- Lowest visual weight.
- Stable alphabetical scanning and muscle memory.
- All materials remain directly available.
- Only selected materials become visual objects.

### Option B — Hairline Cells

- Clear hit areas, but 37 simultaneous borders make the selector compete with locations and detail content.
- Rejected as too visually present even though its physical footprint is compact.

### Option C — Queue-First Band

- Fast for queue-selected materials, but reorders the material set and weakens manual scanning.
- Adds hierarchy and height that are not justified by the existing source semantics.

## Current Review Scope

The next review is the full-page composition using only approved elements. It must not introduce:

- Source-inferred nearby-station relationships.
- Material icons in the always-visible filter index.
- System, mining-method, or encounter-tier badges.
- New calculations or source labels.

## Ranked Locations Study

- [Ranked-location comparison](../artifacts/mining-redesign/ranked-locations-study.png)
- [Interactive-size HTML study](../artifacts/mining-redesign/ranked-locations-study.html)

All alternatives preserve location imagery, location name, system, mining methods, coverage, selection, save action, long-name handling, and the coverage-complete marker. System and mining methods are plain text rather than badges. Queue modes are excluded from the study.

### Option A — Balanced Row (approved)

- 58-pixel row.
- Two-line identity area: location name, then plain system and method text.
- Explicit `N of N materials` coverage plus a quiet two-pixel bar.
- Selected state uses a leading edge and surface change.
- Preserves the thumbnail and save action without allowing either to dominate.

### Option B — Dense Ledger

- 46-pixel row.
- Displays more locations, but long names and multi-method metadata compete on one line.

### Option C — Coverage-Forward

- 68-pixel row.
- Gives coverage a dedicated line, but makes coverage compete with location identity and reduces route depth.

## Queue Route Strategy Study

- [Queue-mode tooltip study](../artifacts/mining-redesign/queue-modes-study.png)
- [Interactive HTML study](../artifacts/mining-redesign/queue-modes-study.html)

The proposed control keeps the four existing labels in a compact segmented row under a plain `Route Strategy` heading. The full button is the tooltip trigger; no additional icon is introduced. Tooltips open on hover and keyboard focus and are associated with the trigger through `aria-describedby`.

Proposed source-checked tooltip text:

- **Complete Set:** Build a multi-stop route. Each next location adds the most queue materials you still need until no location can add more.
- **Best Single:** Keep the normal ranked list. Locations that cover more selected queue materials appear first, then stronger material fit breaks ties.
- **Rare First:** Build a multi-stop route, giving extra priority to needed materials that appear at fewer locations.
- **Quality Hunt:** Build a multi-stop route and prefer better-ranked material locations while still adding materials you do not yet cover.

## Approved Left-Rail Baseline

- [Actual-size 540×1080 mockup](../artifacts/mining-redesign/approved-left-rail-540x1080.png)
- [Interactive HTML baseline](../artifacts/mining-redesign/approved-left-rail.html)

The combined baseline includes only approved elements. At the review size it renders all 37 material labels, 10 selected materials, and nine ranked locations without clipped names or horizontal overflow. Ranked rows remain 58 pixels high. Queue tooltips are closed by default and open on pointer hover or keyboard focus.

### Ranked-location loading requirement

The current production page uses `DEFAULT_VISIBLE_LOCATIONS = 12` and slices the filtered result list to that limit until the user chooses View All. The limit also resets when material selection, system selection, or Queue scope changes.

Implementation must remove the fixed 12-location cap from the desktop rail. All filtered desktop locations should populate the existing scrollable list. Compact route-first ordering may continue to show the needed route before alternates, but every alternate must remain reachable without reverting to a 12-item ceiling.

## Selected Location Identity Study

- [Selected-location header comparison](../artifacts/mining-redesign/location-header-study.png)
- [Interactive HTML study](../artifacts/mining-redesign/location-header-study.html)
- [Option A revision with method icons](../artifacts/mining-redesign/location-header-option-a-icons.png)
- [Interactive Option A revision](../artifacts/mining-redesign/location-header-option-a-icons.html)

This study isolates only location identity, location-wide mining-method distribution, and the save action. It deliberately excludes coverage summaries, nearby stations, material tables, badges, and the larger detail workspace.

### Option A — Balanced Strip with method icons (selected)

- 112-pixel header.
- Keeps the location image useful without making it a feature card.
- Gives identity and the three source-backed method values equal, restrained weight.
- Adds a 20-pixel line icon beside each mining-method label, matched to its corresponding value color.
- Keeps visible Hand, Surface Ship, and Vehicle text; icons are decorative and never replace labels.
- Does not add icon containers, badges, or material icons.
- Leaves a clear horizontal structure for later peer surfaces beneath it.

### Option B — Image-Led

- 138-pixel header.
- Improves image and title recognition, but gives the identity header too much visual dominance.

### Option C — Text-First

- 82-pixel header.
- Maximizes density, but weakens the image and compresses method-value comparison.

Implementation states: long location names use ellipsis with the full name available on hover; missing imagery uses the existing two-letter fallback; system and mining methods remain plain text; missing method distribution is shown as `Unavailable`, not as numeric zero.

## Location Coverage Summary Study

- [Coverage-summary comparison](../artifacts/mining-redesign/coverage-summary-study.png)
- [Interactive HTML study](../artifacts/mining-redesign/coverage-summary-study.html)

This study isolates the existing summary immediately beneath the location header. It covers both current information states: queue coverage for multiple selected materials and the detailed fit values for a single selected material. Nearby stations and material tables remain excluded.

### Option A — Inline Ledger (recommended)

- 48 pixels for the multi-material state and 56 pixels for the single-material state.
- Uses quiet dividers rather than individual statistic cards or badges.
- Multi-material state retains Covered and Missing and uses the already-derived coverage percentage in a restrained bar.
- Single-material state retains Method, Encounter Tier, target-quality probability, 900+ probability, and Composition / Yield.
- Existing explanatory tooltips remain associated with their labels.

### Option B — Split Band

- 64–72 pixels depending on state.
- Adds descriptive context, but begins to compete with the approved location header.

### Option C — Compressed Line

- 34–40 pixels depending on state.
- Saves height, but weakens label/value alignment and scan comparison.

State contract: valid zero, missing, and unavailable remain distinct. Mockup values are deterministic visual-review fixtures, not new production calculations.

## Nearby Stations Data Requirement

`PublicLocationEntry.nearbyStations` exists and `LocationDetail` conditionally renders it, but the current mining recommender adapter always supplies an empty array and the deterministic recommendation fixture contains no populated nearby-station values. The redesign must preserve the conditional field, but implementation must not infer proximity from the inventory location catalog or invent station relationships in presentation code. A source-backed mining-location-to-station relationship is required before this element can be validated with production data.

## Selected Material Results Study

- [Selected-material table comparison](../artifacts/mining-redesign/selected-material-table-study.png)
- [Interactive HTML study](../artifacts/mining-redesign/selected-material-table-study.html)

This study isolates the table of covered selected materials. The other-materials table and wider detail composition remain excluded.

### Option A — Operational Ledger (recommended)

- 40-pixel rows with stable Material, Method, Encounter Tier, target-quality probability, 900+ probability, and Composition columns.
- Keeps Material and Method as separate source fields.
- Uses plain colored text for Encounter Tier rather than a status badge.
- Shows `Unavailable` explicitly and distinctly from a valid numeric zero.
- Uses the existing shared raw-material icon beside each material name; status badges remain excluded.
- The section heading contains no repeated covered-count value.

### Option B — Method Nested

- 46-pixel rows.
- Frees horizontal space by placing Method beneath Material, but mixes two source fields in one scanning column.

### Option C — Dense Index

- 32-pixel rows.
- Fits more records, but weakens long-name and unavailable-state readability.

## Other Materials Resource Index Study

- [Other-materials comparison](../artifacts/mining-redesign/other-materials-table-study.png)
- [Interactive HTML study](../artifacts/mining-redesign/other-materials-table-study.html)

This study isolates the secondary `Other Materials at This Location` resource index. It remains a peer section beneath the approved selected-material results table.

### Option A — Continuation Ledger (recommended)

- Reuses the approved table column rhythm at a quieter 36-pixel row density.
- Retains Material, Method, Encounter Tier, 800+ probability, 900+ probability, and Composition as separate source-backed columns.
- Loads every source-backed resource in one continuous list; no fixed cap or resetting `Show More` state is introduced.
- Lets the detail workspace own vertical scrolling rather than adding a nested table scrollbar.
- Uses the existing shared raw-material icon beside each material name; status badges remain excluded.
- The section heading contains no repeated resource-count value.

### Option B — Method Groups

- Uses 34-pixel rows plus repeated method group headers.
- Improves method clustering, but increases total height and breaks direct alphabetical scanning.

### Option C — Compact Tiles

- Uses a three-column tile grid.
- Works at narrow widths, but is slower to compare across many resources on desktop.

State contract: valid zero and `Unavailable` remain distinct; every quality and composition value retains its source meaning.

## Approved Detail Workspace Composition

- [Actual-size 1360×1080 mockup](../artifacts/mining-redesign/approved-detail-workspace-1360x1080.png)
- [Interactive HTML composition](../artifacts/mining-redesign/approved-detail-workspace.html)

This composition introduces no new visual treatment. It combines only the approved Balanced Strip header, Inline Ledger coverage summary, Operational Ledger selected-material table, and Continuation Ledger other-materials index.

Both material ledgers use 20-pixel raw-material icons derived from the existing shared `MaterialIcon` renderer. Icons supplement visible material names and do not appear in the Quiet Index filter.

At 1360×1080 it displays seven selected-material rows and twelve other-material rows with no horizontal overflow. The approved 112-pixel header, 48-pixel multi-material summary, 40-pixel selected rows, and 36-pixel secondary rows retain their measured sizes. Section headings contain no repeated count values. Long location names use ellipsis with the full value available on hover.

The nearby-stations region remains omitted because the current mining adapter provides no source-backed nearby-station relationships.

## Full-Page Composition

- [1920×1080 mockup](../artifacts/mining-redesign/approved-full-page-1920x1080-final.png)
- [2560×1440 mockup](../artifacts/mining-redesign/approved-full-page-2560x1440-final.png)
- [Interactive full-page composition](../artifacts/mining-redesign/approved-full-page.html)

The full-page mockup combines the approved 540-pixel workflow rail and responsive detail workspace without introducing new components. The rail keeps all 37 material filters visible and text-only. The Pyro fixture loads all 13 active source-backed locations into the ranked list, exceeding the former 12-item cap; the list scrolls at 1920×1080 and displays all rows at 2560×1440.

At both desktop review sizes there is no horizontal overflow. The rail remains 540 pixels wide while the detail workspace grows from 1360 to 2000 pixels. The result ledgers retain 19 raw-material icons, seven selected-material rows, twelve other-material rows, plain encounter-tier text, and all approved quality and composition columns.

## Visual Direction

The closest design reference is the Dashboard's Next Fabrication Run card:

- Compact operational surfaces instead of a larger ornamental page frame.
- Compact header bands with clear section ownership.
- Peer work regions divided by quiet borders.
- Dense rows and small state chips instead of oversized cards.
- Deep navy-black operational surfaces using the shared `--ops-*` tokens.
- Cyan for selection and high-value focus, amber for operating modes and attention, green for positive state, and red for missing state.
- Restrained top-edge highlight and glow; no decorative effects over data.

Build Queue alignment comes from its fixed workflow rail, compact selected-row treatment, section headers, control sizing, and table density. Mining remains visually distinct through location imagery, material identity markers, and encounter/quality information.

## Information and Behavior to Preserve

### Scope and filtering

- System selection: Stanton, Pyro, and Nyx.
- Queue scope, including the current material count.
- Saved-only scope.
- Every current material filter, always visible without a drawer or horizontal carousel.
- Multi-material selection and clear selected/unselected/disabled states.
- Manual material selection and queue-derived material selection remain semantically distinct.

### Ranked locations

- Filtered location count.
- Priority Focus selector in queue mode.
- Complete Set, Best Single, Rare First, and Quality Hunt ranking modes.
- Location name, image or fallback, system, mining methods, bookmark state, and coverage indicator.
- Selected location state.
- Coverage-complete marker.
- Top-results, view-all, alternates, and needed-route controls.
- Current no-results and queue-satisfied messages.

### Location profile

- Location name, image or fallback, system, bookmark, nearby stations, and Lagrange child summary.
- Location-wide mining-method distribution.
- Covered and missing requirement counts.
- Single-material coverage, method, encounter tier, quality probability, and composition/yield summary states.
- Selected-demand material table.
- Other-materials-at-this-location table.
- Material, mining method, encounter tier, applicable quality probability columns, and composition.
- Existing tooltips and source-backed status wording.

### System states

- Loading, error, empty, filtered-empty, queue-covered, populated, selected, bookmarked, and compact inline-detail states.
- Valid zero values remain visible and distinct from missing or unavailable values.

## Proposed Component Scope

Keep data ownership and calculations in the existing hooks and projections. The redesign is limited to the page and these Mining presentation components:

- `MiningPage.tsx`: retain state orchestration; replace only page composition and presentational wrappers.
- `MiningFilterBar.tsx`: render the quiet alphabetical index inside the browse rail; retain existing filter callbacks and identities.
- `LocationListItem.tsx`: change from a large card to a compact, row-like result with the same data and actions.
- `LocationDetail.tsx`: preserve row-building and source joins; reorganize the visible header, summary strip, and tables.
- Add small page-local presentational components only where they remove duplication, such as a section header or shared material table shell.

Do not move mining calculations into JSX and do not modify the recommender, coverage plan, material normalization, build queue, inventory, API, database, authentication, or routing layers.

## CSS Refactor

The current Mining stylesheet is 4,509 lines and contains repeated selectors, duplicated declarations, and late overrides. Implementation should replace that cascade with page-scoped, responsibility-based styles:

1. `mining.css` — entry file and `.mine-page` local variables that alias shared `--ops-*`, typography, status, spacing, and control tokens.
2. `mining-shell.css` — compact two-column frame, browse rail, detail workspace, region headers, and overflow ownership.
3. `mining-controls.css` — system controls, queue/saved actions, material index controls, ranking modes, select controls, hover, focus, disabled, and selected states.
4. `mining-locations.css` — ranked list, compact location rows, thumbnails, plain method text, bookmarks, coverage bars, completion marker, and list empty states.
5. `mining-detail.css` — profile header, method summary, nearby stations, coverage summary, tables, mobile material cards, and detail empty states.
6. `mining-responsive.css` — only layout transitions and density adjustments, ordered from wide desktop to compact.

CSS rules:

- Scope every selector under `.mine-page`; do not add a new global primitive for this page.
- Reuse shared operational surface tokens and the existing typography/status tokens.
- Use CSS Grid for the primary workspace and table-like row alignment; use Flexbox only for one-dimensional groups.
- Define spacing, row height, rail width, border, and selected-surface aliases once at the page root.
- Use `minmax()`, `clamp()`, and explicit overflow owners instead of viewport-specific pixel overrides.
- Keep one canonical rule for each component state; no duplicate selectors whose result depends on source order.
- Use `:focus-visible`, `aria-pressed`, and text or icon cues so state is not communicated by color alone.
- Use line clamping or ellipsis only for secondary copy; never hide required material or location data.
- Keep desktop tables semantic and retain the current compact card representation where the viewport cannot support the columns.

## Responsive Layout Targets

### 1920×1080

- Two columns with no additional page-height header.
- Browse rail approximately 430–455 pixels wide.
- System controls, the full material matrix, ranking controls, and location results share that rail.
- Material buttons should consume approximately 167 pixels vertically; the complete section should remain near 197 pixels.
- Compact location rows should target 68–76 pixels in height.
- Location Profile receives all remaining width and begins at the top of the content area.
- The Location Profile surface is content-driven and ends after its final table rather than framing an empty full-height region.

### 2560×1440 and 3840×2160

- Preserve the same two-column hierarchy.
- Keep the browse rail compact rather than scaling it proportionally with the viewport.
- Allow the profile table to use the additional width for clearer columns and long names.
- Avoid oversized typography and empty card interiors.

### Medium desktop

- Retain the two-column layout while the material matrix and detail tables remain readable.
- Reduce browse-rail width and chip gaps before changing the workflow structure.
- Do not move materials into a full-width deck.

### 768×900 compact

- Stack the browse rail and selected detail in workflow order.
- Keep every material visible in a four-column quiet index; long names may span two tracks.
- Preserve the existing inline expansion of the selected location.
- Convert detail tables to the existing compact material cards.
- Keep Queue, Saved, system selection, and ranking controls reachable without horizontal scrolling.

## Implementation Sequence After Approval

1. Add a deterministic Mining visual fixture covering queue scope, multiple selected materials, several locations, a coverage-complete marker, a populated detail profile, and other-location materials.
2. Restructure the page into the approved regions without changing hook inputs, callbacks, or data transforms.
3. Refactor the stylesheet into the scoped files above and remove the superseded Mining rules in the same change.
4. Verify default, queue, saved, filtered-empty, queue-covered, loading, error, long-name, many-row, and compact inline-detail states.
5. Run targeted Mining tests if present, then `npm run lint` and `npm run build`.
6. Capture and manually inspect screenshots at 1920×1080, 2560×1440, 3840×2160, and 768×900 for hierarchy, overflow, clipping, contrast, density, and keyboard focus.

## Acceptance Criteria

- All current Mining information and controls remain present and source-backed.
- Every material filter remains visible at all times at every supported layout.
- Switching materials is a single direct action.
- Recommendation order, filtering, coverage planning, bookmarks, and queue focus behavior are unchanged.
- The page visually aligns with Build Queue and the Dashboard operational surface language.
- The page has no large unused regions at the required desktop sizes.
- Long location and material names do not obscure actions or values.
- No important region clips or produces page-level horizontal scrolling.
- The replacement CSS has clear ownership, no duplicate override blocks, and no page-local style leakage.
- Lint, build, targeted tests, and visual review all pass before implementation is considered complete.
