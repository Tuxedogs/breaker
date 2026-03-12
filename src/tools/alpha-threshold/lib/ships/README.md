# Ship Data Layer

This mirrors the weapon pipeline for the Alpha vs Threshold tool.

Current flow:

`manualSeeds -> normalizeManualShipRecord -> ShipRecord[] -> UI`

Files:

- `types.ts`: shared ship data contracts for source adapters
- `normalize.ts`: shared ship normalization helpers
- `merge.ts`: future multi-source reconciliation
- `adapters/manual.ts`: current manual source adapter
- `adapters/erkul.ts`: future Erkul adapter stub
- `adapters/spviewer.ts`: future SPViewer adapter stub
- `adapters/scunpacked.ts`: future scunpacked adapter stub

The UI can keep consuming `Ship` data while the ship import side evolves behind it.
