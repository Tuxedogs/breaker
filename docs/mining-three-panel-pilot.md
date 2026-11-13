# Mining Three-Panel Pilot

Status: implemented on `codex/mining-intelligence-migration`.

## Scope and ownership

This page-scoped pilot preserves the approved Mining palette and canonical `src/components/industry/mining/mining.css` ownership. It does not change Mining scoring, data contracts, material identity, persistence outside a local display preference, or source probabilities.

| Concern | Canonical owner |
| --- | --- |
| Workspace geometry, divider state, responsive adaptation | `MiningPage.tsx` and `mining.css` |
| Single progressive location row | `LocationListItem.tsx` |
| Method-aware material rows and pool membership | `miningFormatters.ts` and `miningPresentationModels.ts` |
| Source-pool detail rendering | `LocationDetail.tsx` |

## Interaction contract

The desktop three-panel composition is enabled only at viewport widths that keep filters, Ranked Locations, a fixed divider, gaps, and a 360px minimum profile usable. Between the compact desktop and mobile layouts, Mining retains its existing adaptive layout rather than clipping the profile.

The Ranked Locations preference persists a boolean in `moonbreaker:mining-location-panel-v1`. Legacy persisted multi-notch values are read safely as expanded, except the legacy collapsed value:

- Expanded: rank, oversized location image, location name, selected-material coverage, conditional system badge, color-coded textual Ship/Vehicle/Hand availability, and bookmark.
- Collapsed: the same record identity, coverage, system badge, and bookmark; only method availability is hidden and the profile receives the released width.

The narrow divider has one labelled chevron button. It toggles the expanded/collapsed preference with native keyboard operation and exposes `aria-expanded`; it is not draggable, resizable, or a multi-stage spine. At narrow widths the divider is hidden and the existing filter-sheet/detail behavior remains authoritative.

Location artwork is an intentionally oversized 68px asset clipped by the 54px record surface, without a separate thumbnail card or circular treatment. Location records use source-backed method text only; temperature, O₂, environmental columns, and method-image cells remain in the Location Profile rather than duplicating the ranked list. Coverage is `X / Y` when a selection exists and a meaningful dash when it does not. System badges appear only when no system filter is active, not merely because a visible subset currently happens to have one system.

## Detail truth

Material profile rows scan Ship, Vehicle, then Hand, with a stable alphabetical order within each method. Rows retain method association keys, so a material delivered for multiple methods is not silently collapsed into one arbitrary method.

Competition bars are built from delivered source-pool membership. A selected material keeps its canonical color; other pool members remain at their delivered flex/share values with muted emphasis. The UI neither sums selected material chances nor removes competitors from a denominator.

## Acceptance evidence

`tests/ui/mining-three-panel.spec.ts` covers expanded/collapsed method visibility, system-badge filtering, refresh persistence, no page overflow, desktop adaptation, and mobile divider suppression using fixture mode. Screenshots are written to `artifacts/mining-ranked-list-refinement/` for 2560, 1920, 1440, 768, 430, 390, and 375 viewport widths plus expanded/collapsed desktop states.
