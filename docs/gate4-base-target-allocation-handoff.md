# Gate 4 Handoff — Base / Target / Allocation comparison

**Branch:** `bq-stats-base-target-allocation`  
**Worktree:** `D:/Moonbreaker-bq-stats-gate4`  
**Base commit:** `1d6790574`  
**Do not touch:** `D:/Moonbreaker` dirty Inventory/vercel files. Work only in this worktree.

Architecture HOLD — no fitting API/cache/batch/IndexedDB/readiness/terminal work.

## Data flow (reuse — do not reinvent)

### Allocation (already wired)
`BuildQueueStatsBreakdown` →
`buildAllocatedMaterialQualities(item, recipe, inputs)` (`src/lib/logistics/buildQueueCraftStats.ts`) →
`computeTotalModifiersFromQualities(recipe, allocatedQualities)` (`recipeQuality.ts`) →
`buildCraftStatViewModel({ detail, totalModifiers })` →
`buildModifiedDetailStatRows` / `formatMaterialModifierDisplay` / `getFittingModifierBaseValue`

### Target (exists as input, not yet projected in stats panel)
Per-requirement target quality is `RecipeInputTemplate.selectedQuality` / `requirementSelectedQuality` in `BuildQueueGroup`.
Add a sibling helper e.g. `buildTargetMaterialQualities(item, recipe, inputs)` that maps each material key via `getMaterialQualityKey` to `input.selectedQuality` when defined.
Then: `computeTotalModifiersFromQualities(recipe, targetQualities)` — same projector as allocation.

Empty states:
- no configured target across modifiable materials → target state `not_set` / display "Not set"
- no allocation amounts → allocation state `no_allocation` / "No allocation"
- missing detail → "Unavailable"

### Benefit direction (authoritative)
`PROPERTY_DIRECTION` in `src/lib/gameplay/propertyMeta.ts` (`"higher"` | `"lower"`).
`getModifierImpact(property, value)` in `src/lib/gameplay/propertyUtils.ts`.
Map to view-model:
- higher → `higher-is-better`
- lower → `lower-is-better`
- missing → `neutral` (report ambiguous GPP properties; do not guess)

Do NOT infer from labels in React.

## Required model shape (extend craftStatViewModel)

Expose comparison rows with:
stable stat ID (prefer GPP property / binding key), group ID, label, unit, modifiable flag, benefitDirection,
base value, target projected, allocation projected,
target absolute and/or % delta, allocation absolute and/or % delta,
explicit targetState / allocationState enums.

Presentation formats only — no projection math in `BuildQueueCraftStatsPanel`.

## Always-visible modifiers
For every recipe-modifiable property (from material `qualityModifiers`):
show Base, Target value+modifier, Allocation value+modifier even when delta is 0 (neutral `0%` / zero absolute).
Remove Gate-2 `shouldShowDelta` hiding and any skip of near-zero modifiers for comparison rows.
Non-modifiable metadata (Size/Grade/Class) stays identity badges — no comparison columns.

## UI
Preserve identity | stats | artwork outer layout.
Dense comparison table per category group:

```
STAT              BASE       TARGET              ALLOCATION
Shield HP         3,168      3,224  +1.77%       3,205  +1.17%
```

One row = three states. No three large cards.
Tabular numeric columns.
Neutralize quality-band coloring inside BQ stats card only (no rarity green/blue/purple/gold on values/rows/group borders). Semantic benefit/harm colors carry the signal.
CSS only under `build-queue.css` scoped to stats comparison; do not change Inventory / Material Allocation / Crafting Detail quality-band styles.

## Own vs do not touch

**Own:**
- `craftStatViewModel.ts` (+ tests)
- `BuildQueueCraftStatsPanel.tsx`
- `BuildQueueStatsBreakdown.tsx` (wire target + allocation modifiers into view model)
- `buildQueueCraftStats.ts` (add target qualities helper + tests)
- `build-queue.css` (comparison table + neutralize band colors in stats card)
- fixture/spec updates under `tests/ui/build-queue-stats.spec.ts` as needed
- screenshots under `artifacts/bq-craft-header/gate4/`
- ledger `docs/bq-stats-program-ledger.md` Gate 4 section

**May lightly extend (reuse only, no formula duplication):**
- `craftingDetailStats.ts` only if needed to export comparison builders that call existing `formatMaterialModifierDisplay` / bindings — keep math there, not in UI
- Do not change `getModifiersAtQuality` formulas

**Do not touch:**
- fitting API clients/hooks/cache
- reservation/solver/allocation algorithms
- Mining, Inventory pages, Crafting Detail pages (except read reference)
- `PROPERTY_DIRECTION` values inventively — only consume; if extending map, only with known authoritative entries and report remaining ambiguous

## Tests required
Unit cases: positive beneficial, negative beneficial, positive harmful, negative harmful, zero target, zero allocation, neutral direction, target not set, no allocation, target≠allocation projections.
Verify fixtures: FR-66, AD5B, FPS weapon, FPS armor; protect QD/cooler/PP via fitting:test.
Screenshots 1920×1080 and 2560×1440.

Commands before commit:
```
npm run fitting:test
npm run ui:build-queue
npm run build
```

One focused Gate 4 commit. Do not push. Do not merge to main.
