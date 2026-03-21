import { promises as fs } from 'node:fs'
import path from 'node:path'

type SourceChannel = 'live' | 'ptu'
type JsonRecord = Record<string, unknown>

type ImportArgs = {
  liveShips: string
  ptuShips: string
  liveShields: string
  ptuShields: string
  outDir: string
  reportPath: string
}

type ResolvedRange = {
  min: number
  max: number
}

type ResolvedShieldDatasetRecord = {
  id: string
  ref: string
  localName: string
  name: string
  size: number | null
  shieldClass: string | null
  isBespoke: boolean
  resistance: {
    physical: ResolvedRange
    energy: ResolvedRange
    distortion: ResolvedRange
  }
  absorption: {
    physical: ResolvedRange
    energy: ResolvedRange
  }
}

type ResolvedShipShieldProfile = {
  shipName: string
  source: SourceChannel
  shieldCount: number
  shieldSize: number | number[]
  installedShieldIds: string[]
  installedShieldNames: string[]
  installedShieldClass?: string[]
  hasBespokeShield: boolean
  resistance: {
    physical: ResolvedRange
    energy: ResolvedRange
    distortion: ResolvedRange
  }
  absorption: {
    physical: ResolvedRange
    energy: ResolvedRange
  }
  passThrough: {
    physical: ResolvedRange
    energy: ResolvedRange
  }
  rawShieldRecords: string[]
}

type ShipDefenseProfile = {
  id: string
  name: string
  source: SourceChannel
  armor: {
    hp: number
    physical: {
      damageMultiplier: number
      deflectionThreshold: number
    }
    energy: {
      damageMultiplier: number
      deflectionThreshold: number
    }
  }
  hull: {
    hp: number
    physical: { damageMultiplier: number }
    energy: { damageMultiplier: number }
  }
  shields: {
    count: number
    size: number | number[]
    installedShieldIds: string[]
    installedShieldNames: string[]
    installedShieldClass?: string[]
    hasBespokeShield: boolean
    rawShieldRecords: string[]
    physical: {
      resistance: ResolvedRange
      absorption: ResolvedRange
    }
    energy: {
      resistance: ResolvedRange
      absorption: ResolvedRange
    }
    distortion?: {
      resistance: ResolvedRange
      absorption: ResolvedRange
    }
    passThrough: {
      physical: ResolvedRange
      energy: ResolvedRange
    }
  }
}

type ValidationEntry = {
  shipName: string
  shipId: string
  source: SourceChannel
  shieldCount: number
  unresolvedPorts: Array<{
    itemPortName: string
    localName?: string
    localReference?: string
  }>
}

