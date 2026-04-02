# Breaker — Cursor Rules

## What this project is
Breaker is a Star Citizen combat analysis tool built for an org. It calculates effective alpha damage through shields using an E-rating system. E100 = weapon damages fresh armor. E0 = weapon never damages armor regardless of conditions. The tool is both a portfolio piece and a genuine utility used by real players.

## Stack
- React 19, Vite 7, TypeScript strict mode
- Tailwind CSS + custom CSS (do not remove custom CSS in favor of pure Tailwind)
- Framer Motion for animation
- React Three Fiber + Three.js for the ship viewport
- React Router 7
- Vitest (being introduced — no tests exist yet)

## Architecture
- Pure calculation logic lives in `src/tools/alpha-threshold/lib/calculations.ts` — no UI, no side effects, just functions
- Ship data flows: ManualShipSeed → normalizeManualShipRecord() → ShipRecord[]
- Weapon and ship adapters live in `lib/ships/adapters/` and `lib/weapons/`
- Data is pulled from erkul.games, normalized, and stored in typed records
- The matrix component is `ThresholdComparisonMatrix` — it is large by design and should be split carefully, not rewritten

## Naming conventions
- Matrix component classes use `acm-` prefix (e.g. `acm-toolbar`, `acm-weapon-header`)
- Top control strip classes use `alpha-top-control-strip-` prefix
- Do not introduce new long-form BEM prefixes
- CSS class names should be short and scoped to their component

## How to work on this project
- Make surgical changes — do not rewrite working components
- Explain why before what
- Do not add new dependencies without flagging it first
- Do not convert custom CSS to Tailwind utilities without asking
- TypeScript strict mode is on — do not use `any` or type assertions without justification
- Prefer pure functions for calculations — keep logic out of components

## Known issues (work in progress)
- Performance hurdles on the ship viewer
- Possible logic boundaries and loops with selectors in matrix

## Three.js viewport notes
- Ship meshes are loaded per-deck, not as full ship
- Holo deck overlay uses MeshBasicMaterial with transparent: true, opacity: 0.15, depthWrite: false
- Do not switch holo material back to MeshStandardMaterial — performance regression
- Overdraw at shallow camera angles is a known issue, camera angle locking is intentionally avoided to preserve user freedom

## Tone
- Direct feedback preferred, no hand-holding
- Flag problems clearly, don't soften them
- Short explanations over long ones
- Don't suggest things that are out of scope for the current task
