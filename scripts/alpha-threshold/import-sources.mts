import { promises as fs } from 'node:fs'
import path from 'node:path'

import { normalizeErkulShip } from '../../src/tools/alpha-threshold/lib/ships/adapters/erkul'
import { normalizeSpviewerShip } from '../../src/tools/alpha-threshold/lib/ships/adapters/spviewer'
import { mergeShipRecords } from '../../src/tools/alpha-threshold/lib/ships/merge'
import type { ShipRecord } from '../../src/tools/alpha-threshold/lib/ships/types'
import { normalizeErkulWeapon } from '../../src/tools/alpha-threshold/lib/weapons/adapters/erkul'
import { normalizeSpviewerWeapon } from '../../src/tools/alpha-threshold/lib/weapons/adapters/spviewer'
import { mergeWeaponRecords } from '../../src/tools/alpha-threshold/lib/weapons/merge'
import type { WeaponRecord } from '../../src/tools/alpha-threshold/types'

type SourceKind = 'erkul' | 'spviewer'
type ResourceKind = 'ships' | 'weapons'

type ImportArgs = {
  shipsErkul?: string
  shipsSpviewer?: string
  weaponsErkul?: string
  weaponsSpviewer?: string
  patch?: string
  outDir: string
  reportPath?: string
}

type JsonRecord = Record<string, unknown>

function parseArgs(argv: string[]): ImportArgs {
  const values: ImportArgs = {
    outDir: 'src/tools/alpha-threshold/data',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (!arg.startsWith('--')) continue

    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`)
    }

    switch (arg) {
      case '--ships-erkul':
        values.shipsErkul = next
        break
      case '--ships-spviewer':
        values.shipsSpviewer = next
        break
      case '--weapons-erkul':
        values.weaponsErkul = next
        break
      case '--weapons-spviewer':
        values.weaponsSpviewer = next
        break
      case '--patch':
        values.patch = next
        break
      case '--out-dir':
        values.outDir = next
        break
      case '--report':
        values.reportPath = next
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }

    index += 1
  }

  return values
}

async function readJsonInput(location: string): Promise<unknown> {
  if (location.startsWith('http://') || location.startsWith('https://')) {
    const response = await fetch(location, {
      headers: {
        'user-agent': 'moonbreaker-alpha-threshold-importer/1.0',
        accept: 'application/json,text/plain,*/*',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed request ${location}: HTTP ${response.status}`)
    }

    return response.json()
  }

  const raw = await fs.readFile(location, 'utf8')
  return JSON.parse(raw)
}

function collectRecords(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((entry): entry is JsonRecord =>
      typeof entry === 'object' && entry !== null
    )
  }

  if (typeof payload !== 'object' || payload === null) {
    return []
  }

  const candidateRoots = [
    'data',
    'items',
    'ships',
    'vehicles',
    'weapons',
    'results',
    'rows',
  ]

  for (const key of candidateRoots) {
    const value = (payload as JsonRecord)[key]
    if (Array.isArray(value)) {
      return value.filter((entry): entry is JsonRecord =>
        typeof entry === 'object' && entry !== null
      )
    }
  }

  return []
}

function normalizeShips(records: JsonRecord[], source: SourceKind, patch?: string): ShipRecord[] {
  return records
    .map((record) => {
      const enriched = patch ? { ...record, patch } : record
      return source === 'erkul'
        ? normalizeErkulShip(enriched)
        : normalizeSpviewerShip(enriched)
    })
    .filter((record) => record.name && record.health > 0)
}

function normalizeWeapons(
  records: JsonRecord[],
  source: SourceKind,
  patch?: string
): WeaponRecord[] {
  return records
    .map((record) => {
      const enriched = patch ? { ...record, patch } : record
      return source === 'erkul'
        ? normalizeErkulWeapon(enriched)
        : normalizeSpviewerWeapon(enriched)
    })
    .filter((record) => record.name && record.size > 0)
}

function serializeConstArray(name: string, value: unknown[]): string {
  const content = JSON.stringify(value, null, 2)
  return `export const ${name} = ${content} as const\n`
}

function toShipSeed(record: ShipRecord) {
  return {
    id: record.sourceId || record.id,
    manufacturer: record.manufacturer,
    name: record.name,
    sizeGroup: record.sizeGroup,
    health: record.health,
    ballisticThreshold: record.ballisticThreshold,
    energyThreshold: record.energyThreshold,
    pilotHardpointSize: record.pilotHardpointSize ?? null,
    turretHardpointSize: record.turretHardpointSize ?? null,
    patch: record.patch,
  }
}