function parseArgs(argv: string[]): ImportArgs {
  const values: ImportArgs = {
    liveShips: 'tmp/erkul-live-ships.json',
    ptuShips: 'tmp/erkul-ptu-ships.json',
    liveShields: 'https://server.erkul.games/live/shields',
    ptuShields: 'https://server.erkul.games/ptu/shields',
    outDir: 'src/tools/alpha-threshold/data/shields',
    reportPath: 'tmp/ship-shield-profile-report.json',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (!arg.startsWith('--')) continue
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`)
    }

    switch (arg) {
      case '--live-ships':
        values.liveShips = next
        break
      case '--ptu-ships':
        values.ptuShips = next
        break
      case '--live-shields':
        values.liveShields = next
        break
      case '--ptu-shields':
        values.ptuShields = next
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
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
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
  return Array.isArray(payload)
    ? payload.filter((entry): entry is JsonRecord => typeof entry === 'object' && entry !== null)
    : []
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function toRange(min: unknown, max: unknown): ResolvedRange {
  return {
    min: asNumber(min) ?? 0,
    max: asNumber(max) ?? 0,
  }
}

function collectShipTokens(records: JsonRecord[]): Set<string> {
  const tokens = new Set<string>()

  for (const record of records) {
    const rawData = asRecord(record.data)
    const insurance = asRecord(rawData?.insurance)
    const shipId = asString(insurance?.shipEntityClassName) ?? ''

    for (const token of shipId.toLowerCase().split('_')) {
      if (token.length >= 4) {
        tokens.add(token)
      }
    }
  }

  return tokens
}

function isBespokeShieldLocalName(localName: string, shipTokens: Set<string>): boolean {
  const segments = localName.toLowerCase().split('_')
  const identifyingToken = segments[3] ?? ''

  if (segments.length !== 5 || segments[0] !== 'shld' || !/^s0\d$/.test(segments[2]) || segments[4] !== 'scitem') {
    return true
  }

  const size = Number(segments[2].slice(1))
  return size >= 4 && identifyingToken.length >= 4 && shipTokens.has(identifyingToken)
}

function normalizeShieldRecord(record: JsonRecord, shipTokens: Set<string>): ResolvedShieldDatasetRecord | null {
  const data = asRecord(record.data)
  const shield = asRecord(data?.shield)
  const resistance = asRecord(shield?.resistance)
  const absorption = asRecord(shield?.absorption)
  const ref = asString(data?.ref)
  const localName = asString(record.localName)
  const name = asString(data?.name)

  if (!data || !shield || !resistance || !absorption || !ref || !localName || !name) {
    return null
  }

  return {
    id: ref,
    ref,
    localName,
    name,
    size: asNumber(data.size),
    shieldClass: asString(data.class),
    isBespoke: isBespokeShieldLocalName(localName, shipTokens),
    resistance: {
      physical: toRange(resistance.physicalMin, resistance.physicalMax),
      energy: toRange(resistance.energyMin, resistance.energyMax),
      distortion: toRange(resistance.distortionMin, resistance.distortionMax),
    },
    absorption: {
      physical: toRange(absorption.physicalMin, absorption.physicalMax),
      energy: toRange(absorption.energyMin, absorption.energyMax),
    },
  }
}

function serializeConst(name: string, value: unknown): string {
  return `export const ${name} = ${JSON.stringify(value, null, 2)} as const\n`
}

async function writeDataFile(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, 'utf8')
}

function computePassThrough(
  resistance: ResolvedRange,
  absorption: ResolvedRange
): ResolvedRange {
  return {
    min: (1 - resistance.min) * (1 - absorption.min),
    max: (1 - resistance.max) * (1 - absorption.max),
  }
}

function getShieldPorts(ship: JsonRecord): JsonRecord[] {
  const loadout = Array.isArray(asRecord(ship.data)?.loadout)
    ? ((asRecord(ship.data)?.loadout as unknown[]) ?? [])
    : []

  return loadout
    .map((entry) => asRecord(entry))
    .filter((entry): entry is JsonRecord => {
      if (!entry) return false
      const itemPortName = asString(entry.itemPortName)?.toLowerCase() ?? ''
      const itemTypes = Array.isArray(entry.itemTypes) ? entry.itemTypes : []
      return itemTypes.some((itemType) => asRecord(itemType)?.type === 'Shield') || itemPortName.includes('shield_generator')
    })
}

function resolveShipProfile(
  source: SourceChannel,
  ship: JsonRecord,
  shieldByRef: Map<string, ResolvedShieldDatasetRecord>,
  shieldByLocalName: Map<string, ResolvedShieldDatasetRecord>
): { profile: ResolvedShipShieldProfile | null; unresolved: ValidationEntry | null } {
  const rawData = asRecord(ship.data)
  const insurance = asRecord(rawData?.insurance)
  const shipName = asString(rawData?.shortName) ?? asString(ship.name) ?? 'Unknown Ship'
  const shipId = asString(insurance?.shipEntityClassName) ?? asString(rawData?.ref) ?? shipName
  const shieldPorts = getShieldPorts(ship)

  if (!shieldPorts.length) {
    return { profile: null, unresolved: null }
  }

  const unresolvedPorts: ValidationEntry['unresolvedPorts'] = []
  const canonicalShields = new Map<string, ResolvedShieldDatasetRecord>()
  const rawShieldRecords = new Set<string>()
  const shieldSizes = new Set<number>()

  for (const port of shieldPorts) {
    const localReference = asString(port.localReference)
    const localName = asString(port.localName)
    const resolved =
      (localReference ? shieldByRef.get(localReference) : undefined) ??
      (localName ? shieldByLocalName.get(localName) : undefined)

    if (!resolved) {
      unresolvedPorts.push({
        itemPortName: asString(port.itemPortName) ?? 'unknown',
        ...(localName ? { localName } : {}),
        ...(localReference ? { localReference } : {}),
      })
      continue
    }

    canonicalShields.set(resolved.id, resolved)
    rawShieldRecords.add(JSON.stringify(port))

    if (resolved.size !== null) {
      shieldSizes.add(resolved.size)
    } else {
      const portSize = asNumber(port.maxSize)
      if (portSize !== null) shieldSizes.add(portSize)
    }
  }

  const installedShields = Array.from(canonicalShields.values())
  const installedShieldIds = installedShields.map((shield) => shield.id)
  const installedShieldNames = installedShields.map((shield) => shield.name)
  const installedShieldClass = installedShields
    .map((shield) => shield.shieldClass)
    .filter((value): value is string => Boolean(value))
  const shieldSizeValues = Array.from(shieldSizes).sort((left, right) => left - right)
  const canonicalShield = installedShields[0] ?? null

  const profile: ResolvedShipShieldProfile = {
    shipName,
    source,
    shieldCount: shieldPorts.length,
    shieldSize:
      shieldSizeValues.length <= 1
        ? (shieldSizeValues[0] ?? 0)
        : shieldSizeValues,
    installedShieldIds,
    installedShieldNames,
    ...(installedShieldClass.length ? { installedShieldClass } : {}),
    hasBespokeShield: installedShields.some((shield) => shield.isBespoke),
    resistance: canonicalShield
      ? canonicalShield.resistance
      : {
          physical: { min: 0, max: 0 },
          energy: { min: 0, max: 0 },
          distortion: { min: 0, max: 0 },
        },
    absorption: canonicalShield
      ? canonicalShield.absorption
      : {
          physical: { min: 0, max: 0 },
          energy: { min: 0, max: 0 },
        },
    passThrough: canonicalShield
      ? {
          physical: computePassThrough(
            canonicalShield.resistance.physical,
            canonicalShield.absorption.physical
          ),
          energy: computePassThrough(
            canonicalShield.resistance.energy,
            canonicalShield.absorption.energy
          ),
        }
      : {
          physical: { min: 1, max: 1 },
          energy: { min: 1, max: 1 },
        },
    rawShieldRecords: Array.from(rawShieldRecords),
  }

  const unresolved =
    unresolvedPorts.length > 0
      ? {
          shipName,
          shipId,
          source,
          shieldCount: shieldPorts.length,
          unresolvedPorts,
        }
      : null

  return { profile, unresolved }
}

function buildDefenseProfile(
  source: SourceChannel,
  ship: JsonRecord,
  shieldProfile: ResolvedShipShieldProfile | null
): ShipDefenseProfile {
  const rawData = asRecord(ship.data)
  const rawArmor = asRecord(rawData?.armor)
  const rawArmorData = asRecord(rawArmor?.data)
  const rawArmorHealth = asRecord(rawArmorData?.health)
  const rawArmorDamageResistance = asRecord(rawArmorHealth?.damageResistanceMultiplier)
  const rawArmorStats = asRecord(rawArmorData?.armor)
  const rawArmorDamageMultiplier = asRecord(rawArmorStats?.damageMultiplier)
  const rawArmorDeflection = asRecord(rawArmorStats?.armorDeflection)
  const rawHullHealth = asRecord(rawData?.health)
  const rawHullDamageResistance = asRecord(rawHullHealth?.damageResistanceMultiplier)
  const insurance = asRecord(rawData?.insurance)

  const shipName = asString(rawData?.shortName) ?? asString(ship.name) ?? 'Unknown Ship'
  const shipId = asString(insurance?.shipEntityClassName) ?? asString(rawData?.ref) ?? shipName

  return {
    id: shipId,
    name: shipName,
    source,
    armor: {
      hp: asNumber(rawArmorHealth?.hp) ?? 0,
      physical: {
        damageMultiplier:
          asNumber(rawArmorDamageResistance?.physical) ??
          asNumber(rawArmorDamageMultiplier?.damagePhysical) ??
          1,
        deflectionThreshold: asNumber(rawArmorDeflection?.damagePhysical) ?? 0,
      },
      energy: {
        damageMultiplier:
          asNumber(rawArmorDamageResistance?.energy) ??
          asNumber(rawArmorDamageMultiplier?.damageEnergy) ??
          1,
        deflectionThreshold: asNumber(rawArmorDeflection?.damageEnergy) ?? 0,
      },
    },
    hull: {
      hp: asNumber(rawHullHealth?.hp) ?? 0,
      physical: {
        damageMultiplier: asNumber(rawHullDamageResistance?.physical) ?? 1,
      },
      energy: {
        damageMultiplier: asNumber(rawHullDamageResistance?.energy) ?? 1,
      },
    },
    shields: {
      count: shieldProfile?.shieldCount ?? 0,
      size: shieldProfile?.shieldSize ?? 0,
      installedShieldIds: shieldProfile?.installedShieldIds ?? [],
      installedShieldNames: shieldProfile?.installedShieldNames ?? [],
      ...(shieldProfile?.installedShieldClass?.length
        ? { installedShieldClass: shieldProfile.installedShieldClass }
        : {}),
      hasBespokeShield: shieldProfile?.hasBespokeShield ?? false,
      rawShieldRecords: shieldProfile?.rawShieldRecords ?? [],
      physical: {
        resistance: shieldProfile?.resistance.physical ?? { min: 0, max: 0 },
        absorption: shieldProfile?.absorption.physical ?? { min: 0, max: 0 },
      },
      energy: {
        resistance: shieldProfile?.resistance.energy ?? { min: 0, max: 0 },
        absorption: shieldProfile?.absorption.energy ?? { min: 0, max: 0 },
      },
      distortion: {
        resistance: shieldProfile?.resistance.distortion ?? { min: 0, max: 0 },
        absorption: { min: 1, max: 1 },
      },
      passThrough: shieldProfile?.passThrough ?? {
        physical: { min: 1, max: 1 },
        energy: { min: 1, max: 1 },
      },
    },
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const [liveShipsPayload, ptuShipsPayload, liveShieldsPayload, ptuShieldsPayload] = await Promise.all([
    readJsonInput(args.liveShips),
    readJsonInput(args.ptuShips),
    readJsonInput(args.liveShields),
    readJsonInput(args.ptuShields),
  ])

  const liveShipRecords = collectRecords(liveShipsPayload)
  const ptuShipRecords = collectRecords(ptuShipsPayload)
  const liveShipTokens = collectShipTokens(liveShipRecords)
  const ptuShipTokens = collectShipTokens(ptuShipRecords)

  const liveShieldRecords = collectRecords(liveShieldsPayload)
    .map((record) => normalizeShieldRecord(record, liveShipTokens))
    .filter((record): record is ResolvedShieldDatasetRecord => record !== null)
  const ptuShieldRecords = collectRecords(ptuShieldsPayload)
    .map((record) => normalizeShieldRecord(record, ptuShipTokens))
    .filter((record): record is ResolvedShieldDatasetRecord => record !== null)

  const liveShieldByRef = new Map(liveShieldRecords.map((record) => [record.ref, record]))
  const ptuShieldByRef = new Map(ptuShieldRecords.map((record) => [record.ref, record]))
  const liveShieldByLocalName = new Map(liveShieldRecords.map((record) => [record.localName, record]))
  const ptuShieldByLocalName = new Map(ptuShieldRecords.map((record) => [record.localName, record]))

  const liveProfiles: ResolvedShipShieldProfile[] = []
  const ptuProfiles: ResolvedShipShieldProfile[] = []
  const liveDefenseProfiles: ShipDefenseProfile[] = []
  const ptuDefenseProfiles: ShipDefenseProfile[] = []
  const unresolvedShips: ValidationEntry[] = []

  for (const ship of liveShipRecords) {
    const { profile, unresolved } = resolveShipProfile('live', ship, liveShieldByRef, liveShieldByLocalName)
    if (profile) liveProfiles.push(profile)
    liveDefenseProfiles.push(buildDefenseProfile('live', ship, profile))
    if (unresolved) unresolvedShips.push(unresolved)
  }

  for (const ship of ptuShipRecords) {
    const { profile, unresolved } = resolveShipProfile('ptu', ship, ptuShieldByRef, ptuShieldByLocalName)
    if (profile) ptuProfiles.push(profile)
    ptuDefenseProfiles.push(buildDefenseProfile('ptu', ship, profile))
    if (unresolved) unresolvedShips.push(unresolved)
  }

  const report = {
    generatedAt: new Date().toISOString(),
    datasets: {
      live: {
        shields: liveShieldRecords.length,
        shipProfiles: liveProfiles.length,
        bespokeShields: liveShieldRecords.filter((record) => record.isBespoke).length,
      },
      ptu: {
        shields: ptuShieldRecords.length,
        shipProfiles: ptuProfiles.length,
        bespokeShields: ptuShieldRecords.filter((record) => record.isBespoke).length,
      },
    },
    validation: {
      unresolvedShips,
      shipsWithoutResolvedShield: [...liveProfiles, ...ptuProfiles]
        .filter((profile) => profile.installedShieldIds.length === 0)
        .map((profile) => ({
          shipName: profile.shipName,
          source: profile.source,
          shieldCount: profile.shieldCount,
        })),
      bespokeShips: [...liveProfiles, ...ptuProfiles]
        .filter((profile) => profile.hasBespokeShield)
        .map((profile) => ({
          shipName: profile.shipName,
          source: profile.source,
          installedShieldNames: profile.installedShieldNames,
        })),
    },
  }

  await Promise.all([
    writeDataFile(
      path.join(args.outDir, 'erkulLiveShieldDataset.ts'),
      serializeConst('erkulLiveShieldDataset', liveShieldRecords)
    ),
    writeDataFile(
      path.join(args.outDir, 'erkulPtuShieldDataset.ts'),
      serializeConst('erkulPtuShieldDataset', ptuShieldRecords)
    ),
    writeDataFile(
      path.join(args.outDir, 'erkulLiveShieldProfiles.ts'),
      serializeConst('erkulLiveShieldProfiles', liveProfiles)
    ),
    writeDataFile(
      path.join(args.outDir, 'erkulPtuShieldProfiles.ts'),
      serializeConst('erkulPtuShieldProfiles', ptuProfiles)
    ),
    writeDataFile(
      path.join(args.outDir, 'erkulLiveShipDefenseProfiles.ts'),
      serializeConst('erkulLiveShipDefenseProfiles', liveDefenseProfiles)
    ),
    writeDataFile(
      path.join(args.outDir, 'erkulPtuShipDefenseProfiles.ts'),
      serializeConst('erkulPtuShipDefenseProfiles', ptuDefenseProfiles)
    ),
    writeDataFile(
      path.join(args.outDir, 'erkulLiveShieldLookupByRef.ts'),
      serializeConst(
        'erkulLiveShieldLookupByRef',
        Object.fromEntries(liveShieldRecords.map((record) => [record.ref, record]))
      )
    ),
    writeDataFile(
      path.join(args.outDir, 'erkulPtuShieldLookupByRef.ts'),
      serializeConst(
        'erkulPtuShieldLookupByRef',
        Object.fromEntries(ptuShieldRecords.map((record) => [record.ref, record]))
      )
    ),
    writeDataFile(
      path.join(args.outDir, 'erkulLiveShieldLookupByLocalName.ts'),
      serializeConst(
        'erkulLiveShieldLookupByLocalName',
        Object.fromEntries(liveShieldRecords.map((record) => [record.localName, record]))
      )
    ),
    writeDataFile(
      path.join(args.outDir, 'erkulPtuShieldLookupByLocalName.ts'),
      serializeConst(
        'erkulPtuShieldLookupByLocalName',
        Object.fromEntries(ptuShieldRecords.map((record) => [record.localName, record]))
      )
    ),
    writeDataFile(args.reportPath, `${JSON.stringify(report, null, 2)}\n`),
  ])

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
