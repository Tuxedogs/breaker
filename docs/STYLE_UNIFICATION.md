# Breaker style unification plan

**Visual target update (2026-10-29, LOCKED):** This plan establishes shared styling infrastructure and remains valid for `--mb-*`, `AppPageShell`, density, CSS ownership and validation. The owner's approved **cinematic five-slice homepage and Mining visual concept** now define the future visual-quality target. See [`CINEMATIC_VISUAL_DIRECTION.md`](CINEMATIC_VISUAL_DIRECTION.md) and `moonbreaker_design_canon.md`. Historical instructions below to make every screen *look identical to old Mining* or to carry old Dashboard cards into the future home are **superseded visually**, not functionally. Operational pages still have no hero header; the navigational gateway is the exception. Mining must retain source-backed segmented competitor bars and `T-{value}` tied-rank notation. Do not confuse this approval with implementation or permission to merge this branch directly into a release branch.


Audited against `codex/beta-queue-crafting-acceptance` (newest pushed branch, 2026-10-23). `breaker-staging` and `codex/wikelo-staging` are not on GitHub yet, so numbers on those branches will differ slightly. The structure of the problem will not.

## Why the pages look like different websites

The repo already has a design canon (`moonbreaker_design_canon.md`) and a token file. Neither one is the thing pages actually follow.

1. **The canon and the tokens disagree on the accent.** The canon says "restrained blue/cyan accents". `tokens.css` says "Amber action/focus language" (`--void-border-active`, `--void-active-wash`). Pages split accordingly: Blueprint Tracker is amber-led, Fitting Terminal is teal-led, Crafting and Logistics lean violet, everything else is blue. Any agent reading either source is "following the rules".
2. **tokens.css contains four parallel surface systems and three text systems.** Surfaces: `--void-*`, `--bg-*`, `--ui-panel-*`, `--ops-*`. Text: `--text-main`, `--void-text-*`, `--ui-text-*`. There are also three different "cyans": `--accent-cyan #4db8b0` (teal), `--ops-highlight-color` (sky `#7dd3fc`), and `--glow-cyan` (`#5ec4bc`). Each page picked a different family.
3. **Pages run their own private palettes.** 912 custom properties are defined outside tokens.css (`--bq-*`, `--craft-*`, `--inv-*`, `--mine-*`, `--fit-*`, `--gun-*`, `--bt-*`, `--dm-*`...). Recipe Browser alone defines 209.
4. **Literals beat tokens.** Outside tokens.css there are 7,583 hard-coded colors against about 5,000 `var()` uses. There are 99 raw font declarations (Share Tech Mono, Rajdhani, Barlow, Barlow Condensed, Orbitron, system-ui), 969 raw border-radius values (82 distinct values in total), and 336 `!important`.
5. **The shared shell exists but almost nothing uses it.** `CommandHeader` has 3 consumers (Crafting, Inventory, Fitting v2). The canon's 48px shell rhythm is used by 3 stylesheets (Crafting, Mining, the design preview). There are 135 separate header/hero/toolbar class definitions.
6. **The canon is 782 lines of prose.** "Restrained", "quiet" and "operational" cannot be checked. An agent can always argue it complied, and nothing fails when it doesn't. This is the real reason ChatGPT/Codex won't cooperate: there is no mechanical gate.

## The fix, in order

### Phase 0: decisions (made 2026-10-27)
- [x] **Primary reference: Mining.** Its palette, surfaces, borders, typography, filter bar, tables/rows, selection and status treatment define the `--mb-*` values.
- [x] **Secondary reference: Crafting**, only for patterns Mining does not have: detail drawer/dialog, long-form detail sections, mobile filter sheet, charts. Crafting's colors, fonts and spacing do not override Mining's.
- [x] **Known Crafting issues, never propagated:** table typography too small; component classes and grades not color coded; component header artwork clips into the top of the view; "Materials" should be accent colored; Add to Queue CTA not styled correctly; "Bookmarked" uses a star instead of the established bookmark icon.
- [x] **No command/page header.** Working content fills the entire available vertical space; `CommandHeader` is retired rather than spread.
- [x] **Accent: cyan** for selection/focus/active. Good/bad/warn/quality/rarity colors keep their meaning; amber is no longer an interaction color.
- [x] Canon and tokens.css comments updated to say the same thing.

