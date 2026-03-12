# breaker

React + Vite + TypeScript docs site project.

## Alpha Threshold Ship Data

Manual ship data for the Alpha Threshold tool lives in [src/tools/alpha-threshold/data/ships/manualSeeds.ts](./src/tools/alpha-threshold/data/ships/manualSeeds.ts).

### Raw dump workflow

1. Paste raw ship rows into a temporary string in [src/tools/alpha-threshold/data/ships/importShipDump.ts](./src/tools/alpha-threshold/data/ships/importShipDump.ts).
2. Use `buildManualShipSeedsFromDump(rawDump, sizeGroup, patch)` to convert the dump into `ManualShipSeed[]`.
3. Copy the generated seed objects into [src/tools/alpha-threshold/data/ships/manualSeeds.ts](./src/tools/alpha-threshold/data/ships/manualSeeds.ts).
4. The existing pipeline will normalize those seeds into UI-ready ship records automatically.

### Raw column mapping

Map your source fields like this:

- `Manufacturer` -> `manufacturer`
- `Name` -> `name`
- `Vital Armor HP` -> `health`
- `deflection for physical` -> `ballisticThreshold`
- `deflection for energy` -> `energyThreshold`

You also need to provide a `sizeGroup` when importing:

- `capital`
- `large`
- `medium`
- `small`

### Seed shape

```ts
{
  manufacturer: 'AEGS',
  name: 'Idris',
  sizeGroup: 'capital',
  health: 42900,
  ballisticThreshold: 189,
  energyThreshold: 113,
  patch: '4.7 PTU',
}
```

### Data flow

```ts
ManualShipSeed[] -> normalizeManualShipRecord() -> ShipRecord[]
```

Normalization and raw dump parsing live in [src/tools/alpha-threshold/lib/ships/adapters/manual.ts](./src/tools/alpha-threshold/lib/ships/adapters/manual.ts).
