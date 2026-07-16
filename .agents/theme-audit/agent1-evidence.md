# Agent 1 — Evidence and Token Inventory

Investigation date: 2026-07-12. Scope is limited to Dashboard, Fitting Mockup, Mission Browser, Blueprint Tracker, Mining, Build Queue, and Carrier Logistics. This report identifies implementation evidence and inconsistencies; it does not select or recommend a design direction.

## Route and source map

| Page | Route | Route component | Principal visual files |
|---|---|---|---|
| Dashboard | `/dashboard` | `src/pages/DashboardPage.tsx` | `src/styles/dashboard.css`, global `src/styles/tokens.css`, `src/styles/density-2k.css` |
| Fitting Mockup | `/fitting-mockup` (outside Dashboard shell) | `src/pages/FittingMockupPage.tsx` → `src/components/fitting/mockup/FittingMockupShell.tsx` | `src/components/fitting/mockup/fitting-mockup-shell.css`, `src/styles/density-2k.css` |
| Mission Browser | `/industry/missions` | `src/pages/industry/MissionBrowserPage.tsx` | `src/pages/industry/mission-browser.css`, shared `src/components/industry/crafting/recipe-browser.css` |
| Blueprint Tracker | `/industry/blueprint-tracker` | `src/pages/industry/BlueprintTrackerPage.tsx` → `src/components/industry/crafting/BlueprintTrackerPage.tsx` | `src/components/industry/crafting/blueprint-tracker.css` |
| Mining | `/industry/mining` | `src/pages/industry/MiningPage.tsx` → `src/components/industry/mining/MiningPage.tsx` | `src/components/industry/mining/mining.css`, `recipe-browser.css`, `src/styles/scintel-filter-shell.css` |
| Build Queue | `/logistics/build-queue` | `src/pages/logistics/BuildQueuePage.tsx` | `src/components/logistics/build-queue.css`, `src/components/logistics/logistics.css` |
| Carrier Logistics | `/logistics/carrier-logistics` | `src/pages/logistics/CarrierLogisticsPage.tsx` → `src/components/logistics/CarrierLogisticsPanel.tsx` | `src/components/logistics/carrier-logistics.css`, `src/components/logistics/logistics.css` |

All routes except Fitting Mockup render inside `DashboardShell`, so they also inherit the shell/sidebar/topbar visual context. Global import order is `components.css`, `alpha-threshold.css`, `gunnery.css`, `dashboard.css`, then `tokens.css` and `density-2k.css`, followed by other shared styles. Page-local CSS is imported by route/component modules and can therefore override global declarations through cascade order and specificity.

## Global token inventory

`src/styles/tokens.css` establishes Rajdhani for both primary and display type, with Orbitron loaded globally but not assigned to the main roles. Body text is `--text-main: #edf7ff`.

Core canvas/surface values:

- `--void-bg-0: #03070a`, `--void-bg-1: #071218`, `--void-bg-2: #0c141a`, `--void-bg-3: #060d13`, `--void-bg-deep: #070e11`.
- `--bg-app` combines two very low-opacity blue radial gradients (`rgba(59,111,160,.028)`, `rgba(46,53,71,.045)`) with the above vertical canvas gradient.
- `--bg-panel`: `rgba(14,20,26,.98)` → `rgba(6,10,14,.99)`.
- `--bg-card`: `rgba(14,22,28,.96)` → `rgba(11,18,24,.95)` → `rgba(6,10,14,.97)`.
- `--bg-card-dark`: `rgba(13,19,25,.99)` → `rgba(10,15,20,.98)` → `rgba(4,7,10,.99)`.
- Shared instrument surfaces separately define `--ui-panel-bg: #04131d`, `--ui-panel-bg-deep: #03121c`, rows `#051a28`, hover `#081e2c`.

Borders and elevation:

