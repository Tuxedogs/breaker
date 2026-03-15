# Ship Data Layer

This mirrors the weapon pipeline for the Alpha vs Threshold tool.

Current flow:

`manualSeeds + sourceSeeds -> normalize adapters -> mergeShipRecords -> UI`

Files:

- `types.ts`: shared ship data contracts for source adapters.
- `normalize.ts`: shared ship normalization helpers.
- `merge.ts`: source reconciliation (manual + Erkul + SPViewer).
- `adapters/manual.ts`: manual source adapter.
- `adapters/erkul.ts`: Erkul adapter.
- `adapters/spviewer.ts`: SPViewer adapter.
- `adapters/scunpacked.ts`: optional future source adapter.

Importer:

- `scripts/alpha-threshold/import-sources.mts` ingests JSON exports/URLs, normalizes records, regenerates source seed files, and emits a cross-source threshold report for overlap validation.
