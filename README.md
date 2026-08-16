# Moonbreaker / Scintel

Moonbreaker is a Star Citizen organization operations application. It combines doctrine and reference content with logistics, crafting, mining, mission planning, fitting, and combat-analysis tools in one React application.

The repository is no longer a static documentation site. It contains the browser application, routed API handlers, authenticated user-state flows, generated gameplay-data registries, publication tooling, deterministic UI fixtures, and automated validation suites.

## Product areas

- Dashboard, doctrine modules, and reference library
- Inventory, locations, refinery import, carrier logistics, and Build Queue
- Recipe Browser, Crafting Detail, saved blueprints, and Blueprint Tracker
- Mining intelligence, recommendations, refinery planning, and Mission Browser
- Vehicle fitting, component statistics, and power simulation
- Alpha Threshold and Component Mapping combat tools

## Technology

- React 19, React Router 7, TypeScript, and Vite 7
- Zustand for client state
- Supabase authentication and PostgreSQL persistence through Drizzle ORM
- MDX for doctrine and reference content
- React Three Fiber and Three.js for ship visualization
- Playwright and Node test suites for UI, route, solver, projection, and data-contract coverage
- Vercel functions for deployed API adapters

## Quick start

Vite 7 requires Node.js `20.19+` or `22.12+`.

```bash
npm ci
npm run dev
```

The Vite development server prints its local URL when it starts. In the default development mode, `/api` requests are proxied to `https://www.scintel.app` so the application can use the deployed API contract.

Use the deterministic development fixtures when working on supported visual flows:

```bash
npm run dev:fixtures
```

Fixture routes are development-only and are never enabled in production builds.

## Runtime modes and environment

Create `.env.local` only when a workflow needs local configuration. Never commit credentials or database URLs.

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL used by browser authentication |
| `VITE_SUPABASE_ANON_KEY` | Supabase browser key |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Optional server-side names for authenticated API handlers |
| `DATABASE_URL` | PostgreSQL connection used by authenticated persistence and Drizzle tooling |
| `VITE_SCINTEL_API_BASE_URL` | Optional browser API-base override |
| `SCINTEL_LOCAL_API=1` | Serve supported API routes locally through Vite instead of proxying to production |
| `SCINTEL_API_ROOT` | Accepted Scintel dataset root used by mining publication and supported local data workflows; never the retired `D:/scintel/api` tree |
| `FITTING_DATA_ROOT` | Optional fitting registry override; defaults to `server-data/fitting` |

Publication and shaping commands use additional explicit source variables such as `SCINTEL_DATASET_ROOT`. Follow the [API and data-flow runbook](docs/api-data-flow-runbook.md) rather than guessing a source directory.

## Architecture and data boundary

```text
accepted Scintel snapshot
  -> Moonbreaker shaping/publication
  -> server-data domain registries
  -> routed API handlers
  -> browser clients and shared stores
```

- Browser code calls routed `/api` endpoints; it does not fetch generated files by repository path.
- `server-data` contains route-owned runtime registries for crafting, fitting, mining, and missions.
- `api` contains deployment adapters, while `server` and `src/server` contain route and service logic.
- Authenticated inventory, saved blueprints, and queue state are user/database data, not generated gameplay data.
- `public/api` is retired and must remain empty.
- Extraction and source-data ownership lives in the sibling `D:/scintel` repository.

See the [generated-data manifest](docs/generated-data-manifest.md) for source authority and runtime ownership.

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/pages` | Route-level application pages |
| `src/components` | Shared and feature UI components |
| `src/lib` | API clients, projections, resolvers, and shared domain logic |
| `src/stores` | Client-side application state |
| `src/tools` | Standalone combat and analysis tools |
| `src/server` | Authenticated user-state handlers and database-facing services |
| `server` | Gameplay route handlers, services, solvers, and dataset resolvers |
| `api` | Vercel function entry points |
| `server-data` | Server-only generated runtime registries |
| `scripts` | Shaping, publication, import, verification, and release tooling |
| `content` | MDX doctrine modules and reference material |
| `tests` | Playwright UI coverage and shared test support |
| `artifacts` | Reviewed screenshots and visual-validation evidence |
| `docs` | Operational runbooks, accepted plans, audits, and handoffs |

## Common commands

### Development and validation

```bash
npm run dev
npm run dev:fixtures
npm run lint
npm run build
npm run content:check
npm run api:check
```

### Targeted domain tests

```bash
npm run crafting:test
npm run fitting:test
npm run mining:test
npm run missions:test
```

### Visual regression suites

```bash
npm run ui:inventory
npm run ui:build-queue
npm run ui:crafting
npm run ui:missions
```

### Data shaping and verification

```bash
npm run crafting:shape
npm run crafting:component-cards:verify
npm run crafting:blueprint-sources:verify
npm run missions:shape
npm run missions:source:verify
npm run missions:shaped:verify
npm run mining:publish
```

Shaping and publication commands can replace generated registries. Confirm the accepted channel and build in the operational runbook before running them.

Mining publication should set `SCINTEL_REF_INDEX` explicitly to the matching accepted `ref_index.json`; otherwise the publisher searches LIVE builds for the newest available index. The publisher rejects trace-empty location indexes when the enriched source contains trace materials. Lagrange results are presented as deterministic `Lagrange A` through `Lagrange L` parents with their physical ARC/CRU/HUR/MIC locations retained as child badges.

## Development guidance

- Read [AGENTS.md](AGENTS.md) before making repository changes.
- Use the [Moonbreaker design canon](moonbreaker_design_canon.md) for visual work.
- Preserve APIs, persistence, routing, calculations, solvers, and production data contracts during presentation-only changes.
- Treat valid zero, missing, loading, and unavailable as distinct states.
- Run `npm run lint` and `npm run build` for TypeScript, React, or stylesheet changes, plus the targeted suite for the affected area.
- UI changes require deterministic populated and empty states plus manual screenshot review; a passing build is not visual validation.

## Maintained documentation

- [API and data-flow runbook](docs/api-data-flow-runbook.md) — current endpoint map, publication workflow, deployment wiring, and incident response
- [Generated data manifest](docs/generated-data-manifest.md) — data authority, provenance, and runtime ownership
- [Moonbreaker design canon](moonbreaker_design_canon.md) — implemented visual system and page-level interaction contracts
- [Recipe Browser and Crafting Detail handoff](docs/crafting-browser-detail-handoff.md) — current crafting implementation and validation map
- [Mission Browser accepted canon](docs/mission-browser-redesign-plan-2026-07-31.md) — authoritative mission-card and detail-modal behavior
- [Contributing content](CONTRIBUTING.md) — content-only MDX contribution workflow

Historical audits and handoffs intentionally preserve the architecture observed when they were written. Documents marked historical are evidence, not current operating instructions.

## Alpha Threshold data workflows

Alpha Threshold has dedicated import, normalization, image, and source notes under [src/tools/alpha-threshold](src/tools/alpha-threshold/README.md). Use those maintained instructions for ship or weapon refreshes instead of adding manual records directly in presentation components.
