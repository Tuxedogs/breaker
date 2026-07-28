# Moonbreaker Design Canon

Updated: 2026-07-28

This canon describes the visual system currently implemented across Moonbreaker / Scintel. It is the default reference for new UI work and for page-by-page visual refinement.

It does not approve every existing page-level rule. The shared tokens and interaction roles are authoritative; page-local composition must still be judged against the workflow it supports.

## Product Character

Moonbreaker should feel like a dark, premium spacecraft operations interface:

- Dense but readable
- Operational rather than ornamental
- Calm during long sessions
- Strongly hierarchical
- Compact where records repeat
- Restrained in glow, gradients, and accent use
- Clear about state without relying on color alone

The interface is built on graphite-black and deep navy surfaces with cool structural highlights, amber decisive actions, and labeled semantic colors.

The original Next Fabrication Run composition is the primary quality benchmark for operational UI. It succeeds because its hierarchy, density, grouping, and action path are designed around the workflow. It is not a universal card template, and its exact three-column geometry should not be copied onto unrelated pages.

## Implementation Authority

Use these files as the implemented source of truth:

| Responsibility | Source |
|---|---|
| Global palette, typography, density, and semantic tokens | `src/styles/tokens.css` |
| Shared 1440p control and typography scaling | `src/styles/density-2k.css` |
| Opt-in primary operational-card perimeter | `src/styles/operational-surfaces.css` |
| Dashboard composition and Dashboard-specific scaling | `src/styles/dashboard.css` |
| Page layout, workflow density, and specialized states | The affected page’s local stylesheet |

Rules:

- Use existing shared tokens before adding page-local values.
- Keep workflow layout and specialized visualization in page-local CSS.
- Do not create a new global primitive for one page experiment.
- `ops-primary-card` controls the perimeter treatment only. It does not own page layout, spacing, typography, overflow, or interaction behavior.
- Page-local overrides must not silently cancel the shared 1440p density layer.
- When a page needs a special wide-screen rule, place it late enough in the cascade and use sufficient specificity for it to win.

## Recent Implementation Audit

The July 24–27 Build Queue and Inventory work established several implemented patterns:

- Build Queue now uses a compact selected-craft command card followed by peer Component Statistics and Material Allocation workspace cards. Statistics and allocation are not header content.
- Component Statistics consolidates source-backed end-product traits and isolates genuinely modified rows for Base, Target, and Allocation comparison.
- Weapon summaries lead with Alpha Damage and avoid redundant unmodified damage-channel rows when the total is present.
- Repeated material requirements keep the target-quality control in the compact summary and use progressive disclosure for reserve detail.
- Inventory defaults to a responsive Location → Material → Quality → Individual Boxes tree while retaining item-first and grouped-list alternatives.
- Inventory hierarchy evidence now includes populated desktop, populated compact, and empty states.

These are page-level precedents, not approval for a new global card primitive or a global palette change.

## Base Visual System

### Canvas

The app canvas uses the Void Navy graphite foundation:

| Role | Current token or value |
|---|---|
| Main graphite | `--void-bg-0: #03070a` |
| Raised canvas depth | `--void-bg-1: #071218` |
| Panel depth | `--void-bg-2: #0c141a` |
| Deep graphite | `--void-bg-3: #060d13` |
| Operational working canvas | `--ops-canvas: #050b11` |
| App background | `--bg-app` |

`--bg-app` uses extremely restrained cool radial depth over a graphite gradient. Large bright cyan, purple, or amber canvas washes are not part of the shared system.

Page identity should come from content, semantic accents, and specialized artwork—not from replacing the base canvas.

### Routine Surface Hierarchy

Use no more than four routine levels:

1. Canvas
2. Primary panel
3. Nested panel or row
4. Interactive, hover, or selected surface

Current operational roles:

