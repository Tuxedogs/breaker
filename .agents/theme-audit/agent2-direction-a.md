# Agent 2 — Direction A: Dashboard and Fitting Mockup

## Scope and evidence

Investigation only. No application source was edited. The reviewed routes are `/dashboard` (`src/pages/DashboardPage.tsx`) and `/fitting-mockup` (`src/pages/FittingMockupPage.tsx`, composed from `src/components/fitting/mockup/*`). Primary styling evidence is `src/styles/dashboard.css`, `src/components/fitting/mockup/fitting-mockup-shell.css`, and shared `src/styles/tokens.css`.

This assessment is source/structure based. I did not obtain a reliable matched pair of populated screenshots at both target resolutions, so visual observations below are tied to explicit selectors and responsive rules rather than presented as computed/rendered measurements.

## Objective score

| Criterion | Dashboard | Fitting Mockup | Direction A combined | Evidence summary |
|---|---:|---:|---:|---|
| Information hierarchy (20) | 17 | 16 | 16.5 | Dashboard has a clear hero → KPI → cards sequence; Fitting has top bar → systems/ship → stats but many equally weighted micro-labels. |
| Readability/contrast (20) | 13 | 15 | 14 | Strong primary text, but Dashboard repeatedly uses 0.30–0.56 alpha blue-grey at 0.53–0.68rem; Fitting's solid `#8b97a3` is safer, while `#5f6b75` remains suspect at 11–13px. |
| Surface/card layering (15) | 13 | 13 | 13 | Both use controlled luminance steps, borders, inset highlights and dark shadows; Dashboard's routine shadows are heavier than necessary. |
| Accent discipline (15) | 10 | 12 | 11 | Fitting gives teal/orange useful interaction/system roles but also category purple/blue; Dashboard mini-card borders decorate four categories with cyan/violet/orange/green. |
| Interaction/selected clarity (10) | 7 | 6 | 6.5 | Dashboard CTAs are clear, but many links rely on hover border. Fitting `.fm-equip-row.is-selected` is primarily a faint teal border/inset; fill barely changes and no selected icon is guaranteed. |
| Cross-page scalability (10) | 8 | 8 | 8 | Dashboard primitives suit cards/queues; Fitting rows/panels suit dense tools. Hero compositions themselves do not scale as global wrappers for tables. |
| Density/space efficiency (10) | 8 | 9 | 8.5 | Dashboard is compact but allocates substantial height to overview content; Fitting is intentionally dense and uses tabular numerics and ellipsis well. |
| **Total** | **76/100** | **79/100** | **77.5/100** | Direction A is a credible foundation, not an automatic winner. Accessibility and state clarity prevent a higher score. |

## Dashboard audit

### Canvas and hierarchy

- `.dash-page` uses shared `--bg-app`, whose explicit stack is a graphite/navy canvas (`#03070a` → `#071218` → `#070e11`) with extremely low-opacity ambient cool radials (`tokens.css:20–28, 73–76`). This is appropriate for long sessions: space-oriented without a literal starfield.
- `.dash-content-grid` uses a practical main/280px rail split, 1rem gap and centered maximum (`dashboard.css:947–957`). At ≤1280px the rail narrows and the hero stacks; at ≤1100px the entire page becomes one column (`2774–2802`). At 2560×1440 the `min-width:1800px/min-height:1000px` rules increase selected text sizes (`2992+`), which is a good explicit readability strategy.
- The page sequence in `DashboardPage.tsx` is hero, KPI row, operational cards and right rail. This is a stronger global information model than making every section an equally prominent card.

### How `.dash-hero-inner` creates focus

`.dash-hero-inner` itself is a restrained layout primitive, not the source of the visual depth: it is a two-column grid with balanced `1.05fr/0.95fr`, 1rem gap, stretch alignment and 1.1rem padding (`dashboard.css:996–1003`). The depth comes from its parent and children:

1. `.dash-hero` establishes the deep silhouette: three subtle ambient radial accents under a near-opaque graphite gradient, a cyan-tinted 0.14 border, a 40px black shadow, only 0.05 cyan glow, and a 0.04 inset top highlight (`980–994`). This makes the panel feel raised without turning it into a neon object.
2. `.dash-hero-content` vertically centers a short textual hierarchy (`1005–1013`); `.dash-hero-title` is bright `#e7edff`, 1.28–1.72rem and capped at 22rem, while the subtitle is smaller/dimmer and capped at 28rem (`1024–1042`). This prevents long-line drift.
3. `.dash-hero-workflow` forms a 2×2 operational snapshot (`1088–1094`). Each `.dash-hero-mini` is visibly a nested surface through a lighter `rgba(24,29,33,.92)` → `rgba(16,20,23,.96)` gradient, quiet white border, inset highlight and smaller shadow (`1096–1108`).
4. Focus is split between a solid amber primary CTA and the brighter mini-card values. This is effective but not perfectly disciplined: cyan, violet, orange and green borders on the four mini cards (`1118–1128`) make category identity look partly semantic and partly decorative.

