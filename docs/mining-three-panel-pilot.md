# Mining Three-Panel Pilot

Status: implemented on `codex/mining-intelligence-migration`.

## Scope and ownership

This page-scoped pilot preserves the approved Mining palette and canonical `src/components/industry/mining/mining.css` ownership. It does not change Mining scoring, data contracts, material identity, persistence outside a local display preference, or source probabilities.

| Concern | Canonical owner |
| --- | --- |
| Workspace geometry, spine controls, responsive adaptation | `MiningPage.tsx` and `mining.css` |
| Single progressive location row | `LocationListItem.tsx` |
| Method-aware material rows and pool membership | `miningFormatters.ts` and `miningPresentationModels.ts` |
| Source-pool detail rendering | `LocationDetail.tsx` |

## Interaction contract

The desktop three-panel composition is enabled only at viewport widths that keep the filter panel, 490px location panel, spine, gaps, and a 360px minimum profile usable. Between the compact desktop and mobile layouts, Mining retains its existing adaptive layout rather than clipping the profile.

The Ranked Locations panel persists only a valid notch in `moonbreaker:mining-location-panel-v1`:

- Collapsed: 56px, icon rail.
- Compact: 190px, rank, icon, name, bookmark.
- Standard: 340px, adds method icons and delivered shares.
- Expanded: 490px, adds environment indicators.

The cyan diamond toggles collapsed and the last noncollapsed notch. The spine drag previews an in-range width and snaps only on release; double-click restores Standard. Keyboard arrows change notches, while Home and End select the collapsed and expanded bounds. At narrow widths the spine is hidden and the existing filter sheet/detail behavior remains authoritative.

## Detail truth

Material profile rows scan Ship, Vehicle, then Hand, with a stable alphabetical order within each method. Rows retain method association keys, so a material delivered for multiple methods is not silently collapsed into one arbitrary method.

Competition bars are built from delivered source-pool membership. A selected material keeps its canonical color; other pool members remain at their delivered flex/share values with muted emphasis. The UI neither sums selected material chances nor removes competitors from a denominator.

## Acceptance evidence

`tests/ui/mining-three-panel.spec.ts` covers notch controls, pointer drag, refresh persistence, no page overflow, desktop adaptation, and mobile spine suppression using fixture mode. Screenshots are written to `artifacts/mining-three-panel/` for 2560, 1920, 1440, 768, 430, 390, and 375 viewport widths and each desktop notch.