- Quiet/panel/divider borders are `rgba(130,150,160,.08)`, `.11`, and `.055` respectively.
- Global hover/active borders are amber: `rgba(255,178,26,.24)` and `.5`; danger is `rgba(255,77,77,.3)`.
- `--shadow-card` uses `0 14px 30px rgba(0,0,0,.726)`, `0 2px 8px rgba(0,0,0,.753)`, plus a white inset highlight. `--shadow-panel` uses `0 20px 52px rgba(0,0,0,.5)` and `0 2px 10px rgba(0,0,0,.34)`.
- Shared focus-visible is an amber `2px solid rgba(245,158,11,.72)` outline with 2px offset.

Global semantic/accent values include teal/cyan `#3db8a8` / `#4db8b0`, violet `#a78bfa`, gold `#f59e0b`, amber `#ffb21a`, semantic green/red values that vary by page, and rarity colors. Global text roles are `#edf7ff`, `#a9bad0`, and `#7a8fa3`.

## Page evidence

### Dashboard

The page canvas uses `var(--bg-app)`. Generic panels use `var(--bg-panel)`, `var(--border-panel)`, and `var(--shadow-panel)`, while cards also use `var(--cards-grey)`/global card gradients.

`.dash-hero` is an 8px-radius composite surface: graphite gradient `rgba(6,10,16,.96)` → `rgba(12,16,24,.88)`, three faint cyan/violet/amber radial lights, cyan border `rgba(56,189,248,.14)`, black depth shadow, cyan glow at `.05`, and white inset edge. `.dash-hero-inner` itself is layout-only: a 1.05fr/0.95fr grid, 1rem gap, and approximately 18px padding. The visual depth attributed to it is implemented primarily by its parent and child surfaces.

Within it, `.dash-hero-mini` uses a second luminance layer (`rgba(24,29,33,.92)` → `rgba(16,20,23,.96)`), 6px radius, `rgba(255,255,255,.07)` border, modest black shadow, and inset highlight. Four mini-card border hues encode category: inventory cyan, reserve violet, queue orange, mining green. Hover increases the category-border opacity and lifts by 1px. The primary CTA is orange (`#c85a00` → `#a84a00`); the secondary CTA is cyan wash/border. Text ranges from `#e7edff` to blue-grey at alpha `.72`, `.56`, and `.48`.

Inconsistencies: Dashboard CSS contains legacy/local color families in the same file (Discord blue `rgba(88,101,242,*)`, violet `rgba(124,92,255,*)`, orange variants, pure black/white controls). Some muted labels use alpha as low as `.25`–`.35`, separate from global text tokens. Card radii visible in the file range from 3px through 8px and circles.

### Fitting Mockup

This page defines a complete local palette on `.fm-shell`: background `#05080a`, panels `rgba(10,14,18,.94)` / `rgba(14,18,24,.88)`, white border `.07`, accent `#5a9aaa`, text `#e8edf2`, muted `#8b97a3` / `#5f6b75`, success `#3fbf84`, danger `#d86b7d`, orange `#c98a45`, purple `#9b7fd4`. It does not use the Dashboard shell or the global canvas gradient.

Routine panels (`.fm-panel-group`) use 4px radius, graphite gradient, black shadow and inset edge. Rows (`.fm-equip-row`) use another graphite gradient, 4px radius, white `.06` border, and a 4px semantic/category accent strip. Hover changes fill and border; selected changes border plus inset treatment, but its selected border remains low-opacity cyan (`rgba(90,154,170,.24)`). `.fm-rail-btn.is-active` supplies multiple cues: accent text, border, cyan fill, and a 3px inset bar. Hero artwork sits in `#07090c` with an inset 60px black shade; its overlay card uses `rgba(8,11,14,.84)` plus 8px blur.

Radii are tightly concentrated at 2–4px, with pill/circle exceptions. Shadows are largely black rather than saturated glow. Category colors include orange, green, purple, blue, cyan, and grey independent of global semantic tokens.

### Mission Browser