At ≤1280px `.dash-hero-inner` becomes one column and the workflow becomes four columns (`2779–2785`); at ≤1100px the workflow returns to two columns (`2800–2802`). That avoids crushing the text, but the 1280px four-up state should be visually verified because each snapshot can become narrow. At 1920/2560 the two-column hero should remain balanced.

### Card silhouettes, nesting and typography

- `.dash-card`, `.dash-card--rail`, and `.dash-stat-card` consistently reuse `--bg-card-dark`, `--border-soft`, `--shadow-card`, and 6px radii (`1176–1186`, `1564–1582`). This consistency is promotable.
- Routine `--shadow-card` is heavier than the desired terminal language: two black shadows at 14/30 and 2/8 with ~0.73–0.75 opacity (`tokens.css:116–119`). It gives strong separation, but repeated across every card can create floating-card stacks. Prefer shallower shadow plus luminance/border separation globally.
- Nested readouts such as `.dash-reserve-metric` and `.dash-qinv-stat` use a quiet 0.025 white fill and 0.06 border (`1330–1337`, `1430–1437`). This is a good row/nested-panel technique, though repeated bordered metric tiles can become “card soup” if generalized indiscriminately.
- Typography hierarchy is generally strong and Rajdhani-consistent. Primary values use tabular numerics (`.dash-tabnum`, `.dash-stat-value`). However, many labels are too small/faint for a global system: `.dash-hero-mini-label` 0.6rem at alpha .56, `.dash-hero-mini-meta` 0.68rem at .52, `.dash-stat-sublabel` 0.68rem at .38, `.dash-stat-tooltip-title` 0.53rem at .45, and `.dash-update-date` 0.58rem at .30. These should be simplified/upgraded before promotion.

### Interaction and accent discipline

- The solid amber `.dash-hero-cta--primary` is unmistakably actionable (`1066–1074`); secondary cyan is visibly subordinate (`1076–1085`). Preserve the hierarchy, but decide globally whether amber or cyan is the primary interaction color.
- Semantic green/red/amber stat modifiers and status badges are mostly truthful (`1217–1218`, `1339–1361`, `1410–1419`).
- The hero mini-card category borders use four accent hues even though all four cards are equivalent navigation. This adds flavor but weakens the distinction between status, selection and category. Keep the neutral mini-card surface; remove or greatly quiet per-card hue unless the hue carries a documented semantic role.
- Focus treatment is incomplete in the audited selectors. `.dash-stat-info-btn:focus` changes color and explicitly removes outline (`1255–1269`) without a replacement focus ring. This pattern must not enter a shared system.

## Fitting Mockup audit

### Relationship to Dashboard

Fitting Mockup feels like the same product family in typography, graphite surfaces, small radii, inset top highlights, compact uppercase labels and restrained glow. It is not technically the same theme: `.fm-shell` locally defines `#05080a` canvas, `#e8edf2` text, `#8b97a3/#5f6b75` muted roles, teal `#5a9aaa`, orange `#c98a45`, purple `#9b7fd4`, plus its own panel/border tokens (`fitting-mockup-shell.css:3–30`). Dashboard instead consumes global Void Navy tokens and uses brighter cyan/orange/violet values. A global rollout should unify roles, not copy `.fm-shell` wholesale.

### Operational strengths

- `.fm-shell` is a disciplined full-viewport grid: 64px rail, 320px systems, flexible hero, 390px right rail with 10px gaps (`3–45`). This scales a visual center alongside dense operational data better than overlaying data on artwork.
- `.fm-panel` and `.fm-stat-card` share a near-identical dark gradient, 4px radius, 0.07 border and small inset highlight (`235–244`, `421–460`). The language is coherent and dense.
- `.fm-equip-row` is an effective queue/inventory row candidate: grid alignment, 3rem minimum height, 4px radius, 0.06 border, modest luminance change on hover, tabular quantity, truncation, and a 4px category strip (`254–307`). It can scale to inventories and queues if category colors are semantic and accessible.
- Numeric and compact type tokens are explicit (11–15px, `25–29`). Labels and counts use consistent casing/spacing, and scroll containment prevents panels from expanding unpredictably.
- Responsive behavior is clear: large screens increase stats height (`791–799`); below 900px the fixed cockpit grid linearizes and stats become two columns, then one below 700px (`805–829`).

### Weaknesses and decorative interference