### Phase 1: one semantic token layer (1 session, tokens.css only)
Add a small `--mb-*` layer at the top of `:root` and make it the only vocabulary for new and migrated CSS. Values come from what Mining renders today (its `--mine-intel-*` tokens resolve to the `--ops-*` values), with `--ops-*` filling roles Mining does not define. Nothing changes visually yet.

```css
/* Surfaces (quieter as they nest) */
--mb-canvas: var(--ops-canvas);                 /* #050b11, Mining --mine-intel-bg */
--mb-surface-1: var(--ops-surface-primary);     /* #0a1119, Mining workspace/panel */
--mb-surface-2: var(--ops-surface-deep);        /* #080f17, Mining row-alt */
--mb-surface-row: var(--ops-surface-row);       /* #0d151e, Mining row */
--mb-surface-hover: var(--ops-surface-hover);   /* #111c27, Mining raised */
--mb-surface-selected: var(--ops-surface-selected); /* #11202c, ops (Mining has no distinct selected surface) */
/* Lines */
--mb-border: var(--ops-border-default);         /* rgba(115,143,171,.20) */
--mb-border-soft: var(--ops-border-soft);       /* rgba(115,143,171,.14) */
--mb-border-hover: #384e5b;                     /* Mining border-hover */
/* Text */
--mb-text-1: #edf7ff;
--mb-text-2: #a9bad0;
--mb-text-3: #7a8fa3;
/* Interaction: ONE accent (cyan) */
--mb-accent: var(--ops-highlight-color);        /* rgba(125,211,252,.70), Mining --mine-intel-teal */
--mb-accent-soft: rgba(125, 211, 252, 0.12);
--mb-focus-ring: var(--mb-accent);              /* Mining focus outline */
/* Semantics (meaning only, never decoration) */
--mb-good: var(--stat-beneficial);
--mb-bad: var(--stat-detrimental);
--mb-warn: var(--accent-gold);                  /* #f59e0b */
--mb-info: #4db8b0;
/* Shape */
--mb-radius-sm: 2px;  --mb-radius-md: var(--ops-radius-nested);  --mb-radius-lg: 8px;  --mb-radius-pill: 999px;
/* Type roles */
--mb-font-ui: var(--font-primary);              /* system UI stack, Mining text */
--mb-font-display: var(--font-display);         /* Rajdhani, Mining actions/numerics */
--mb-font-mono: "Roboto Mono", "Courier New", monospace;
```
- [x] Re-point `--void-*`, `--bg-*` and `--ui-*` at the `--mb-*` equivalents **only where the value is identical** (the old names become aliases), then retire them page by page. Phase 1 aliased the six text tokens; every other legacy token differs from its `--mb-*` role and is left for Phase 4.
- [ ] Point tailwind.config.js `ink`/`mist` at `var(--mb-text-1)`/`var(--mb-text-2)` so Tailwind classes stop forming a fifth palette. Deferred: `ink #d7e3ff` / `mist #9fb4d8` do not match, so this is a visual change.

### Phase 2: the gate (1 session, makes everything else stick)
- [ ] Commit `scripts/style-ratchet.mjs` and run `node scripts/style-ratchet.mjs --update` once to create `style-ratchet.baseline.json`.
- [ ] Add `"style:check": "node scripts/style-ratchet.mjs"` to package.json and run it in CI/pre-commit next to lint.
- [ ] Add the AGENTS.md block from `CODEX_STYLE_PROMPT.md`.

The ratchet fails a change if any stylesheet gains a color literal, raw font, raw radius, `!important` or local custom property. Improvements are allowed and get locked in with `--update`. Codex can no longer "cooperate" its way around this. It either passes or it doesn't.

Current baseline (`style-ratchet.baseline.json`, `style/unify` 2026-10-27, 68 stylesheets): colorLiteral 7593, rawFont 99, rawRadius 986, important 336, localToken 928. (The 2026-10-23 audit on `codex/beta-queue-crafting-acceptance` counted 7583 / 99 / 969 / 336 / 912.)

### Phase 3: full-height shell everywhere, no page header (biggest visual win per hour)
Most of the "different website" feeling comes from the top 60px and the font and accent of each page, not from deep components.
- [ ] Extract `AppPageShell` from the Mining shell: `grid-template-rows: minmax(0,1fr); gap: 8px; padding: 8px;`. No header row.
- [ ] Put `AppPageShell` on every top-level route, with no command/page header: Dashboard, Doctrine, Logistics hub, Build Queue, Refinery Import, Carrier Logistics, Mining, Blueprint Tracker, Mission Browser, Refinery Planner, Alpha Threshold, Gunnery, Component Mapping, Fitting v2.
- [ ] Delete each page's header/hero markup and rules (including `CommandHeader` usages on Crafting, Inventory, Fitting v2) in the same commit that adopts `AppPageShell`.