function toWeaponSeed(record: WeaponRecord) {
  return {
    id: record.sourceId || record.id,
    name: record.name,
    size: record.size,
    type: record.damageType,
    alpha: record.alpha,
    burstDps: record.burstDps,
    projectileSpeed: record.projectileSpeed,
    patch: record.patch,
  }
}

async function writeDataFile(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, 'utf8')
}

function buildThresholdCrossCheck(erkul: ShipRecord[], spviewer: ShipRecord[]) {
  const byName = new Map(spviewer.map((ship) => [ship.name, ship]))

  return erkul
    .map((ship) => {
      const counterpart = byName.get(ship.name)
      if (!counterpart) return null

      return {
        ship: ship.name,
        erkul: {
          ballisticThreshold: ship.ballisticThreshold,
          energyThreshold: ship.energyThreshold,
          health: ship.health,
        },
        spviewer: {
          ballisticThreshold: counterpart.ballisticThreshold,
          energyThreshold: counterpart.energyThreshold,
          health: counterpart.health,
        },
        delta: {
          ballisticThreshold: ship.ballisticThreshold - counterpart.ballisticThreshold,
          energyThreshold: ship.energyThreshold - counterpart.energyThreshold,
          health: ship.health - counterpart.health,
        },
      }
    })
    .filter(Boolean)
}

async function importResource(
  kind: ResourceKind,
  source: SourceKind,
  location: string | undefined,
  patch?: string
): Promise<ShipRecord[] | WeaponRecord[]> {
  if (!location) return []

  const payload = await readJsonInput(location)
  const rows = collectRecords(payload)

  if (kind === 'ships') {
    return normalizeShips(rows, source, patch)
  }

  return normalizeWeapons(rows, source, patch)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const [erkulShips, spviewerShips, erkulWeapons, spviewerWeapons] = await Promise.all([
    importResource('ships', 'erkul', args.shipsErkul, args.patch),
    importResource('ships', 'spviewer', args.shipsSpviewer, args.patch),
    importResource('weapons', 'erkul', args.weaponsErkul, args.patch),
    importResource('weapons', 'spviewer', args.weaponsSpviewer, args.patch),
  ])

  const mergedShips = mergeShipRecords([
    ...(spviewerShips as ShipRecord[]),
    ...(erkulShips as ShipRecord[]),
  ])
  const mergedWeapons = mergeWeaponRecords([
    ...(spviewerWeapons as WeaponRecord[]),
    ...(erkulWeapons as WeaponRecord[]),
  ])

  const shipsDir = path.join(args.outDir, 'ships')
  const weaponsDir = path.join(args.outDir, 'weapons')

  await Promise.all([
    writeDataFile(
      path.join(shipsDir, 'erkulSeeds.ts'),
      serializeConstArray('erkulShipSeeds', (erkulShips as ShipRecord[]).map(toShipSeed))
    ),
    writeDataFile(
      path.join(shipsDir, 'spviewerSeeds.ts'),
      serializeConstArray('spviewerShipSeeds', (spviewerShips as ShipRecord[]).map(toShipSeed))
    ),
    writeDataFile(
      path.join(weaponsDir, 'erkulSeeds.ts'),
      serializeConstArray('erkulWeaponSeeds', (erkulWeapons as WeaponRecord[]).map(toWeaponSeed))
    ),
    writeDataFile(
      path.join(weaponsDir, 'spviewerSeeds.ts'),
      serializeConstArray('spviewerWeaponSeeds', (spviewerWeapons as WeaponRecord[]).map(toWeaponSeed))
    ),
  ])

  const report = {
    importedAt: new Date().toISOString(),
    patch: args.patch ?? null,
    sources: {
      erkul: {
        ships: (erkulShips as ShipRecord[]).length,
        weapons: (erkulWeapons as WeaponRecord[]).length,
      },
      spviewer: {
        ships: (spviewerShips as ShipRecord[]).length,
        weapons: (spviewerWeapons as WeaponRecord[]).length,
      },
    },
    merged: {
      ships: mergedShips.length,
      weapons: mergedWeapons.length,
    },
    thresholdCrossCheck: buildThresholdCrossCheck(
      erkulShips as ShipRecord[],
      spviewerShips as ShipRecord[]
    ),
  }

  if (args.reportPath) {
    await writeDataFile(args.reportPath, `${JSON.stringify(report, null, 2)}\n`)
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
