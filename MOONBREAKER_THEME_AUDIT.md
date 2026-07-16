# Moonbreaker Theme Audit

Investigation date: 2026-07-12
Scope: Dashboard, Fitting Mockup, Mission Browser, Blueprint Tracker, Mining, Build Queue, and Carrier Logistics. This is a recommendation report only; no application code, behavior, data, routing, or responsive logic was changed.

## 1. Executive verdict

**Dashboard/Fitting is the stronger global foundation.** Direction A scores **78.5/100**, versus **71.4/100** for Direction B, an objective lead of **7.1 points**. The user's preference for Dashboard was not needed as a tiebreaker.

Direction A wins six of seven rubric categories. Its graphite/navy canvas, controlled luminance steps, compact low-radius panels, restrained glow, inset edges, strong primary type, and isolated visual focal areas form a more coherent and transferable grammar. Direction B wins interaction and selected-state clarity, chiefly through Build Queue and Mining's fill-plus-border states. Those state techniques should be imported into the Direction A base.

This verdict does **not** mean copying Dashboard's hero across the application. The base is Direction A's tokens and techniques, complemented by exact Direction B imports:

- Build Queue's multi-cue selected card/tab patterns and explicit canvas-to-row luminance ladder.
- Mining's system/list/detail information architecture, not its cyan-violet active glow.
- Carrier's compact operational composition, amber terminal identity, segmented cargo visualization, and labeled cargo palette.
- Blueprint Tracker's amber structural rails, disclosures, and warm readable primary type.
- Mission Browser's reputation-path rails and high-throughput connected card/dossier structure.

Accessibility modifies the aesthetic choice: Direction A still contains failing faint metadata and weak focus/selection cues. It wins as a foundation only if those are corrected before broad adoption.

## 2. Shared rubric score table

### Per-page scores

| Page | Family | Hierarchy /20 | Readability /20 | Layering /15 | Accent /15 | States /10 | Scalability /10 | Density /10 | Total /100 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Dashboard | A | 17 | 14 | 13 | 11 | 7 | 8 | 7 | **77** |
| Fitting Mockup | A | 17 | 15 | 13 | 12 | 7 | 8 | 8 | **80** |
| Mission Browser | B | 16 | 14 | 11 | 9 | 7 | 8 | 9 | **74** |
| Blueprint Tracker | B | 14 | 12 | 10 | 11 | 7 | 5 | 5 | **64** |
| Mining | B | 17 | 16 | 13 | 12 | 8 | 7 | 5 | **78** |
| Build Queue | B | 17 | 16 | 13 | 12 | 9 | 8 | 5 | **80** |
| Carrier Logistics | B | 14 | 8 | 11 | 12 | 6 | 6 | 4 | **61** |

Blueprint Tracker was captured in an empty tracked state, so its density/scalability scores are provisional. Carrier's low score is driven primarily by measured text contrast and widescreen scanning, not its underlying logistics structure.

### Family comparison

| Category | Max | Direction A | Direction B | Objective winner |
|---|---:|---:|---:|---|
| Information hierarchy | 20 | 17.0 | 15.6 | A |
| Readability and contrast | 20 | 14.5 | 13.2 | A |
| Surface and card layering | 15 | 13.0 | 11.6 | A |
| Accent-color discipline | 15 | 11.5 | 11.2 | A |
| Interaction and selected-state clarity | 10 | 7.0 | 7.4 | B |
| Cross-page scalability | 10 | 8.0 | 6.8 | A |
| Density and space efficiency | 10 | 7.5 | 5.6 | A |
| **Total** | **100** | **78.5** | **71.4** | **A by 7.1** |

At 2560x1440, both families underuse space. Direction B more often turns width into long scan lines or blank canvas while retaining tiny text; Mission Browser is the notable exception, adding a useful card column. The category winners do not change between target resolutions.

## 3. Winning characteristics

### Canvas and atmosphere