| Role | Token | Current value |
|---|---|---|
| Primary surface | `--ops-surface-primary` | `#0a1119` |
| Deep structural surface | `--ops-surface-deep` | `#080f17` |
| Nested row | `--ops-surface-row` | `#0d151e` |
| Hover surface | `--ops-surface-hover` | `#111c27` |
| Selected surface | `--ops-surface-selected` | `#11202c` |
| Header band | `--ops-header-band` | `rgba(15, 22, 34, 0.64)` |

Do not create a different background for every level of nesting. A small luminance step, a quiet border, spacing, or a separator is usually enough.

### Borders, Radius, and Shadow

| Role | Token | Current value |
|---|---|---|
| Default operational border | `--ops-border-default` | `rgba(115, 143, 171, 0.20)` |
| Soft nested border | `--ops-border-soft` | `rgba(115, 143, 171, 0.14)` |
| Primary radius | `--ops-radius-primary` | `7px` |
| Nested radius | `--ops-radius-nested` | `4px` |
| Primary shadow | `--ops-shadow-primary` | Quiet black elevation plus a faint inset top edge |

Primary cards may use one restrained shadow. Nested rows should normally use borders or separators rather than their own shadows.

Do not:

- Give every card a glow.
- Use strong shadows on repeated rows.
- Stack multiple near-identical bordered cards when a grouped list would be clearer.
- Make hover and selected states look identical.

### Primary Operational Perimeter

`ops-primary-card` is an opt-in treatment for important workflow containers. It provides:

- Primary operational surface
- Quiet border
- Seven-pixel radius
- Restrained elevation
- A centered one-pixel cool highlight along part of the top edge

The top highlight is structural emphasis, not decoration. Use it on major task containers, not on every nested card or row.

Header bands may use `--ops-header-band` with a quiet lower separator. Internal content remains owned by the page.

## Typography and Numeric Presentation

### Families

- Primary and display: `Rajdhani`
- Monospace: `Roboto Mono`, then `Courier New`
- Use tabular numerals for quantities, quality, percentages, statistics, and aligned comparisons.

The current typography is compact and technical, but it must remain readable. Uppercase labels and generous tracking are appropriate for kickers, section labels, and compact metadata—not for long body copy.

### Shared Density Tokens

The 1080p base and 1440p layer are intentionally different:

| Role | 1920×1080 base | 2560×1440 layer |
|---|---:|---:|
| Body | `14px` | `15.5px` |
| Metadata | `12.5px` | `13.5px` |
| Label | `12px` | `12.5px` |
| Chip | `12px` | `13px` |
| Small title | `15px` | `17px` |
| Title | `16px` | `18px` |
| Page title | `20px` | `22px` |
| Statistic | `17px` | `19px` |
| Control height | `34px` | `38px` |
| Input height | `36px` | `40px` |
| Routine row | `38px` | `42px` |
| Card padding | `12px` | `14px` |

The shared 1440p layer activates at `min-width: 1800px` and `min-height: 1000px`. Page-local wide-screen layouts may use a later, narrower breakpoint when their composition requires it.

### Wide-Screen Acceptance

No overflow is not proof that a page scales correctly.

At 2560×1440, verify:

- Working width uses the viewport intentionally.
- Type and controls do not remain at 1080p physical scale.
- The page does not collapse into a small upper-left composition.
- Longer lines remain readable.
- Empty space is intentional rather than a consequence of width caps.
- Dense tables gain useful comparison space.
- Sparse cards are not stretched merely to fill the screen.
- Page-local CSS has not overridden the shared density layer accidentally.

The Dashboard currently uses a dedicated late-cascade wide-screen layer at `min-width: 2200px` and `min-height: 1200px`. Preserve that ordering when changing its recovery styles.

## Color and Accent Roles

Color must have a defined purpose.

### Structural and Interactive Color

| Family | Current role |
|---|---|
| Cool cyan/blue | Primary operational interaction, focus, selected boundaries, links, and structural highlights |
| Amber/gold | Decisive actions, active queue progress, warning, restriction, or important attention |
| Teal | Available, positive operational information, or a named semantic category |
| Green | Ready, valid, successful, or complete |
| Red | Error, shortage, danger, harmful, or invalid |
| Violet | Named domain categories such as reputation, mission grouping, or a defined quality tier |

