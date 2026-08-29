# Generated Data Manifest

The machine-readable manifest lives at `server/config/generatedDataManifest.ts`. It records data authority, provenance, validation status, runtime ownership, and the current server-only location for generated gameplay data.

For the complete extraction-to-endpoint diagram, endpoint catalog, publication commands, deployment wiring, and incident checklist, use the [Moonbreaker API and data-flow runbook](api-data-flow-runbook.md). This file remains the concise data-authority registry.

## Active Data Boundary

`public/api` must remain empty. Moonbreaker browser code uses routed API endpoints for crafting, Build Queue, mining, fitting, refinery reference data, locations, missions, and inventory. Those routes read route-owned `server-data` registries or user/database state.

Raw crafting sources are not copied into Moonbreaker. The shaping commands require `SCINTEL_DATASET_ROOT` to identify an accepted Scintel channel snapshot. `SCINTEL_COMPONENT_CARD_SOURCE` is an explicit override when the accepted component-card index is stored outside the default dataset-relative path. Shaping writes only the smaller API registries under `server-data/crafting`.

The following are enforced publication rules:

- Never copy a Scintel dataset into Moonbreaker's web root.
- Never add a browser fallback to `/api/*.json`.
- Never make build or publication tooling depend on `public/api`.
- Preserve channel/build identity for fitting and other build-sensitive registries.
- Keep debug, report, provenance, and unresolved-reference artifacts in Scintel or a server-only report boundary.
- Run `npm run api:check` before accepting a generated-data publication.

## Current Locations

| Domain | Current source or registry | Browser/API owner |
|---|---|---|
| Vehicle recipes | `${SCINTEL_DATASET_ROOT}/crafting/blueprints.json` -> `server-data/crafting/recipes` | `/api/crafting/recipes/*` |
| FPS recipes | `${SCINTEL_DATASET_ROOT}/crafting/fps/fps_blueprints.json` -> `server-data/crafting/recipes` | `/api/crafting/recipes/*` |
| Component cards | `${SCINTEL_COMPONENT_CARD_SOURCE:-${SCINTEL_DATASET_ROOT}/crafting/component_card_index.json}` -> `server-data/crafting/component-cards` | `/api/crafting/component-cards/*` |
| Crafted properties | `server-data/crafting/reference/crafted-properties.json` | `/api/crafting/reference/crafted-properties` |
| Quality quantization | `${SCINTEL_DATASET_ROOT}/crafting/material_quality_quantization_records.json` -> `server-data/crafting/reference/quality-quantization.json` | `/api/crafting/reference/quality-quantization` |
| Material quality quantization | `server-data/crafting/reference/material-quality-quantization.json` | `/api/crafting/reference/material-quality-quantization` |
| Material identity | `server-data/crafting/reference/material-identity-index.json` | `/api/crafting/reference/material-identity` |
| Refinery yields | `server-data/crafting/reference/refinery-yields.json` | `/api/crafting/reference/refinery-yields` |
| Blueprint sources | `server-data/crafting/blueprint-sources` | `/api/crafting/blueprint-sources/*` and `/api/crafting/blueprint-rewards/*` |
| Mission source and projections | `server-data/missions` selected by `current.json`; active tuple shaped 3 / source 4 / offer 1 | `/api/missions/*`, including offer, exact-variant eligibility, and path routes |
| Mining location/material index | `server-data/mining/indexes/location-material.json` | `/api/mining/location-materials` |
| Mining encounter rankings | `server-data/mining/indexes/material-encounter-rankings.json` | `/api/mining/encounter-rankings` |
| Mining material quality | `server-data/mining/indexes/material-quality.json` | `/api/mining/material-quality` |
| Mining location distribution | `server-data/mining/indexes/location-distribution.json` | `/api/mining/location-distribution` |
| Mining location hierarchy | `server-data/mining/indexes/location-hierarchy.json` | `/api/mining/location-hierarchy` |
| Lagrange groups and children | `server-data/mining/locations/lagrange-{groups,children}.json` | `/api/mining/lagrange-{groups,children}` |
| Mining recommender inputs | `server-data/mining/recommender` | `/api/mining/recommendations` |
| Fitting registries | channel/build-owned fitting server data | `/api/v1/fitting/*` |
| Inventory and Build Queue user state | database/user persistence | `/api/user/inventory/*` and `/api/user/build-queue` |

### Mining publication contract

- `SCINTEL_API_ROOT` must identify an accepted Scintel dataset snapshot; the retired `D:/scintel/api` tree is not a publication source.
- The enriched mining source and location/material index must agree on trace-material presence. Publication rejects a trace-empty index when its enriched source contains trace details.
- Raw Pyro location keys are normalized at publication so the Pyro V moon identities do not depend on provider XML discovery.
- `lagrange-groups.json` owns the deterministic `Lagrange A` through `Lagrange L` parents. `lagrange-children.json` owns the physical ARC/CRU/HUR/MIC child identities used by badges and detail views.
- Trace identity is composition identity, not refined-material identity. For example, Pressurized Ice must not appear as a trace of Raw Ice.
- `npm run mining:test` is the required domain gate after changing any mining registry or publication logic.

## Classifications

- `runtime API source data`: generated data shaped into or read by a routed API registry.
- `canonical generated reference data`: authoritative compact reference data served through an API.
- `server-internal source data`: generated data used only inside server routes/services.
- `debug/report artifact`: validation, provenance, unresolved-reference, or debug-only output that is not runtime data.
- `obsolete/unused candidate`: generated output with no supported runtime owner.
- `unknown/manual review`: referenced or expected data whose authority or publication status still needs confirmation.

## Audit Metadata

Each manifest entry records `authority`, `confidence`, external inputs or comparison sources, validation status, size risk, generator provenance, and future API ownership. SPViewer and Erkul remain comparison sources only; they are not gameplay-data authority.

## Forbidden Legacy Paths

The manifest's `legacyForbiddenPaths` documents the retired boundary without presenting former files as current assets:

- `public/api/**`
- browser URLs matching `/api/**/*.json`

Historical audit reports may mention the deleted files to explain prior decisions. They must not be used as operational publication instructions.