- Dashboard's `--bg-app` combines `#03070a`, `#071218`, and `#070e11` with extremely faint cool radial gradients. It is space-oriented without pure black, literal starfields, or texture behind operational text.
- Fitting's `#05080a` canvas and near-black graphite panels corroborate the same visual direction, though its local tokens need consolidation.
- Ambient gradients work when confined to page or hero atmosphere. Dense tables and rows should sit on opaque, stable surfaces.

### Surface and card language

- `.dash-hero` provides depth with a near-opaque graphite gradient, a restrained cyan-tinted edge, black depth shadow, very low cyan glow, and a subtle inset top highlight.
- `.dash-hero-mini` introduces a clear child luminance step using `rgba(24,29,33,.92)` to `rgba(16,20,23,.96)`, a quiet neutral border, smaller shadow, and inset edge.
- Dashboard cards reuse `--bg-card-dark`, `--border-soft`, and 6px radii. Fitting reinforces the language with 4px `.fm-panel`, `.fm-stat-card`, and `.fm-equip-row` silhouettes.
- Fitting's equipment rows are a strong dense-tool pattern: aligned grid, tabular quantities, truncation, modest hover lift, and a narrow category rail.
- Depth comes principally from luminance, spacing, and borders. This is more scalable than Direction B's shifting navy, charcoal, teal, amber, and violet recipes.

### Typography and information hierarchy

- Rajdhani-first type, bright primary labels, short uppercase section labels, and tabular numerics create an operational terminal character.
- Dashboard's hero-to-KPI-to-work-panel sequence and Fitting's rail/system-stage/stat structure establish clear large-to-small reading order.
- Constrained copy widths in the Dashboard hero prevent wide-screen line drift.
- Isolated visual stages—Dashboard hero atmosphere and Fitting ship artwork—create page identity without putting decoration behind routine data.

### Accent and interaction discipline

- Direction A generally keeps cyan/teal informational, amber decisive, and green/red semantic, with less saturated glow than the competing family.
- Dashboard's solid amber primary CTA versus outlined cyan secondary CTA uses fill, edge, and hierarchy rather than glow alone.
- The winning base should adopt Direction B's strongest state pattern: Build Queue's selected craft card changes fill and border and has supporting contextual treatment.

## 4. Weaknesses of the winning direction

- Dashboard metadata is often too small and faint. Measured examples include `.dash-hero-mini-label` at about **3.59:1** and alpha `.38` metadata at about **2.31:1**, below 4.5:1 for normal text.
- Fitting's `--fm-muted-2: #5f6b75` measures about **3.55:1** on `#0a0e12`; it is widely used at 11–12px.
- Routine borders are too weak when they are the only structural cue. Fitting's white `.07` edge is about **1.17:1**; similar Dashboard hairlines cannot serve as required control boundaries.
- `.fm-equip-row.is-selected` relies on a faint teal border/inset with little fill change. It does not reliably meet the two-cue selected-state rule.
- `.dash-stat-info-btn:focus` removes the outline without a durable replacement; Fitting lacks a dependable page-level focus-visible system.
- Dashboard's four peer hero mini cards use cyan, violet, orange, and green edges without a clear semantic requirement. This can make peer navigation appear status-coded.
- Routine `--shadow-card` and Fitting panel shadows are heavier than needed. Repeating them risks floating-card stacks.
- Dashboard and Fitting define related but separate cyan, orange, text, surface, and semantic values.
- Both pages leave avoidable empty space at 2560x1440; responsive density should improve information scale and column constraints rather than simply stretch layouts.

## 5. Valuable elements from the losing direction

- **Build Queue:** preserve its opaque `#03121c` → `#04131d` → `#051a28` → `#081e2c` ladder, queue/detail/allocation composition, selected craft card, active tab treatment, violet ownership relationship, and labeled warning/danger/quality states. Separate green success from teal interaction.
- **Mining:** preserve the system/list/detail layout, selected location's fill-plus-border treatment, labeled method/tier encoding, and numerical resource context. Do not preserve generic cyan-violet active-filter gradients.
- **Carrier Logistics:** preserve amber terminal identity, compact 4–6px silhouettes, top-row controls/cargo and bottom-row loadout/capability composition, segmented room grids/bars, cargo swatches paired with labels and fixed position, tabular values, and semantic green/amber/red overrides.
- **Blueprint Tracker:** preserve compact disclosure/list hierarchy, amber structural rails, warm off-white primary text, and explicit focus-visible coverage. Consolidate its charcoal and later navy token generations.
- **Mission Browser:** preserve reputation-path rails/badges and the connected group/lane/card/dossier model. Reduce the number of simultaneous accent families.

