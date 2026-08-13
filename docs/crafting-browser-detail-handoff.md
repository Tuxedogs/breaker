# Recipe Browser and Crafting Detail — Agent Handoff

Updated: 2026-08-13
Status: Implemented and visually validated

This is the concise implementation map for `/industry/crafting` and `/industry/crafting/:blueprintId`. Visual authority remains `moonbreaker_design_canon.md`; repository safety authority remains `AGENTS.md`.

## Runtime data path

```text
D:/scintel/out/<CHANNEL>/<BUILD_ID>/datasets/crafting/component_card_index.json
  -> scripts/shape-component-card-data.mts
  -> server-data/crafting/component-cards/*
  -> /api/crafting/component-cards/*
  -> src/lib/componentCardIndexApi.ts
  -> CraftingLayout / ComponentResultsBrowser
```

Recipe shards follow the matching accepted-snapshot shaping path into `server-data/crafting/recipes` and are served through `/api/crafting/recipes/*`. `public/api` is retired and must remain empty. Use `docs/api-data-flow-runbook.md` for publication commands, endpoint ownership, and deployment wiring.

Crafting Detail also joins normalized recipes and shared fitting/component-card detail:

```text
src/lib/craftingData.ts + src/lib/craftingRecipesApi.ts
  -> ComponentRecipeTable
  -> useFittingComponentStats / useFpsFittingComponentFromCard
  -> fittingStatProjection + craftingDetailStats + detailStatGroups
```

Do not hand-edit generated component-card JSON to change production behavior. Change its owning generator or shaping layer and regenerate.

## Recipe Browser implementation

Primary files:

- `src/components/industry/crafting/CraftingLayout.tsx`
- `src/components/industry/crafting/CraftingPage.tsx`
- `src/components/industry/crafting/components/CraftingFilterBar.tsx`
- `src/components/industry/crafting/components/ComponentResultsBrowser.tsx`
- `src/components/industry/crafting/utils/recipeBrowserFilters.ts`
- `src/components/industry/crafting/utils/recipeBrowserMaterialOptions.ts`
- `src/components/industry/crafting/utils/recipeBrowserPresentation.ts`
- `src/components/industry/crafting/recipe-browser-redesign.css`

Behavioral contract:

- Permanent chips cover Materials, Vehicle Weapons, Size 1–6, Grade A–D, five vehicle classes, vehicle component categories, and FPS categories.
- Material lookup remains searchable and matches items by delivered material id or name.
- A non-empty manual text search spans all records and overrides category, size, grade, class, material, and bookmark filters.
- Applied filters remain selected during search. Out-of-filter search results show `Non-Filter Match`.
- Clearing search restores normal filter behavior.
- Search-result ordering prioritizes name relevance and selects an FPS weapon before its matching magazine.
- Bookmarks, pagination, row selection, keyboard access, double-click/open behavior, queue state, and detail routing remain intact.
- Family tables sort from their headers. Numeric first activation is descending; Component first activation is ascending.
- Desktop table headers stick at the top of the results viewport below the horizontal filter bar.
- Below 1600px, a single click selects the table row; double-click or an explicit open action routes to the full detail page.
- At 1600px and wider, a single selection opens the peer detail drawer through the `preview` query parameter. Escape, the close control, and `Open full details` preserve explicit navigation behavior.
- The drawer resets to Materials for a newly opened item and exposes Overview, Materials, and Statistics without introducing a second data or calculation path.

Important family columns:

- Ship weapons: Size, Alpha, DPS, Penetration, Fire Rate, Projectile Speed, Capacity.
- Radar: Size, Min Power Pips, Max Power Pips, Min Assist Range, Max Assist Range, Grade/Class.
- FPS weapons retain their combat comparison columns and Crafting Detail performance charts.

Ship DPS uses `src/lib/fitting/fittingWeaponStats.ts`. Do not add another alpha-times-fire-rate formula to browser code.

The current Scintel component-card record already delivers radar `powerUsageMin`, `powerUsageMax`, `aimAssistRangeMin`, and `aimAssistRangeMax`, plus ship-weapon penetration, alpha, and fire rate. The July 28 browser pass did not require a Scintel schema change.

## Crafting Detail implementation

Primary files:

- `src/components/industry/crafting/components/ComponentRecipeTable.tsx`
- `src/components/industry/crafting/components/crafting-detail-refactor.css`
- `src/components/shared/TargetQualitySlider.tsx`
- `src/lib/crafting/craftingDetailStats.ts`
- `src/lib/crafting/detailStatGroups.ts`
- `src/lib/crafting/detailStatPresentation.ts`
- `src/lib/crafting/fpsChartRange.ts`
- `src/lib/crafting/materialDisplayName.ts`

Presentation contract:

- The full-page route and wide-screen drawer consume the same shaped recipe shard and shared fitting/component-card detail paths.
- The drawer is a peer workflow surface beside the results table, not a statistics workspace nested inside an identity header.
- Drawer identity, facts, tabs, scrollable body, and action footer remain distinct regions; full-detail navigation stays explicit.
- Component Statistics mirrors Build Queue’s compact scan structure: external group labels, restrained grouped surfaces, aligned labels/values, and dense rows.
- Source arrays, matrices, subtype rows, valid zero, missing, loading, and unavailable retain distinct semantics.
- Beneficial and detrimental modifier text uses `--stat-beneficial` and `--stat-detrimental` from `src/styles/tokens.css`. Structural cyan/blue is not a modifier-direction color.
- Desktop material columns are `Material | Required | Target | Input | Effect`.
- Target contains the editable `Target N` badge.
- Input contains the 1–1000 range control with extracted quality-boundary tick marks.
- Do not reintroduce Quality or Band cells for the selected target value.
- Lowercase source material labels are normalized only for display; material identity and calculation keys are unchanged.
- Item performance charts render below Material Requirements.
- FPS chart domains come from `fpsChartRange.ts`; projectile lifetime travel is context and does not define the chart domain.

## Verification

Run:

```bash
npm run lint
npm run crafting:test
npm run crafting:component-cards:verify
npm run build
npm run ui:crafting
```

The UI suite covers:

- `768×900`
- `1920×1080`
- `2560×1440`
- `3840×2160`
- populated browser and detail states
- browser empty state
- material picker
- search override and `Non-Filter Match`
- FPS weapon-over-magazine selection
- sorting and sticky headers
- wide-screen drawer selection, tab layout, close behavior, and full-detail navigation
- Target editing and 1–1000 range
- canonical material casing
- realistic FPS chart windows and chart placement
- representative FPS weapon, ship weapon, shield, FPS armor, quantum drive, cooler, and power-plant statistic groups

Deterministic evidence is written to `artifacts/crafting-browser-refactor/`.
