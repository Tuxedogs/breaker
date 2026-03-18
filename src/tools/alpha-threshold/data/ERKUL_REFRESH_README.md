# Erkul Refresh Workflow

Use this when the Alpha Threshold ship and weapon data needs to be refreshed from Erkul without changing anything else.

## What to tell Codex

Use this prompt:

```text
Refresh the Alpha Threshold Erkul datasets from fresh raw dumps.

Requirements:
- Fetch or use the latest Erkul Live and PTU raw dumps for ships and weapons.
- Save the raw dumps into ./tmp first so they remain frozen and inspectable.
- Re-run the alpha importer so the normalized seed files update from those frozen dumps.
- Do not change any UI logic unless import issues require it.
- After import, verify a few known ships and weapons:
  - Perseus should be sizeGroup large
  - Idris should be capital
  - Arrow should be small
  - CF-337 and NDB-30 should still appear in weapon seeds
- Run lint and build after the refresh.
- Tell me which raw dump files were saved and which seed files changed.
```

## Expected raw dump files

Save raw Erkul payloads here before import:

- `./tmp/erkul-live-ships.json`
- `./tmp/erkul-ptu-ships.json`
- `./tmp/erkul-live-weapons.json`
- `./tmp/erkul-ptu-weapons.json`

These files are the frozen source snapshots. The site should use normalized seeds generated from them, not live runtime requests.

## Gather setup

1. Copy:

- `./tmp/erkul-sources.example.json`

to:

- `./tmp/erkul-sources.json`

2. Fill in the four current Erkul endpoints:

- `erkul-live-ships`
- `erkul-ptu-ships`
- `erkul-live-weapons`
- `erkul-ptu-weapons`

3. Fetch and freeze the raw payloads:

```bash
npm run alpha:fetch-erkul
```

That command saves the four raw JSON dumps into `./tmp`.

## Current import command

Run:

```bash
npm run alpha:import -- \
  --ships-erkul-live ./tmp/erkul-live-ships.json \
  --ships-erkul-ptu ./tmp/erkul-ptu-ships.json \
  --weapons-erkul-live ./tmp/erkul-live-weapons.json \
  --weapons-erkul-ptu ./tmp/erkul-ptu-weapons.json \
  --patch "2026-03-17" \
  --report ./tmp/alpha-threshold-import-report.json
```

If SPViewer is also part of the refresh, include:

```bash
  --ships-spviewer ./tmp/spviewer-ships.json \
  --weapons-spviewer ./tmp/spviewer-weapons.json
```

## Generated seed files

The importer writes:

- `src/tools/alpha-threshold/data/ships/erkulLiveSeeds.ts`
- `src/tools/alpha-threshold/data/ships/erkulPtuSeeds.ts`
- `src/tools/alpha-threshold/data/weapons/erkulLiveSeeds.ts`
- `src/tools/alpha-threshold/data/weapons/erkulPtuSeeds.ts`

Optional SPViewer outputs:

- `src/tools/alpha-threshold/data/ships/spviewerSeeds.ts`
- `src/tools/alpha-threshold/data/weapons/spviewerSeeds.ts`

## Validation checklist

After import, verify:

- `Perseus` is `large`, not `capital`
- `Idris` is `capital`
- `Arrow` is `small`
- `Guardian` is `medium`
- `Perseus` `vitalHp` matches Erkul `totalHp`
- `Perseus` `armorHp` still matches the Erkul armor health field
- PTU source still loads in the threshold page

Then run:

```bash
npm run lint
npm run build
```

## Important note

Changing the size-group inference code alone does not fix old snapshots. If the frozen seed files already contain baked `sizeGroup` values, they must be regenerated from fresh raw Erkul dumps for the correction to fully apply.