These are targeted imports into the Direction A base, not a second theme.

## 6. Rejected patterns found in the application

- Cyan and violet used together as a generic selected gradient, notably Mining v2 active chips.
- Violet, teal, and blue stacked on one Mission selected row; multiple hues are not multiple state cues.
- Colored or glowing edges on every peer card, including Dashboard's four equivalent mini-card categories when color is not semantic.
- Faint blue-grey operational copy: Carrier uses alpha `.28–.45`; Dashboard, Mining, Fitting, and Blueprint also contain measured failures.
- Meaningful cards, inputs, and rows separated only by sub-1.2:1 hairlines.
- Black-on-black or near-identical nested surfaces that force faint borders to carry all hierarchy, especially Carrier, Mission, and some Fitting panels.
- Decorative gradients/glass over dense content. Fitting's blurred overlays belong only over its controlled artwork stage.
- Hover and selected states that look nearly identical, including early Blueprint tab styling and several color-only states.
- Selected state communicated by glow or faint border alone.
- Tiny uppercase metadata below roughly 11px, especially Carrier's 0.49–0.63rem labels and Mining's 0.48rem labels.
- Green aliased to interaction teal in Build Queue.
- Focus rules that remove the native outline and replace it with only a quiet color change.
- Multiple unrelated routine radius systems, from 2px through 12px, without hierarchy meaning.

## 7. Proposed unified token table

These values are recommendations, not edits. Contrast must be validated in the final rendered combinations.

| Role | Candidate value | Use |
|---|---|---|
| Canvas background | `#05090D` | Global application canvas |
| Deep panel | `#081016` | Shell gutters, deep wells, major backing surfaces |
| Primary panel | `#0D161D` | Main cards, drawers, tool regions |
| Row / nested surface | `#121E27` | Rows and one routine nested level |
| Hover surface | `#172733` | Hover only; must remain distinct from selected |
| Default border | `#31414D` | Meaningful control/card boundary; target >=3:1 where required |
| Soft border | `rgba(176,199,214,.14)` | Decorative separators where boundary contrast is not required |
| Selected border | `#A78BFA` | Persistent selected edge, paired with fill/marker |
| Primary accent | `#49B8C6` | Global interaction, links, neutral active controls |
| Secondary accent | `#6699CC` | Information/readout, not a second selected hue |
| Purple semantic accent | `#A78BFA` | Selection, ownership, active relationship |
| Warning | `#F2AE49` | Warning, decisive/high-value emphasis |
| Danger | `#F06A6A` | Failure, destructive action, over-allocation |
| Success | `#43C987` | Completed, available, positive state |
| Primary text | `#EDF5FA` | Headings, values, operational body text |
| Secondary text | `#B8C7D2` | Supporting descriptions and labels |
| Muted text | `#8FA4B3` | Metadata; keep >=4.5:1 at normal sizes |
| Disabled text | `#657581` | Disabled only; preserve control silhouette separately |

### Proposed design-system architecture

#### Page canvas

Use one graphite/navy canvas with optional low-opacity cool radial ambience at page edges or behind a hero. Never place starfields, bright gradients, or detailed imagery behind dense text. Prevent giant black voids with bounded content widths, responsive column caps, minimum panel regions for legitimate empty states, and purposeful empty-state framing—not decorative filler.

#### Four routine surface levels

1. **Canvas:** page background and gutters only.
2. **Primary panel:** major task region, drawer, table frame, or grouped card.
3. **Nested panel/row:** one child level for records, compact summaries, or controls.
4. **Interactive/selected surface:** transient hover or persistent selected fill; selection must also use a border, marker, icon, underline, or explicit label.