Local variables are instrument-blue: panels `#04131d`, `#051a28`, `#03121c`, hover `#081e2c`; border `rgba(65,132,160,.14)` / teal `.2`; text `#edf7ff`, `#a9bad0`, `#7a8fa3`; green `#22d37a`, amber `#ffb84d`, red `#ff5c5c`, violet `#b85cf6`, teal `#4db8b0`, blue `#4da3ff`.

The page base is flat `#03121c`. Cards range from 3px controls to 6px mission cards and a 10px parent surface. `.mb-mission-card` has a path-colored border and a 7px inset path bar; hover changes to `#081e2c`. Mission-path headers use broad violet/variable-color gradients. Status/badge states have distinct green, amber, red, violet, grey, blue, teal, cyan, and orange fills/borders/text. Focus uses amber border `rgba(255,153,0,.52)` and an outer 1px shadow.

Inconsistencies: violet values differ from global violet (`#b85cf6` vs `#a78bfa`); red/green/amber differ from other pages. Both page identity/path hues and semantic badge hues occupy saturated attention at the same time. Routine radius spans 2, 3, 6, and 10px.

### Blueprint Tracker

The tracker is locally warm/neutral: panels `#10161a`, `#151b20`, `#0c1114`; border grey `rgba(184,194,204,.12/.07)`; text `#f1ecdf`, muted `#a4aaa4`, faint `#69716d`; orange `#f59e0b`, bright teal `#43ffd0`, green `#8bd17c`, red `#ff6b6b`. Its canvas still references global `var(--bg-app)`.

Controls and cards primarily use 2–3px radii, white `.03` fills, grey borders, and orange selected/active treatments. The header bottom border returns to the global border token. This creates a visibly warmer text and brighter teal than Mission/Build Queue despite shared shell context.

### Mining

Mining aliases global void backgrounds and borders but creates `--sc-*` roles: text `#edf7ff`; muted `rgba(169,186,208,.82)`; faint `rgba(122,143,163,.7)`; teal `#4db8b0`; purple `#a78bfa`; green `#34d399`; amber `#fbbf24`; red `#fb7185`, each with separate soft fills and borders.

`.msb-sidebar` contains duplicate declarations: background `rgba(7,10,18,.88)`, first border `rgba(148,163,184,.08)`, later overridden border `rgba(255,255,255,.05)`, repeated `position`, `max-height`, and `overflow`; radius is 8px. Other Mining surfaces mix global `var(--bg-panel)`/`var(--cards-grey)` with translucent white fills and local purple/amber states. Observed radii include 2, 3, 5, 7, and 8px. Several labels use `rgba(169,186,208,.55/.62)` and isolated legacy `rgba(160,180,220,.2)`.

### Build Queue

Build Queue duplicates several token namespaces in one scope. It defines `--bq-*`, `--mb-bg-*`, `--alloc-*`, and generic `--panel-*` roles. The recurring surfaces are `#010a12` gutter, `#03121c` deep/card, `#04131d` panel, `#051a28` row, `#081e2c` hover. Text is `#edf7ff/#a9bad0/#7a8fa3`; accents are teal `#4db8b0`, blue `#4da3ff`, purple `#b85cf6`, red `#ff5c5c`, green `#22d37a`, amber `#ffb84d` or `#ff9d00` depending on namespace.

Primary panels use 12px radius, nested controls 8px, cards/rows 9px, pills 999px, and smaller inner elements 4–6px. `.bq-queue-card` hover changes border and row fill; selected uses full cyan border, `#071f2e` fill and shadow. Other state variants use green or purple borders with shadows. This is the broadest routine radius range among targets and includes multiple saturated selected/status borders.

### Carrier Logistics

Carrier Logistics has no local root token block. It repeatedly hard-codes graphite card gradient `#181d21` → `#101417`, white borders `.06–.10`, orange `rgba(255,153,0,*)`, blue-grey text `rgba(160,180,220,*)`, primary text `#e7edff`, green around `rgba(80,210,160,*)`, and red around `rgba(220–240,60–80,60–80,*)`.

