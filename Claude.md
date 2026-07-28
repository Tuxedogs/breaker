# Scintel / Moonbreaker — Claude Context

Updated: 2026-07-28

Read `AGENTS.md` before making changes. It is the repository-wide working and safety authority.

For visual work, use `moonbreaker_design_canon.md` as the detailed design authority. Do not recreate or override its palette, hierarchy, terminology, quality-formatting, or validation rules here.

## Project Overview

Scintel is a Star Citizen organization dashboard and companion tool suite. It includes:

- Dashboard and operational handoffs
- Doctrine and knowledge-base content
- Logistics: Inventory, locations, Build Queue, and refinery import
- Industry crafting
- Fitting and component-performance views
- Combat tools, including Alpha Threshold and Component Mapping
- Ship maps and visualization

## Stack

- React 19, Vite 7, and strict TypeScript
- React Router 7
- Zustand stores
- Tailwind CSS plus substantial page-scoped custom CSS
- Framer Motion
- React Three Fiber and Three.js where ship visualization requires them
- MDX content under `content/`

Preserve the existing custom CSS and lazy route boundaries. Do not add dependencies or migrate page styling systems without explicit approval.

## Key Areas

- Dashboard: `src/pages/DashboardPage.tsx`, `src/components/dashboard/`
- Logistics: `src/pages/logistics/`, `src/components/logistics/`
- Crafting: `src/pages/industry/`, `src/components/industry/crafting/`
- Shared crafting and fitting projection: `src/lib/crafting/`, `src/lib/fitting/`
- Alpha Threshold: `src/tools/alpha-threshold/`
- Application routes: `src/App.tsx`
- Data import and generation: `scripts/`
- Client stores: `src/stores/`

## Current Architecture Snapshot

- Build Queue uses a compact queue rail and three peer workspace regions: selected craft, Component Statistics, and Material Allocation.
- Component statistics flow through shared fitting or component-card delivery, then shared projection/view-model code. Presentation components must not recreate calculations, aliases, or unit conversions.
- Fitting-detail consumers use the shared component store. Cache identity preserves channel, build ID, source type, and normalized identity; the persistent cache schema must advance when the response contract changes incompatibly.
- Inventory defaults to Location → Material → Quality → Individual Boxes, with item-first and grouped-list alternatives.
- Discrete inventory records are physical boxes in user-facing language. Legacy aggregate records must be labeled as aggregates.
- Recipe Browser uses permanent filters, search-over-filter precedence with `Non-Filter Match` disclosure, a selected hero, and sortable family tables.
- Crafting Detail uses Build Queue-style compact statistics, `Material | Required | Target | Input | Effect`, and charts below Material Requirements.

For the current Crafting implementation map and validation contract, read `docs/crafting-browser-detail-handoff.md`.

## Working Rules

- Prefer small, isolated diffs and preserve behavior outside the requested scope.
- Keep APIs, persistence, routing, calculations, solvers, and production data contracts unchanged during visual tasks.
- Use shared tokens and components when they already fit; keep workflow-specific layout page-scoped.
- Distinguish zero, missing, loading, and unavailable states.
- Never invent source data or production calculations to complete a visual.
- Validate visual work with deterministic populated and empty states, screenshots, and the relevant automated checks.
- Run `npm run lint` and `npm run build` for TypeScript, React, or stylesheet changes, plus targeted tests for the changed area.