Do not assign a new background to every DOM nesting level. Use spacing, separators, and alignment inside the nested level.

#### Borders and focus

- Quiet default: neutral and visible enough when it defines a control.
- Hover: primary-accent edge plus hover fill, no persistent glow.
- Selected: violet edge plus changed fill and a structural cue.
- Focus: 2px primary-accent or amber outline with 2px offset, at least 3:1 against adjacent colors; never remove without replacement.
- Warning/error: amber/red edge plus icon or text and a light semantic fill.

#### Accent roles

- **Cyan/teal (`#49B8C6`):** global interaction and links.
- **Blue (`#6699CC`):** neutral information/readout and charts.
- **Purple (`#A78BFA`):** selected, owned, active relationship; never generic decorative cyan.
- **Amber (`#F2AE49`):** warnings, decisive actions, high-value emphasis, and controlled Carrier/Blueprint identity.
- **Green (`#43C987`):** success, complete, available, positive only.
- **Red (`#F06A6A`):** danger, failure, destructive action, missing/over-allocation only.

Domain colors—rarity, cargo categories, reputation paths, and labeled mining methods—remain page-local and must be paired with text, icon, position, or shape.

#### Typography roles

- Primary text: headings, key values, and body copy.
- Secondary: descriptions and ordinary labels.
- Muted metadata: timestamps, provenance, and low-priority supporting detail, never required instructions.
- Disabled: unavailable controls only; opacity must not erase the control shape.
- Numeric emphasis: primary text or semantic status color with tabular numerics and consistent alignment.
- Section labels: secondary text, compact uppercase Rajdhani, generally no smaller than 11–12px at 1080p.

#### Card language

- Routine radius: 4–6px; 2–4px for compact rows/controls; 8px maximum for major hero/modal silhouettes. Pills and circles are semantic exceptions.
- Padding: 8–12px for dense rows/cards, 12–18px for primary panels, and 18–24px only for heroes/empty states.
- Headers: plain aligned title/action rows; optional narrow semantic rail. Avoid nesting a header card inside a panel card.
- Internal structure: separators and aligned grids before more card boxes.
- Shadow: one shallow black shadow on major panels; routine rows use no outer shadow. Saturated glow is reserved for focus or exceptional status and never defines selection alone.
- Artwork: use an opaque/dark backplate for all text and controls; no routine data directly on imagery.
- Cards should look neutral by default. Accent borders are for actual interaction, selection, status, rarity, or documented categories.

#### Page identity

Pages may retain one page-level accent, hero artwork, icon family, semantic badges, or specialized data visualization. They may not define a separate base canvas or card system. Carrier can be amber-led; Blueprint can use amber rails; Mission can retain path colors; Mining can retain labeled method colors; Fitting can retain ship/category treatments; all should inherit the same surfaces, text, focus, and state rules.

## 8. `.dash-hero-inner` reference-component decision

**Use it as a source of individual tokens and techniques rather than a shared component.**

`.dash-hero-inner` itself is only a balanced `1.05fr/0.95fr` grid with compact padding and responsive stacking. The perceived depth comes from `.dash-hero` and `.dash-hero-mini`: controlled ambient radials, graphite luminance steps, neutral edges, restrained shadow/glow, constrained copy, and a connected 2x2 workflow.

Promote the spacing, split-layout recipe, nested-surface step, copy-width limits, and responsive stacking. Keep the exact welcome/CTA/workflow DOM and atmospheric gradient Dashboard-local. A global hero component would impose overview-page composition on tables, queues, inventories, and logistics tools.

## 9. Carrier Logistics decision

Carrier should be **restyled onto the Direction A shared canvas/text/border system while influencing that system through its own strengths**. It should not be decorated to resemble the Dashboard hero.

Preserve:

- Top controls + cargo rooms and bottom loadout + capability composition.
- Warm amber identity for panel emphasis, capacity, decisive actions, and robust focus.
- Labeled cargo palette, segmented room bars/grids, crate chips, tabular numerics, and green/amber/red status meanings.
- Compact 4–6px radii, restrained `0 4px 14px rgba(0,0,0,.3)` shadow, and existing coherent spacing.