`.clog-panel` uses 6px radius, the graphite gradient, white `.07` border, and modest black shadow. Inline cards and room cards use white `.025/.03` fills, white `.06/.08` borders, and 4–5px radii. Orange marks focus, selected toggle states, capacity, loaded/full values, and some panel borders. Capacity swatches deliberately use six category hues (blue, cyan, purple, yellow, orange, green).

Inconsistencies: metadata frequently uses alpha `.28–.42`, including `.clog-room-stat-label`, `.clog-cap-label`, and other labels. Orange expresses both interaction and load/capacity status. Shared `logistics.css` simultaneously introduces violet primary buttons/breadcrumbs and blue secondary buttons, so Carrier’s page-local orange language sits inside a violet/blue logistics shell vocabulary. No shared page-local tokens centralize these repeated colors.

## Cross-page inconsistency inventory

- Three base systems coexist: global graphite gradients, Mission/Build Queue solid navy instrument surfaces, and Fitting’s independent near-black local palette. Blueprint Tracker adds a warmer graphite variant.
- Primary text has at least four values: `#edf7ff`, `#e8edf2`, `#e7edff`, and warm `#f1ecdf`. Secondary/muted text likewise mixes tokens, hex, and many alpha-composited blue-greys.
- Cyan/teal values include `#38bdf8`, `#5a9aaa`, `#4db8b0`, `#43ffd0`, and `#4da3ff`; violet includes `#a78bfa`, `#b85cf6`, `#9b7fd4`, and legacy `#7c5cff`-family values.
- Success values include `#22d37a`, `#34d399`, `#3fbf84`, `#8bd17c`, and `rgba(80,210,160,*)`. Red, amber, and orange similarly vary by page.
- Routine radius language ranges from Fitting’s 2–4px to Build Queue’s 8–12px, with Dashboard/Carrier mostly 4–8px and Mission spanning 2–10px.
- Border construction alternates between white-alpha neutral, blue-grey neutral, teal-tinted instrument borders, and page-local category-colored borders. Selected, hover, status, and category states sometimes share the same colored-border mechanism.
- Elevation alternates between global large deep shadows, Dashboard/Fitting moderate black shadows with inset highlights, Mission’s mostly flat/inset-color system, and Build Queue’s mixed black and colored shadows.
- `:focus-visible` has a global amber outline, but page-local `:focus` rules often substitute only a border-color change (e.g. Carrier selects/inputs). Exact focus appearance therefore depends on element type and whether `focus-visible` matches.
- Muted text opacity is not consistent: global muted roles are opaque hex values, while Dashboard, Mining, Logistics, and Carrier frequently use alpha values down to `.2–.4` on very dark surfaces.

## Screenshot evidence and limitations

Captures are under `.agents/theme-audit/screenshots/`, outside application source. Headless Edge used browser zoom 100%, hidden scrollbars, a 10-second virtual-time budget, and the same fresh browser-profile conditions for each route.

Completed pairs: Dashboard, Fitting Mockup, Mission Browser, and Blueprint Tracker at both 1920×1080 and 2560×1440. Completed 1920×1080 captures: Mining, Build Queue, and Carrier Logistics. The headless batch ended before the latter three 2560×1440 files were written; those three high-resolution comparisons are a limitation of this inventory.

Data state was comparable in the sense that every route used the same local application/store environment and no manual interaction. It was not a controlled populated fixture: Dashboard showed persisted/local queue data but empty inventory, and route-specific async data depended on locally available APIs/assets. Fitting Mockup is outside the shared shell, as intended by routing. Headless capture console emitted non-page Edge task/USB diagnostics. No application code or application data was modified.

## Repository/build status

Only this report, screenshot evidence, and `.gitkeep` were created under `.agents/theme-audit`. No application source, styles, state, routes, data, or configuration were changed. Because source/configuration was untouched, a build was not required for validating a code change; no build result is claimed by this investigation.