- `.fm-hero-stage` is a dashboard-only/fitting-only visual composition, not a table surface. Its ship art, 60px inset shadow, warm ceiling/floor radials and large drop shadow (`312–340`) create excellent object focus, but would interfere behind dense text. Keep artwork isolated to a dedicated stage.
- The hero overlays (`.fm-hero-inspect`, nav arrows, exit pill) use translucent black/backdrop blur (`344–373`). These are readable over the controlled artwork, but glass overlays should not become routine panel styling.
- `.fm-equip-row.is-selected` changes only to a very faint teal border (`rgba(90,154,170,.24)`) and subtle inset (`.06`), while the base accent strip remains category-colored (`272–284`). It does not reliably provide the required two selected-state cues. Add selected fill plus border/icon in a future implementation.
- `.fm-topbar-tab.is-active` uses text plus a bottom border, which is better than glow alone (`86–92`) but should receive an explicit keyboard focus style.
- Category accents are over-broad: orange covers pilot, turret, armor and power; purple covers alternate turret and missile; blue covers EMP (`274–284`). These may be meaningful domain categories, but their mappings are not self-explanatory and should not become global semantic color roles.
- `.fm-muted-2: #5f6b75` is widely used at 11–13px (`10–11`, e.g. group counts and tags at `248–249`, `303–307`). This likely produces fatigue even where contrast narrowly passes; promote the hierarchy only after raising the dim role.
- Routine panels carry 28px/0.42 or 18px/0.32 shadows (`235–240`, `421–433`). This is restrained compared with neon, but a global dense tool should rely more on adjacent luminance and borders.

## Promotion decision

### Promote into the global design system

- The graphite/navy canvas principle from `--bg-app` and `.fm-shell`: near-black graphite with very subtle ambient cool depth, never pure black or artwork behind text.
- A maximum four-level luminance hierarchy derived from Dashboard `--bg-app` / `--bg-panel` / `--bg-card-dark` and Fitting `.fm-panel` / `.fm-equip-row`.
- Quiet 1px neutral borders with an inset 1px top highlight; small 4–6px routine radii.
- Rajdhani-first hierarchy, tabular numerics, compact but not sub-11px metadata, short uppercase section labels.
- Fitting's row geometry (`.fm-equip-row`) for dense queues/inventories, after fixing selected/focus states and validating category accents.
- Dashboard's clear solid-primary versus outlined-secondary action hierarchy, after selecting one global interaction accent.
- Responsive density tokens and explicit 2K readability adjustments rather than merely stretching content.

### Retain only on Dashboard (or the owning visual page)

- The exact `.dash-hero` composition and its welcome copy/2×2 operational snapshot.
- Fitting's `.fm-hero-stage`, ship image lighting/floor, inspection overlay, ship navigation and exit pill.
- Hero artwork/drop shadows and large ambient radial placement. These are identity mechanisms, not routine surfaces.
- Per-domain category strips on fitting equipment, provided their semantics are documented.

### Simplify before reuse

- Treat `.dash-hero-inner` as a source of spacing/layout techniques, not a shared component. The grid is generic, but the visual result depends on Dashboard-specific parent gradients and workflow children.
- Reduce routine card shadows (`--shadow-card`, `.fm-panel`, `.fm-stat-card`) and establish depth mainly through controlled luminance steps plus borders.
- Raise faint Dashboard metadata alphas/sizes and Fitting `--fm-muted-2`; avoid 0.53–0.60rem operational labels.
- Neutralize the four `.dash-hero-mini--*` borders unless they convey actual status.
- Give selected items two durable cues (fill + border, or border + icon/marker) and add explicit `:focus-visible` rings throughout.
- Harmonize token roles: Dashboard cyan `#38bdf8` and Fitting desaturated teal `#5a9aaa` currently imply different interaction systems; orange values also differ.
- Limit nested tile borders: use separators/rows inside cards when the group already has a clear parent.

### Reject as global patterns

- No global hero primitive based on the exact `.dash-hero-inner` DOM. It would force overview-page composition onto tables, queues and logistics tools.
- No glass/backdrop-blur overlays as routine dense-panel styling.
- No selected state communicated by faint border/glow alone (`.fm-equip-row.is-selected`).
- No focus rule that removes the outline without a visible replacement (`.dash-stat-info-btn:focus`).
- No decorative multi-accent borders on peer navigation cards; color must communicate interaction, selection, status, rarity or a documented domain category.
- No routine tiny, faint uppercase metadata such as `.dash-stat-tooltip-title` and `.dash-update-date`.
- No universal heavy floating-card shadow stack.

## Scalability verdict

Direction A can scale across tables, queues, mission cards, inventories and logistics tools if its **tokens and techniques** are promoted rather than its hero components. Dashboard supplies the stronger canvas and overview hierarchy; Fitting supplies the stronger dense row/panel grammar. The family is premium and ship-terminal-like because it uses controlled dark luminance, thin edges and sparse glow, but it is not yet a unified system. The main blockers are faint metadata, insufficient focus/selected cues, competing local accent definitions and overuse of shadows for routine separation.

`.dash-hero-inner` decision: **source of individual tokens and techniques rather than a shared component**. Promote its balanced split, compact padding, nested-surface luminance step and responsive stacking. Keep the exact hero gradients, CTA/workflow composition and category treatments Dashboard-local.

## Risks / unknowns

- No matched 1920×1080 and 2560×1440 screenshots were captured in this pass; exact line wrapping, scroll pressure and computed alpha compositing require visual/computed-style verification by the evidence/accessibility agents.
- Fitting category-color semantics were inferred from selector names; the code does not establish a global legend, so those mappings should not be promoted without product confirmation.
- Contrast judgments here flag risk from declared values; they are not substitutes for composited WCAG measurements.