Fix:

- Text contrast first. Measured labels range from **1.79:1 to 2.54:1**, far below 4.5:1. Examples include `.clog-room-stat-label`, `.clog-cap-row-sublabel`, `.clog-room-capacity`, `.clog-inline-card-label`, and `.clog-field-label`.
- Raise 0.49–0.63rem operational labels; the current wide-tracked uppercase treatment is too fragile.
- Strengthen required panel/input boundaries; `.clog-panel`'s white `.07` edge is only about **1.19:1**.
- Add a durable focus-visible outline; border-color-only focus at amber `.4` is insufficient.
- Improve title/section entry hierarchy and constrain widescreen scan distances. Do not broadly increase spacing—the compact composition is valuable.

Color/typography are the primary readability failures, density is secondary, and spacing is not the root problem.

## 10. Migration sequence after approval

Each pass should be isolated, visually reviewed at 1920x1080 and 2560x1440, keyboard checked, contrast measured, and build/typechecked before the next begins.

1. **Global tokens and canvas.** Add the proposed semantic roles alongside existing tokens; map only shared shell/canvas consumers first. Do not delete page-local tokens yet. Validate screenshots and contrast.
2. **Shared cards, rows, and borders.** Introduce the four-level surface grammar, 4–6px routine radius, meaningful boundary rules, reduced routine shadows, and separators. Migrate one representative overview and one dense tool before expanding.
3. **Typography and contrast.** Replace faint operational roles, establish minimum practical metadata sizes, preserve Rajdhani/tabular numerics, and fix Carrier first. Re-measure composited contrast.
4. **Interactive, selected, and focus states.** Standardize hover, selected fill + border + structural cue, 2px focus-visible ring, warning/error treatment, and disabled silhouettes. Use Build Queue as the selected-state reference.
5. **Page-specific cleanup.** Consolidate Dashboard/Fitting local tokens; simplify Mission/Mining competing accents; reconcile Blueprint's token generations; retokenize Build Queue without changing layout; restyle Carrier surfaces/text while preserving logistics composition and cargo semantics.
6. **Cross-resolution verification.** Recapture every target route with comparable populated fixtures at both sizes. The audit ultimately produced both target sizes for all seven routes, but populated Blueprint tracked/browse states and consistently controlled data fixtures still need a future comparison.

Do not combine these passes into a single all-page refactor. No data, state, extraction, routing, calculations, or responsive behavior should change.

## Evidence limits and implementation risks

- Screenshots were ultimately captured at both target sizes for all seven routes. They were not fully uniform in populated data state, and Agent 4 had no live computed-style automation for every node.
- Runtime data was not a controlled populated fixture. Dashboard and Carrier were sparse, and Blueprint Tracker was empty.
- Long Mining and Blueprint stylesheets contain late overrides, so computed styles must be confirmed before token replacement.
- Contrast ratios here are measured from declared/composited flat colors and reliable for the cited failures; gradients and stacked translucency still require rendered verification.
- The report itself is the only root-level repository artifact created in synthesis. Application source was not edited. `npm run build` passed after report generation.

## Required end summary

- **The winning foundation:** Dashboard/Fitting (Direction A), using its tokens and surface techniques rather than copying its hero components.
- **The final score difference:** Direction A wins **78.5 to 71.4**, a **7.1-point** lead.
- **The five most important unification changes:**
  1. Establish one graphite/navy canvas and a maximum four-level surface hierarchy.
  2. Raise faint/small operational text to accessible, long-session-readable roles—Carrier first.
  3. Standardize meaningful borders and a robust 2px `:focus-visible` indicator.
  4. Require selected states to use fill plus border and a structural/textual cue.
  5. Assign one global interaction accent and reserve purple, amber, green, and red for explicit roles while retaining labeled domain colors.