### Phase 4: per-page migration (one Codex session per row)

Frozen (archive candidates): Blueprint Tracker, Armor/Alpha Threshold, Doctrine.
Do not migrate, restyle, or spend session time on them. Phase 3 shell changes stay.
When archived, move them under src/archive so the style ratchet skips them.

For each page, first replace the page's private token *definitions* with aliases to `--mb-*`
(exact matches only; list near matches for approval). Then replace literals in the most visible
selectors. Then delete dead selectors.

Before row 1: add a ratchet rule that fails any `--mb-*` definition outside
src/styles/tokens.css (Mission Browser currently defines its own --mb-text and --mb-border-soft),
then run `node scripts/style-ratchet.mjs --update`.

| Order | Page | Stylesheet(s) | Literals | Local tokens | Notes |
|---|---|---|---|---|---|
| 1 | Mining | mining/mining.css | refresh | refresh | Reference. Before/after must be pixel-identical; any difference means the --mb-* values are wrong |
| 2 | Build Queue | logistics/build-queue.css + shared/CraftStatisticsCards | 0 | aliases only | Done 2026-10-28: dead rules removed, literals/radii/fonts on `--mb-*`, status dots, "Target" as in-control prefix, one statistics document (no tabs), shared cards own the grid. Remaining: 18 `!important` (mobile slider geometry, rarity neutrality in stats) |
| 3 | Inventory | logistics/inventory.css, inventory-add-modal.css | refresh | refresh | Header controls already moved in Phase 3 |
| 4 | Refinery Import | logistics/refinery-import.css | refresh | refresh | Violet drift; 72 `!important`; example rows show "Q 533", which breaks the quality-format rule |
| 5 | Dashboard | styles/dashboard.css | refresh | refresh | 131 font declarations |
| 6 | Logistics hub + Carrier | logistics.css, carrier-logistics.css | refresh | refresh | |
| 7 | Fitting v2 / Terminal | fitting-terminal.css, fitting-mockup-shell.css | refresh | refresh | Teal-led; tabs placement changed in Phase 3 |
| 8 | Crafting | crafting/* | 0 | aliases only | Done 2026-10-28 for recipe-browser.css, crafting-detail-refactor.css, craft-tab-bar.css: all six known issues resolved (grade/class tokens `--mb-grade-*`, `--mb-class-*` added). `crafting.css` is imported nowhere (dead file); Blueprint Tracker retired |

Done criteria for each page:
- [ ] Wrapped in `AppPageShell` with a `title`; no page header, hero, banner or visible page title.
- [ ] No private palette: every local custom property is an alias of `--mb-*`, or deleted.
- [ ] `--mb-accent` is the only selection/focus/active color; good/bad/warn/quality keep their meaning.
- [ ] Fonts only via `--mb-font-*`, radii only via `--mb-radius-*`; no new color literals.
- [ ] No `:is()` groups across unrelated components, no appended override blocks, no specificity bumps; dead selectors deleted.
- [ ] One scroll owner (panel or shell, never both); layouts hold at 1920x1080, 1440x900 and 390x844.
- [ ] No lost controls compared with the Phase 3 inventory.
- [ ] `tsc -b`, lint and `style:check` pass; baseline updated downward; Playwright specs pass, or pre-existing failures are listed separately.
- [ ] Before/after screenshots at desktop and mobile; differences only where they move toward Mining.

### Housekeeping that makes agents less confused
- [ ] Delete or move out of `src/`: `src/archive/`, `src/pages/_archive/` (about 25k CSS lines that agents grep and copy from).
- [ ] Move the root-level `*.patch` files and the stray file `upabase auth session after discord login` out of the repo root.
- [ ] Trim the canon. Move the "Recent Implementation Audit" and per-page notes to `docs/`, and keep the canon to rules a reviewer can check.


## Retired surfaces (2026-10-29)
Blueprint Tracker, Mission Browser, Armor Threshold, Component Mapping, Doctrine, and Refinery Import are retired. Do not schedule style passes or UI maintenance for them. Preserve shared data and calculations for active consumers.
