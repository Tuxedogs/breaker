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

## Three.js / Viewport (where applicable)
- Per-deck ship meshes.
- Holo material: `MeshBasicMaterial`, transparent, low opacity, `depthWrite: false`.
- Avoid material changes that hurt perf.

## Working Style
- Explain **why** before **what**.
- Direct, concise feedback. Flag issues clearly.
- After edits: lint, typecheck (`npm run build`), manual test (mobile + nav).
- Stay in scope of the current task.

## Data & Scripts
- Ship data imports, manual seeds, observed breakpoints (PTU-aware).
- Refinery/import scripts for logistics.
- Content validation: `npm run content:check`

Use this file as primary context. Dive into specific folders/files only when the task requires deep implementation details.