- **The three patterns that must not be carried forward:** generic cyan-violet multi-glow selection; faint sub-11px blue-grey operational text; near-black nested surfaces separated only by imperceptible hairlines.
- **The recommended first implementation pass:** introduce and validate shared canvas, surface, text, border, and semantic token roles without deleting local page tokens or changing page behavior.

## 11. Option A implementation brief

### Decision lock

Proceed with **Direction A (Dashboard/Fitting)** as the base system. This is no longer an open theme comparison. Direction B remains evidence for specific interaction patterns and page structures, not an alternative base theme.

The implementation target is:

> Dashboard/Fitting graphite depth and restrained atmosphere, combined with Build Queue's redundant selected-state cues and the existing information architecture of each tool.

This does not authorize copying `.dash-hero` onto every page. It authorizes consolidating its canvas, luminance, border, inset-edge, type, and accent techniques into shared tokens and small primitives.

### Definition of done

The Option A migration is complete only when all target pages meet these gates:

- The page uses the shared canvas and no more than four routine surface levels.
- Routine cards use a 4–6px radius; 8px is reserved for large compositions, and pills remain fully rounded.
- Normal text is at least 4.5:1; meaningful controls, focus indicators, selected edges, and graphical boundaries are at least 3:1 against adjacent colors.
- No operational label is made faint merely to create hierarchy. Metadata below 12px must be treated as exceptional and tested at both resolutions.
- Hover and selected states are visibly different. Selection uses at least fill plus border, with a marker, icon, or text cue where practical.
- Cyan is interaction, purple is selected/owned relationship, amber is decisive/warning/high-value, and green/red remain positive/danger semantics.
- Routine surfaces do not use saturated glow. Any page-level atmospheric glow stays behind non-tabular hero content.
- The page is understandable in grayscale and remains efficient at 1920x1080 and 2560x1440.
- Keyboard focus is always visible with the shared 2px focus indicator.
- No application behavior, state, data, calculations, routing, or responsive logic changes as part of visual migration.

### Implementation work packages

| Package | Scope | Exact starting files | Output | Acceptance evidence |
|---|---|---|---|---|
| A1 — Foundation tokens | Add the approved canvas, four surfaces, borders, text roles, semantic accents, radii, restrained shadows, and focus ring alongside current tokens | `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/components.css` | Shared semantic tokens with compatibility aliases; no page conversion yet | Token inventory, contrast calculations, build |
| A2 — Shell and canvas | Apply canvas/deep-panel roles to the shared application shell; remove giant pure-black/flat void behavior without changing layout | `src/components/dashboard/DashboardShell.tsx`, `src/styles/dashboard.css`, `src/styles/layout.css` | Stable Option A background surrounding every shell route | Dashboard plus one dense route at both resolutions |
| A3 — Reference primitives | Extract only repeatable panel/row/control techniques; do not extract `.dash-hero-inner` as a component | Existing shared styles plus the smallest relevant component/style files | Primary panel, nested row, selected surface, input/control, modal shell style contracts | Story/fixture or paired route screenshots; keyboard check |
| A4 — Inventory pilot | Migrate Inventory page and its modal family first, retaining all current inventory behavior and structures | `src/components/logistics/inventory.css`; visual wrappers in `src/pages/logistics/InventoryPage.tsx`, `InventoryTransferDialog.tsx`, and `InventoryEntryPanel.tsx` only if a shared class must be attached | First dense operational proof of Option A | Inventory card/list modes and modal states at both resolutions |
| A5 — Accessibility remediation | Fix known faint labels, control boundaries, and focus failures before decorative cleanup | Page-local CSS identified in Sections 4, 9, and 12 | WCAG-aligned operational text and states | Selector-level contrast record and keyboard walkthrough |
| A6 — Page migrations | Migrate one page per isolated change set in this order: Carrier, Build Queue, Mission, Mining, Blueprint, Fitting, Dashboard cleanup | Existing page-local CSS only unless a proven shared primitive is missing | Consistent system with preserved page identity | Before/after pairs, build per page |

Inventory is the recommended pilot because it exercises the shared shell, filters, cards, nested material rows, a table, selection, forms, dropdowns, destructive confirmation, transfer workflow, and a large import workspace. If Option A works there without losing density, it is sufficiently scalable for the rest of the product.