Current shared values include:

- `--void-accent-amber: #ffb21a`
- `--accent-gold: #f59e0b`
- `--void-accent-teal: #4db8a8`
- `--ui-accent-cyan: #4db8b0`
- `--accent-violet: #a78bfa`
- `--ops-focus-ring: rgba(125, 211, 252, 0.94)`

Do not use cyan and purple together as generic visual decoration. They may coexist when each visibly represents a different named category or state.

### Text Roles

| Role | Current value |
|---|---|
| Primary text | `#edf7ff` |
| Secondary text | `#a9bad0` |
| Dim text | `#7a8fa3` |

Dim text is supporting information, not a default body color. Valid zero values, available actions, and live data must not look disabled.

## Badges, Chips, and State

Badges and semantic colors are a shared strength of the current UI. Preserve their clarity while controlling quantity.

Badges should be:

- Compact
- Text-labeled
- Bordered or filled enough to remain recognizable
- Used for actual state, category, or constraint
- Visually subordinate to the primary value or action

Do not turn every metadata value into a badge.

State must use at least two cues. Valid combinations include:

- Label and border
- Icon and label
- Fill and border
- Rail and text
- Disabled behavior and muted treatment

Available, selected, reserved, unavailable, missing, completed, Warehouse, and Pull must not rely on color alone.

Hover is transient. Selection is persistent. Focus must remain independently visible with a two-pixel ring or equivalent boundary.

## Card and Row Language

### Primary Panels

Use primary panels for complete task groups, not individual facts.

A primary panel should normally have:

- One clear purpose
- One header or entry point
- A readable internal hierarchy
- Limited nested surfaces
- A clear action endpoint where applicable

### Repeated Records

Repeated records should use compact rows, structured list rows, or small tiles.

Prefer:

- Stable columns
- Tabular values
- Quiet separators
- Truncation with an accessible full value
- Progressive disclosure
- Internal scrolling for large bounded collections

Avoid:

- Large feature cards for every physical box.
- Repeating the location name on every row inside a clear location group.
- Badge overload.
- Excessive vertical padding.
- Faint metadata that forces slow scanning.

### Artwork and Specialized Presentation

Artwork, hero lighting, category colors, and specialized visualization remain page-specific.

The Dashboard hero and Fitting artwork are not global card primitives. Reuse their spacing, restraint, layering, or border techniques only when appropriate.

Decorative gradients must not sit behind dense tables or reduce data contrast.

## Dashboard Canon

The Dashboard is an operational overview, not a collection of equal feature cards.

Current composition:

1. Compact planning hero with Inventory → Reserve → Fabricate sequence
2. Consolidated telemetry strip
3. Mining and Inventory operational overview modes
4. Build Queue and reserve/shortage support region
5. Next Fabrication Run handoff

Next Fabrication Run remains the composition benchmark. Preserve:

- Craft summary on the left
- Location → Material → Individual Boxes hierarchy in the center
- Action summary on the right
- Compact box rows
- Explicit state labels
- One decisive action
- Internal scrolling or disclosure for many boxes

Do not generalize its exact layout to every Dashboard module. The rest of the Dashboard should lead naturally into the fabrication handoff without duplicating it.

The telemetry strip is one chassis with internal dividers, not five unrelated floating cards.

At 2560×1440, the Dashboard must use its dedicated wide-screen scaling layer. Passing an overflow check alone is insufficient.

## Build Queue Canon

Build Queue is requirement-first and craft-first, not location-first.

Preferred hierarchy:

Craft → Material Requirement → Eligible Boxes

Preserve the current operational structure:

1. Compact queue rail
2. Selected-craft command card for identity, blueprint source, artwork, quantity, and craft actions
3. Full-width Component Statistics workspace card
4. Material Allocation workspace card
5. Auto Reserve, reserve detail, ownership state, and queue summary

The selected-craft, statistics, and allocation cards are peer workflow regions. Do not place the full statistics comparison or allocation workspace inside the identity header.

