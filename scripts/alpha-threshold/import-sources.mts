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
type ErkulChannel = 'live' | 'ptu'

type ImportArgs = {
  shipsErkul?: string
  shipsErkulLive?: string
  shipsErkulPtu?: string
  shipsSpviewer?: string
  weaponsErkul?: string
  weaponsErkulLive?: string
  weaponsErkulPtu?: string
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
      case '--ships-erkul-live':
        values.shipsErkulLive = next
        break
      case '--ships-erkul-ptu':
        values.shipsErkulPtu = next
        break
      case '--ships-spviewer':
        values.shipsSpviewer = next
        break
      case '--weapons-erkul':
        values.weaponsErkul = next
        break
      case '--weapons-erkul-live':
        values.weaponsErkulLive = next
        break
      case '--weapons-erkul-ptu':
        values.weaponsErkulPtu = next
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
        accept: 'application/json,text/plain,*/*',
        origin: 'https://www.erkul.games',
        referer: 'https://www.erkul.games/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
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

  const candidateRoots = ['data', 'items', 'ships', 'vehicles', 'weapons', 'results', 'rows']

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

function normalizeWeapons(records: JsonRecord[], source: SourceKind, patch?: string): WeaponRecord[] {
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
    armor: record.armor,
    armorHp: record.armorHp,
    vitalHp: record.vitalHp,
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
    size: `S${record.size}`,
    type: record.damageType,
    weaponClass: record.weaponClass,
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

function buildThresholdCrossCheck(primary: ShipRecord[], secondary: ShipRecord[]) {
  const byName = new Map(secondary.map((ship) => [ship.name, ship]))

  return primary
    .map((ship) => {
      const counterpart = byName.get(ship.name)
      if (!counterpart) return null

      return {
        ship: ship.name,
        primary: {
          ballisticThreshold: ship.ballisticThreshold,
          energyThreshold: ship.energyThreshold,
          armorHp: ship.armorHp,
          vitalHp: ship.vitalHp,
        },
        secondary: {
          ballisticThreshold: counterpart.ballisticThreshold,
          energyThreshold: counterpart.energyThreshold,
          armorHp: counterpart.armorHp,
          vitalHp: counterpart.vitalHp,
        },
        delta: {
          ballisticThreshold: ship.ballisticThreshold - counterpart.ballisticThreshold,
          energyThreshold: ship.energyThreshold - counterpart.energyThreshold,
          armorHp: ship.armorHp - counterpart.armorHp,
          vitalHp: ship.vitalHp - counterpart.vitalHp,
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

async function writeShipSeeds(outDir: string, fileName: string, exportName: string, records: ShipRecord[]) {
  await writeDataFile(
    path.join(outDir, 'ships', fileName),
    serializeConstArray(exportName, records.map(toShipSeed))
  )
}

async function writeWeaponSeeds(outDir: string, fileName: string, exportName: string, records: WeaponRecord[]) {
  await writeDataFile(
    path.join(outDir, 'weapons', fileName),
    serializeConstArray(exportName, records.map(toWeaponSeed))
  )
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const erkulLiveShipLocation = args.shipsErkulLive ?? args.shipsErkul
  const erkulPtuShipLocation = args.shipsErkulPtu
  const erkulLiveWeaponLocation = args.weaponsErkulLive ?? args.weaponsErkul
  const erkulPtuWeaponLocation = args.weaponsErkulPtu

  const [
    erkulLiveShips,
    erkulPtuShips,
    spviewerShips,
    erkulLiveWeapons,
    erkulPtuWeapons,
    spviewerWeapons,
  ] = await Promise.all([
    importResource('ships', 'erkul', erkulLiveShipLocation, args.patch),
    importResource('ships', 'erkul', erkulPtuShipLocation, args.patch),
    importResource('ships', 'spviewer', args.shipsSpviewer, args.patch),
    importResource('weapons', 'erkul', erkulLiveWeaponLocation, args.patch),
    importResource('weapons', 'erkul', erkulPtuWeaponLocation, args.patch),
    importResource('weapons', 'spviewer', args.weaponsSpviewer, args.patch),
  ])

  const mergedShips = mergeShipRecords([
    ...(spviewerShips as ShipRecord[]),
    ...(erkulLiveShips as ShipRecord[]),
    ...(erkulPtuShips as ShipRecord[]),
  ])
  const mergedWeapons = mergeWeaponRecords([
    ...(spviewerWeapons as WeaponRecord[]),
    ...(erkulLiveWeapons as WeaponRecord[]),
    ...(erkulPtuWeapons as WeaponRecord[]),
  ])

  await Promise.all([
    writeShipSeeds(args.outDir, 'erkulLiveSeeds.ts', 'erkulLiveShipSeeds', erkulLiveShips as ShipRecord[]),
    writeShipSeeds(args.outDir, 'erkulPtuSeeds.ts', 'erkulPtuShipSeeds', erkulPtuShips as ShipRecord[]),
    writeShipSeeds(args.outDir, 'spviewerSeeds.ts', 'spviewerShipSeeds', spviewerShips as ShipRecord[]),
    writeWeaponSeeds(args.outDir, 'erkulLiveSeeds.ts', 'erkulLiveWeaponSeeds', erkulLiveWeapons as WeaponRecord[]),
    writeWeaponSeeds(args.outDir, 'erkulPtuSeeds.ts', 'erkulPtuWeaponSeeds', erkulPtuWeapons as WeaponRecord[]),
    writeWeaponSeeds(args.outDir, 'spviewerSeeds.ts', 'spviewerWeaponSeeds', spviewerWeapons as WeaponRecord[]),
  ])

  const report = {
    importedAt: new Date().toISOString(),
    patch: args.patch ?? null,
    sources: {
      'erkul-live': {
        ships: (erkulLiveShips as ShipRecord[]).length,
        weapons: (erkulLiveWeapons as WeaponRecord[]).length,
      },
      'erkul-ptu': {
        ships: (erkulPtuShips as ShipRecord[]).length,
        weapons: (erkulPtuWeapons as WeaponRecord[]).length,
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
    crossCheck: {
      erkulLiveVsSpviewer: buildThresholdCrossCheck(
        erkulLiveShips as ShipRecord[],
        spviewerShips as ShipRecord[]
      ),
      erkulPtuVsSpviewer: buildThresholdCrossCheck(
        erkulPtuShips as ShipRecord[],
        spviewerShips as ShipRecord[]
      ),
    },
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