### Ticket-writing format

Every implementation ticket should contain:

1. **Confirmed selectors and current values.** No broad instruction such as “make it more like Dashboard.”
2. **Approved token mapping.** State which existing declarations map to which proposed roles.
3. **Behavior freeze.** List state, events, data, responsive behavior, and calculations that must not change.
4. **Visual acceptance criteria.** Include contrast, state cues, radii, surface count, density, and page-identity requirements.
5. **Required captures.** Same populated state at 1920x1080 and 2560x1440, plus the relevant hover, selected, focus, disabled, warning, error, and modal states.
6. **Verification.** `npm run build`, targeted existing UI tests, keyboard walkthrough, and contrast measurements.

## 12. Inventory and modal extension audit

### Scope and evidence

This supplemental pass covers:

- Inventory route: `/logistics/inventory`
- Main implementation: `src/pages/logistics/InventoryPage.tsx`
- Primary styling: `src/components/logistics/inventory.css`, with inherited rules from `src/components/logistics/logistics.css`
- Add/Edit Stack composition: `InventoryEntryPanel` inside `.logi-drawer.logi-entry-modal`
- Related modal variants: `.logi-csv-modal`, `.logi-inv-modal--transfer`, and `.logi-inv-modal--danger`

The populated inventory fixture and live Add Stack modal were inspected at 1920x1080 and 2560x1440. Captures are stored under `.agents/theme-audit/screenshots/`. This extension does not alter the original seven-page family score because Inventory was added after the blind comparison.

### Supplemental score

| Target | Hierarchy /20 | Readability /20 | Layering /15 | Accent /15 | States /10 | Scalability /10 | Density /10 | Total /100 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Inventory page | 16 | 13 | 11 | 9 | 8 | 7 | 8 | **72** |
| Add/Edit modal | 16 | 11 | 12 | 10 | 7 | 7 | 8 | **71** |

These are diagnostic scores, not a revised family result.

### Inventory page: preserve

- The location-card to connected-detail flow is operationally clear and avoids a detached side drawer.
- Search, item, location, minimum quality, view mode, count, and management actions form a compact control plane.
- The expanded location material grid is data-dense and uses tabular quantities effectively.
- Material, quality, reservation, unavailable, success, and destructive meanings already have distinct textual or structural cues in many places.
- Card and list modes support different work patterns without inventing separate data flows.
- The existing fixture and `tests/ui/inventory-layout.spec.ts` provide a useful regression base for layout verification.

### Inventory page: change for Option A

The late `.logi-inv-page` block creates a complete Direction B theme locally:

- Canvas `#010A12`
- Deep/primary/row surfaces `#03121C`, `#04131D`, and `#051A28`
- Hover `#081E2C`
- Cyan `#00E6D2`, blue `#4DA3FF`, and purple `#B85CF6`
- Routine 8–12px radii

This should be mapped to shared Option A roles instead of replaced by another page-specific palette.

Priority changes:

1. Map `.logi-inv-page`, `.logi-inv-filter-bar`, `.logi-location-detail`, `.logi-inv-layout`, location/material cards, rows, and controls onto the approved canvas and four surface levels.
2. Reduce routine 8–12px card/control radii toward the shared 4–6px language. Keep a maximum 8px only for the large filter/detail/modal compositions.
3. Replace the purple primary Add Stack treatment with decisive amber. Retain cyan for neutral interaction and purple for selected/owned relationships.
4. Simplify `.logi-location-card--selected`: keep its fill plus border and active badge, but remove the routine cyan halo. The state already has enough redundant cues.
5. Preserve material/quality colors only where labels or data make their meaning explicit. The purple “City,” “Raw,” and active-control treatments currently compete with primary actions and selection.
6. Raise `--text-muted: #5F7285`. It measures **3.79:1** on `#04131D` and **3.82:1** on `#03121C`, failing 4.5:1 for normal text. This affects breadcrumbs, 10px kickers, stat labels, form labels, hints, counts, and row metadata.
7. Strengthen `--panel-border: #0E2A36`. It measures only **1.26:1** against `#04131D`, so it cannot serve as a meaningful control or panel boundary. Quiet decorative separators may remain softer; inputs and actionable boundaries may not.
8. At 1920x1080 the populated content ends high on the canvas. Do not fill the lower area with decorative cards; let the shared ambient canvas carry the void and keep the operational collection top-aligned.
9. At 2560x1440, constrain reading groups rather than merely stretching cards. Preserve the material-card maximum width, but make the grid's alignment and terminal edge intentional so the right-side remainder does not look accidental.