Component Statistics should:

- Consolidate authoritative stock and projected traits without duplicating the same stat across groups.
- Present end-product traits as the primary scan surface.
- Show a separate modified-stat region only when Target or Allocation actually differs from Base.
- Keep Base, Target, Allocation, units, and benefit direction together for modified rows.
- Preserve explicit loading, unavailable, not-set, no-allocation, and valid-zero states.
- Lead weapon summaries with Alpha Damage and suppress redundant unmodified channel rows when the total already provides the useful scan target.
- Render curves or allocation arrays as purpose-built visualizations; never relabel them as scalar values.

Gameplay units and aliases must be normalized in shared schema or projection helpers so Crafting, Fitting, and Build Queue agree.

Use stable comparison columns and semantic deltas. A numerically positive change is not automatically beneficial; direction styling must follow the stat’s gameplay meaning.

Material Allocation should keep the collapsed card focused on material identity, required and allocated amount, the target-quality control, average quality, and shortfall. Put reserve mechanics behind deliberate disclosure. Do not spend equal visual weight on a redundant zero-excess metric.

## Inventory Canon

Inventory defaults to:

Location → Material → Individual Boxes

Treat each inventory record as a physical box unless the UI explicitly represents an aggregate.

Quality may form an intermediate folder between material and boxes:

Location → Material → Quality → Individual Boxes

This is a comparison aid, not a replacement for the canonical location/material/box model. The Inventory page may also provide item-first and grouped-list views; location-first remains the default operational view.

Location containers should communicate:

- User-readable location name
- Total quantity or SCU
- Material count
- Box count
- Best or relevant quality
- Selection and availability state

Material groups should communicate:

- Material identity
- Aggregate amount
- Quality grouping
- Number of boxes

Individual boxes should communicate, where relevant:

- Material
- Quality
- Quantity or SCU
- Location
- Availability
- Reservation state
- Owning craft
- Pull or storage state
- Consumption order
- Expected remainder or refund

Use `Unknown Location` when an assigned location cannot be resolved and `Unassigned Stock` when no location is assigned. Never show raw location identifiers in normal UI.

## Crafting Detail Canon

Crafting Detail is the primary decision page between discovering an item and committing it to Build Queue.

It should use three primary regions:

1. Compact item identity and action header
2. Crafting and performance detail area
3. Blueprint Sources

### Item Identity and Actions

Present:

- Item visual or icon
- Item name and category path
- Description
- Quality, size, grade, and class where available
- Craft time and material count
- Save Blueprint
- Add to Queue

The item visual belongs inside the identity composition rather than in a detached sidebar card. Save Blueprint is secondary; Add to Queue is primary.

### Statistics and Effects

Preserve all existing statistics and values.

Use:

- Clear stat groups
- Muted labels and strong values
- Consistent numeric alignment
- Tabular numerals
- Compact rows
- Semantic delta treatment

Estimated Effects should expose the final value, percentage change, absolute delta, and contributing materials when those values exist.

Do not remove important statistics merely to simplify the page.

### Material Requirements

Material Requirements is the primary interactive section.

Each material row should make its role, name, required amount, selected quality, input control, resulting effect, and target relationship easy to scan.

Do not duplicate crafting, solver, allocation, or quality calculations inside presentation components.

### Blueprint Sources

Blueprint Sources remains a distinct lower section using compact rows or restrained cards. Preserve source, mission or acquisition metadata, availability, confidence, save state, and existing source logic.

Do not turn every source into a large feature card.

## Mission Browser and Blueprint Tracker Canon

These pages use the same operational canvas and primary surfaces while retaining semantic mission and reputation colors.

Semantic cyan, blue, teal, violet, amber, green, and red are allowed when they identify a real category, system, outcome, restriction, or state.

Mission cards should remain dense and comparable. Category colors should organize information, not make every card appear selected.

Blueprint Tracker should favor aligned repeated records, explicit acquired/open state, and compact detail disclosure.

## Mining Canon

