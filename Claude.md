Rules: Read files first. Write complete solution. Test once. No over-engineering.

# scintel / breaker — Claude Context (Optimized)

## Project Overview
**Scintel** (repo: breaker) is a **Star Citizen org dashboard** and companion tool suite. It includes:
- **Dashboard** hub
- Doctrine / knowledge base (library + modular articles)
- **Logistics**: Inventory, locations, build queue, refinery import
- **Industry**: Crafting system
- **Combat tools**: Alpha Threshold (armor/shield analysis), Component Mapping
- **Ships**: Maps and visualization

It evolved from a focused alpha-threshold analyzer into a full-featured org operations + combat analysis platform.

## Stack
- React 19 + Vite 7 + TypeScript (strict mode)
- Tailwind CSS + custom CSS (preserve custom CSS)
- Framer Motion, Zustand, React Router 7
- React Three Fiber + Three.js (ship viewport where used)
- MDX for doctrine/content pages
- Lazy-loaded routes for tools (performance)

## Architecture Highlights
- **DashboardShell** wraps most routes (sidebar + topbar persistent)
- Lazy loading for heavy sections (`Suspense` + `RouteFallback`)
- Pure calculation logic preferred (especially in combat tools)
- Content in `content/` (MDX) + doctrine modules
- Data pipelines/scripts in `/scripts` (imports for ships, refinery, etc.)
- Stores in `src/stores/`
- Main entry: `src/App.tsx` (heavy use of redirects for legacy paths)

## Key Sections & Files
- **Core Dashboard**: `src/pages/DashboardPage.tsx`, `src/components/dashboard/`
- **Doctrine**: `DoctrineLibraryPage`, `DoctrineModulePage`, MDX content
- **Logistics**: `pages/logistics/*` (Inventory, Locations, BuildQueue, RefineryImport)
- **Alpha Threshold**: `src/tools/alpha-threshold/` (still critical)
  - Pure calcs: `lib/calculations.ts`
  - Matrix: `ThresholdComparisonMatrix` (large — edit carefully)
- **Industry Crafting**: `pages/industry/CraftingPage`
- **Ship Maps**: `pages/ships/maps/ShipMapsPage`
- **Component Mapping**: `tools/gunnery/ComponentMappingPage`

## Important Rules
- **Surgical, small diffs** — avoid big rewrites.
- Strict TS, no `any` without justification.
- Keep custom CSS; do not blindly convert to Tailwind.
- No new deps without discussion.
- Mobile-first responsive (no horizontal scroll, good touch targets).
- Performance: lazy load tools, optimize 3D where present.
- Naming: `acm-*` for matrix, scoped short classes.

## SciIntel Visual Theme

Use the current SciIntel dark command-interface palette across Mining, Build Queue, Crafting, and dashboard pages.

Core palette direction:
- Base backgrounds: near-black / dark charcoal
- Primary accent: orange/gold
- Positive/available/strong: green or teal
- Negative/missing/weak: red
- Internal borders: soft neutral charcoal/white transparency
- Gold/orange borders are reserved for primary shells, selected states, titles, count pills, and key accents

Do not:
- Use blue panel backgrounds
- Use olive/green wash as the main page color
- Apply gold borders to every card/container
- Create heavy nested card stacks
- Use generic admin-table styling
- Couple page-specific layouts across Mining, Build Queue, and Crafting

Page styling rules:
- Keep Rajdhani as the primary UI font
- Use compact 1080p-friendly spacing
- Prefer thin borders, subtle elevation, small uppercase labels, compact chips
- Use page-specific classes for layout
- Shared tokens are allowed, but do not share fragile page layout selectors

Theme hierarchy:
- Outer/page shells may use orange/gold accent borders
- Inner cards should mostly use neutral borders
- Active/selected states may use orange/gold glow
- Success values use teal/green
- Danger/missing values use reds.

### Elevation / Layering Rules

Use consistent depth across pages. The UI should feel like a dark command console with layered panels, not flat admin cards.

Layer hierarchy:

1. Page base
- Near-black background
- No border
- Minimal or no shadow
- Example role: `.bq-main`

2. Primary page shell
- Main page container/frame
- May use orange/gold accent border
- Strongest shadow on the page
- Subtle radial accent glow is allowed
- Example role: Build Queue shell, Mining recommendation console shell, Crafting planner shell
- background: var(--bq-large)
- box-shadow: 0 24px 56px rgba(0,0,0,0.58), 0 0 42px rgba(255,153,0,0.08), inset 0 1px 0 rgba(255,255,255,0.045);

3. Major panels
- Selected detail panel, shortage panel, recommendation list, ledger/sidebar panel
- Dark charcoal gradient
- Neutral soft border, not gold by default
- Medium shadow
- May use a small orange title/accent line
- background: linear-gradient(180deg, #181d21 0%, #101417 100%);
-  box-shadow: 0 10px 24px rgba(0,0,0,0.38), 0 3px 8px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.032);

4. Inner cards
- Metric cards, material cards, route factor cards, summary tiles
- Slightly raised from major panels
- Neutral border
- Smaller shadow
- No gold border unless selected/active/critical

5. Rows / chips / controls
- Lowest elevation
- Thin dividers or subtle fills
- No heavy shadows
- Active chips may use orange/gold accent
- Success chips use teal/green
- Danger chips use red

Elevation rules:
- Do not give every card the same border/shadow.
- Do not use gold borders on every nested container.
- Do not stack more than 2-3 visible card layers in one area.
- Outer shells can feel framed; inner content should feel embedded.
- Use shadows to separate major regions, not every row.
- Use neutral borders for most internal separation.
- Use orange/gold as hierarchy and selection, not decoration everywhere.

Recommended shadows:

Primary shell:
```css
box-shadow:
  0 28px 70px rgba(0, 0, 0, 0.58),
  0 0 42px rgba(255, 153, 0, 0.08),
  inset 0 1px 0 rgba(255, 255, 255, 0.04);