### Add/Edit Stack modal: preserve

- The centered composition correctly isolates a short transactional task.
- The overlay creates focus without decorative artwork behind the form.
- Material first, quality/quantity pair, unit/location pair, container, and notes form a coherent entry sequence.
- The two-column structure is efficient at desktop width and collapses through existing responsive behavior.
- Header, body, and action footer are clearly separated.
- Focused Material already uses more than hue alone: border plus outer outline/ring.

### Add/Edit Stack modal: change for Option A

1. Treat the modal as a shared primary-panel composition, not a page-local 12px navy card. Use an 8px maximum outer radius and 4–6px fields/buttons.
2. Use the shared primary panel over a deep overlay; retain restrained blur, but remove any need for colored outer glow.
3. Increase the modal's control and separator boundaries to the meaningful-border role. The current `#0E2A36` edge is only **1.26:1** against the panel.
4. Move `.logi-form-label`, `.logi-form-hint`, and placeholders off `#5F7285`. At 10–11px, the current 3.79–3.82:1 contrast is both a formal failure and visibly fatiguing.
5. Use the shared **2px** focus-visible ring. The local rule currently supplies a 1px cyan outline, while transfer-picker focus substitutes border and a 1px shadow.
6. Change the enabled “Add to Inventory” action to decisive amber. Purple remains appropriate only for selected/owned relationships; disabled appearance must retain a visible control silhouette rather than relying on `opacity: 0.45`.
7. At 2560x1440, the 640px modal reads undersized and the already faint text becomes harder to acquire. Keep the form line length controlled, but allow a modest responsive width increase (approximately 680–720px) and slightly stronger type rather than scaling the entire interface.
8. Preserve explicit red border, title, copy, and action treatment for `.logi-inv-modal--danger`; do not reuse amber or purple for destructive confirmation.
9. Keep Transfer and Bulk Delete compact. The CSV import workspace is a different large-workspace variant and should use the same tokens without being forced into the small confirmation-modal dimensions.

### Inventory migration acceptance checklist

- Card mode, list mode, location selection, manage mode, transfer, delete, Add/Edit, and CSV import behavior are unchanged.
- The page and every modal use shared tokens; no replacement `--inventory-theme-*` palette is introduced.
- Muted operational text passes 4.5:1 and all meaningful input/control boundaries pass 3:1.
- Selected location differs through fill, border, and badge/structural cue without routine glow.
- Add Stack/Add to Inventory is amber; neutral links/hover are cyan; active view/owned relationship is purple; success and danger retain green/red.
- Modal keyboard focus is visible on every control, Escape/close behavior remains unchanged, and focus containment/return is verified.
- Screenshots cover page card/list modes and Add/Edit, Transfer, Delete, and CSV variants at both target resolutions.
- Existing inventory layout tests and `npm run build` pass.

### Recommended first implementation ticket

**Inventory Pilot 1 — tokens, contrast, and modal shell only**

- Map Inventory canvas, primary panel, row, hover, text, border, focus, and semantic colors to the approved global roles.
- Restyle the Add/Edit modal shell and form controls with those roles.
- Do not change grid definitions, DOM structure, component state, event handlers, persistence, transfer/delete/import flows, or responsive breakpoints.
- Validate the Add/Edit modal plus the populated card fixture at both resolutions before touching location-card silhouettes or the list table.

This is the safest first proof that Option A can support a dense operational workflow rather than only Dashboard atmosphere.
