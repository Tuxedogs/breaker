# Alpha Threshold Source Notes (4.7 cycle)

## Current importer workflow

Use the importer to ingest full source exports (JSON files or reachable API URLs) and regenerate source seed files used by the UI:

```bash
npm run alpha:import -- \
  --ships-erkul ./tmp/erkul-ships.json \
  --ships-spviewer ./tmp/spviewer-ships.json \
  --weapons-erkul ./tmp/erkul-weapons.json \
  --weapons-spviewer ./tmp/spviewer-weapons.json \
  --patch "4.7" \
  --report ./tmp/alpha-threshold-import-report.json
```

Importer outputs:

- `src/tools/alpha-threshold/data/ships/erkulSeeds.ts`
- `src/tools/alpha-threshold/data/ships/spviewerSeeds.ts`
- `src/tools/alpha-threshold/data/weapons/erkulSeeds.ts`
- `src/tools/alpha-threshold/data/weapons/spviewerSeeds.ts`

It also prints and can save a cross-check report with Erkul/SPViewer threshold deltas for overlapping ships.

## Known source hooks to monitor

These are common public entry points teams usually inspect when maintaining ship/weapon sync automation:

- `https://www.erkul.games` (site front-end; often calls internal JSON endpoints)
- `https://api.erkul.games` (unofficial/public API host used by community tools when available)
- `https://www.spviewer.eu` (site front-end; loadout/vehicle data)
- `https://api.spviewer.eu` (unofficial/public API host used by community tools when available)

## Spectrum/Reddit API hook notes

Potential surfaces for telemetry/change monitoring (for patch-cycle diffs and confirmation chatter):

- Reddit JSON listing/search endpoints, e.g. `/r/<subreddit>/search.json`.
- RSI Spectrum forum pages and any discoverable JSON/XHR endpoints from browser network traces.

In this environment, direct calls to those domains returned HTTP 403, so endpoint verification must be performed from a network that can reach those services.