Mining retains semantic method, quality-band, encounter, and recommendation colors on the shared graphite foundation.

Selected filters must be distinguishable from hover and inactive states. Tables and recommendation lists should favor comparison, stable columns, and tabular numerics.

Do not remove meaningful category colors solely to make Mining visually quieter.

## Carrier Logistics Canon

Carrier Logistics should preserve its compact adjustable-resource cadence, aligned label/control/action columns, explicit resource legend, and capacity visualization.

It must use the shared readability floor. Valid zero values, capacities, and available controls must not appear disabled through tiny type or whole-card opacity.

Use opacity only as a supporting cue for disabled or unavailable states, never as the sole cue.

## Fitting Canon

Fitting uses the shared graphite/navy base with page-specific ship artwork, inspection lighting, equipment category strips, and performance visualization.

Preserve dense comparison rows, aligned numeric values, and clear equipment selection. Artwork and lighting may establish page identity but must not interfere with operational controls or data contrast.

The Dashboard hero and Fitting scene may share restraint, layering, and typography without becoming one global hero component.

## Terminology and Data Truth

Gameplay and operational truth must come from extracted, shared, solver-owned, or server-provided data paths.

Do not:

- Infer gameplay meaning from frontend assumptions.
- Duplicate calculations in presentation components.
- Invent production Min to Target results.
- Relabel reservation, allocation, Pull, or Warehouse state without an authoritative source.
- Expose development fixture values in production.

### Quality Language

Never place the letter Q before or after a quality value.

Use:

- Quality 965
- Target 924
- Projected 911
- Minimum Quality 965
- 0.42 SCU at Quality 965

### Target and Min to Target

When an existing shared source provides the values, the UI may present:

- Target
- Projected quality
- Minimum Quality for Remaining Quantity
- Minimum Quantity at a Selected Quality
- Target Met
- Target Unavailable With Current Inventory
- Best achievable projected quality

If those values do not exist, document the missing contract and use deterministic development-only fixtures for visual review. Do not recreate the calculation in UI code.

### Inventory Language

Use `Box` for a discrete physical container. Backend aggregate terminology must not leak into normal user-facing inventory UI.

Grouping depends on the workflow:

- Inventory: Location → Material → Boxes
- Build Queue: Craft → Material Requirement → Eligible Boxes
- Reserve selection: Material Requirement → Eligible Boxes → Location
- Pull view: Location → Retrieval Order → Material → Boxes

## Accessibility and Interaction

WCAG 2.2 AA is the minimum floor:

- Normal text: 4.5:1
- Large text: 3:1
- Meaningful controls and visual indicators: 3:1

Also require:

- Visible two-pixel focus treatment
- Keyboard-operable disclosure and selection
- Non-color state cues
- Readable muted text
- Clear disabled behavior
- Distinct hover, focus, selected, reserved, unavailable, and error states
- Sufficient border visibility in real screenshots, not only mathematical contrast
- Reduced-motion support through the existing global media query

## Responsive and Visual Validation

Visual changes require deterministic evidence. Tests and builds alone are not enough.

Inspect at minimum:

- 1920×1080
- 2560×1440

Also inspect mobile when the affected component already supports mobile or the task requests it.

For responsive logistics hierarchies, the standard compact evidence size is 768×900 unless the task specifies another viewport.

For each affected page, check:

- Populated state
- Empty state
- Long names
- Many rows
- Overflow and clipping
- Hover and focus
- Selected and unavailable states
- Contrast and density
- Intentional wide-screen scaling

Run at minimum:

```bash
npm run build
```

Run targeted tests when the changed code has an existing suite.

## Implementation Guardrails

Visual work must not change:

- APIs
- Database behavior
- Authentication
- Routing
- Production data contracts
- Inventory totals
- Reservation or allocation logic
- Solver behavior
- Crafting calculations
- Fitting calculations
- Mining calculations
- Material modifier calculations
- Blueprint-source logic
- Save Blueprint behavior
- Add to Queue behavior or payloads

Prefer small page-local changes. Stop when the requested scope is complete.
