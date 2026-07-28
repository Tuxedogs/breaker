# Gate 6 — Corrective layout: overview + full-width Component Statistics

Updated: 2026-07-28

**Status:** Historical handoff, integrated and subsequently evolved. The current Build Queue uses peer Selected Craft, Component Statistics, and Material Allocation workspace cards. Use `moonbreaker_design_canon.md` and the current source for new work; do not reapply this handoff’s header geometry.

**Branch:** `bq-stats-layout-correction`  
**Worktree:** `D:/Moonbreaker-bq-stats-layout`  
**Base:** `origin/main` @ `e32b4f983`  
**Approved mockup:** `artifacts/bq-craft-header/mockup/approved-component-statistics.png`

The architecture hold below was part of the original gate scope and is no longer active.

## Verdict on current main

REJECT on visual grounds. Base/Target/Allocation was forced into the selected-craft header → tiny type, compressed columns, micro-panels, clipping, artwork collision. Not a CSS tweak — restructure the page.

## Required DOM structure (selected craft)

```
[1] Overview header (content-height)
    Identity+actions | Compact stock overview | Artwork (~140–180px)

[2] Full-width Component Statistics card
    Title + legend
    Dense comparison table (STAT | UNIT | BASE | TARGET | ALLOCATION [| DIRECTION optional])
    Category group headings

[3] Material Allocation (unchanged section, below statistics)
```

## Section rules

### 1. Overview header
- Keep identity, status, blueprint source, Size/Grade/Class, Complete/Remove, quantity
- Compact stock overview = category-aware grouped **stock/base values only** (readable)
- NO Base/Target/Allocation columns here
- NO modifier matrices here
- Do not dump every available stat — useful stock overview
- Artwork bounded, no collision, no giant empty box

### 2. Component Statistics card
- Full content width, directly under overview, above Material Allocation
- Match mockup hierarchy and readability
- One row per modifiable (and relevant) comparison stat
- Always show Base / Target+Δ / Allocation+Δ; zeros visible; Not set / No allocation / Unavailable
- Semantic benefit/harm colors via existing benefitDirection — not numeric sign
- No quality-band colors in this card
- No vague "Additional" or "Material Modifiers" dump groups — assign to correct category groups; no duplicates

### 3. Material Allocation
- Remains separate below statistics
- Do not restyle quality bands here

## Data
Reuse existing `craftStatViewModel` comparison model and projectors. Panel formats only — no projection math in React.
May split model presentation into overview (stock groups) vs comparison (full table) without reinventing formulas.
Fix group assignment in view model / detailStatGroups so Quantum Fuel → Quantum Travel/Efficiency, Component Health → Durability/Physical, etc.

## Own
- `BuildQueueGroup.tsx` (selected-craft layout structure)
- `BuildQueueCraftStatsPanel.tsx` / possibly split overview vs comparison components
- `BuildQueueStatsBreakdown.tsx` wiring
- `craftStatViewModel.ts` (+ tests) for grouping fixes / overview vs compare slices
- `build-queue.css` (layout + comparison table)
- fixture/spec if selectors change
- screenshots under `artifacts/bq-craft-header/gate6/`
- ledger update

## Do not touch
- Inventory, Mining, Crafting Detail, vercel.json
- fitting API/hooks/cache
- reservation/solver formulas
- `D:/Moonbreaker` dirty files

## Validate
Screenshots: full overview + full Component Statistics + Material Allocation beneath (1920 + 2560).  
Components: TS-2/Spicule, FR-66, AD5B, FPS weapon, FPS armor, cooler or PP.  
Commands: `npm run fitting:test` · `npm run ui:build-queue` · `npm run build`  
One focused commit. Do not push/merge.
