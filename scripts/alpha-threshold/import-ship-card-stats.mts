import { promises as fs } from 'node:fs'
import path from 'node:path'

import { normalizeShipManufacturer, normalizeShipName } from '../../src/tools/alpha-threshold/lib/ships/normalize'

type JsonRecord = Record<string, unknown>

type CardStats = {
  scmSpeed: number | null
  navSpeed: number | null
  boostSpeedForward: number | null
  boostSpeedBackward: number | null
  forwardGs: number | null
  reverseGs: number | null
  boostForwardGs: number | null
  boostReverseGs: number | null
  pitch: number | null
  yaw: number | null
  roll: number | null
  boostPitch: number | null
  boostYaw: number | null
  boostRoll: number | null
  noiseCount: number | null
  decoyCount: number | null
}

const EARTH_GRAVITY = 9.80665

type CliArgs = {
  manifestPath: string
  reportPath?: string
}

const ERKUL_ENDPOINTS = [
  'https://server.erkul.games/live/ships',
  'https://server.erkul.games/ptu/ships',
] as const

function parseArgs(argv: string[]): CliArgs {
  const values: CliArgs = {
    manifestPath: 'src/tools/alpha-threshold/data/ships/cardStats.ts',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (!arg.startsWith('--')) continue
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`)
    }

    switch (arg) {
      case '--manifest':
        values.manifestPath = next
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

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function createLookupKey(manufacturer: string, name: string): string {
  return `${normalizeShipManufacturer(manufacturer)}::${normalizeShipName(name)}`.toLowerCase()
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      origin: 'https://www.erkul.games',
      referer: 'https://www.erkul.games/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed request ${url}: HTTP ${response.status}`)
  }

  return response.json()
}

function collectRecords(payload: unknown): JsonRecord[] {
  return Array.isArray(payload)
    ? payload.filter((entry): entry is JsonRecord => typeof entry === 'object' && entry !== null)
    : []
}

function inferManufacturer(input: JsonRecord, rawData: JsonRecord | null): string {
  if (typeof input.manufacturer === 'string' && input.manufacturer.trim()) {
    return input.manufacturer
  }

  const entityClassName = asRecord(rawData?.insurance)?.shipEntityClassName
  if (typeof entityClassName === 'string' && entityClassName.includes('_')) {
    return entityClassName.split('_')[0]
  }

  return ''
}

function extractSpeeds(rawData: JsonRecord | null): Pick<CardStats, 'scmSpeed' | 'navSpeed'> {
  const ifcs = asRecord(rawData?.ifcs)
  return {
    scmSpeed: asNumber(ifcs?.scmSpeed),
    navSpeed: asNumber(ifcs?.maxSpeed),
  }
}

function roundGs(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function sumThrusterCapacity(rawData: JsonRecord | null, thrusterType: string) {
  const thrusters = Array.isArray(asRecord(rawData?.items)?.thrusters)
    ? (asRecord(rawData?.items)?.thrusters as unknown[])
    : []

  return thrusters.reduce((total, entry) => {
    const thrusterRecord = asRecord(entry)
    const data = asRecord(thrusterRecord?.data)
    const thruster = asRecord(data?.thruster)

    if (thruster?.thrusterType !== thrusterType) {
      return total
    }

    return total + (asNumber(thruster.thrustCapacity) ?? 0)
  }, 0)
}

function extractAccelerationStats(
  rawData: JsonRecord | null
): Pick<CardStats, 'boostSpeedForward' | 'boostSpeedBackward' | 'forwardGs' | 'reverseGs' | 'boostForwardGs' | 'boostReverseGs'> {
  const ifcs = asRecord(rawData?.ifcs)
  const afterburner = asRecord(ifcs?.afterburner)
  const positiveMultiplier = asNumber(asRecord(afterburner?.afterburnAccelMultiplierPositive)?.y) ?? 1
  const negativeMultiplier = asNumber(asRecord(afterburner?.afterburnAccelMultiplierNegative)?.y) ?? 1
  const shipMass = asNumber(asRecord(rawData?.hull)?.mass)

  if (shipMass == null || shipMass <= 0) {
    return {
      boostSpeedForward: asNumber(ifcs?.boostSpeedForward),
      boostSpeedBackward: asNumber(ifcs?.boostSpeedBackward),
      forwardGs: null,
      reverseGs: null,
      boostForwardGs: null,
      boostReverseGs: null,
    }
  }

  const forwardThrust = sumThrusterCapacity(rawData, 'Main')
  const reverseThrust = sumThrusterCapacity(rawData, 'Retro')
  const forwardGs = forwardThrust > 0 ? forwardThrust / shipMass / EARTH_GRAVITY : null
  const reverseGs = reverseThrust > 0 ? reverseThrust / shipMass / EARTH_GRAVITY : null

  return {
    boostSpeedForward: asNumber(ifcs?.boostSpeedForward),
    boostSpeedBackward: asNumber(ifcs?.boostSpeedBackward),
    forwardGs: roundGs(forwardGs),
    reverseGs: roundGs(reverseGs),
    boostForwardGs: roundGs(forwardGs == null ? null : forwardGs * positiveMultiplier),
    boostReverseGs: roundGs(reverseGs == null ? null : reverseGs * negativeMultiplier),
  }
}

function roundAngularVelocity(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 10) / 10
}

function extractAngularStats(
  rawData: JsonRecord | null
): Pick<CardStats, 'pitch' | 'yaw' | 'roll' | 'boostPitch' | 'boostYaw' | 'boostRoll'> {
  const ifcs = asRecord(rawData?.ifcs)
  const angularVelocity = asRecord(ifcs?.angularVelocity)
  const afterburner = asRecord(ifcs?.afterburner)
  const afterburnMultiplier = asRecord(afterburner?.afterburnAngVelocityMultiplier)

  const pitch = asNumber(angularVelocity?.x)
  const yaw = asNumber(angularVelocity?.y)
  const roll = asNumber(angularVelocity?.z)
  const boostPitchMultiplier = asNumber(afterburnMultiplier?.x) ?? 1
  const boostYawMultiplier = asNumber(afterburnMultiplier?.y) ?? 1
  const boostRollMultiplier = asNumber(afterburnMultiplier?.z) ?? 1

  return {
    pitch: roundAngularVelocity(pitch),
    yaw: roundAngularVelocity(yaw),
    roll: roundAngularVelocity(roll),
    boostPitch: roundAngularVelocity(pitch == null ? null : pitch * boostPitchMultiplier),
    boostYaw: roundAngularVelocity(yaw == null ? null : yaw * boostYawMultiplier),
    boostRoll: roundAngularVelocity(roll == null ? null : roll * boostRollMultiplier),
  }
}

function extractCountermeasureCounts(rawData: JsonRecord | null): Pick<CardStats, 'noiseCount' | 'decoyCount'> {
  const countermeasures = Array.isArray(asRecord(rawData?.items)?.countermeasures)
    ? (asRecord(rawData?.items)?.countermeasures as unknown[])
    : []

  let noiseCount = 0
  let decoyCount = 0

  for (const entry of countermeasures) {
    const countermeasure = asRecord(entry)
    const data = asRecord(countermeasure?.data)
    const shortName = String(data?.shortName ?? '').toLowerCase()
    const ammoContainer = asRecord(data?.ammoContainer)
    const ammoCount = asNumber(ammoContainer?.initialAmmoCount) ?? asNumber(ammoContainer?.maxAmmoCount) ?? 0

    if (shortName.includes('noise')) noiseCount += ammoCount
    if (shortName.includes('decoy')) decoyCount += ammoCount
  }

  return {
    noiseCount: countermeasures.length ? noiseCount : null,
    decoyCount: countermeasures.length ? decoyCount : null,
  }
}

function toCardStats(record: JsonRecord): { key: string; stats: CardStats } | null {
  const rawData = asRecord(record.data)
  const manufacturer = inferManufacturer(record, rawData)
  const name = String(record.name ?? rawData?.shortName ?? rawData?.name ?? '')

  if (!manufacturer || !name) return null

  return {
    key: createLookupKey(manufacturer, name),
    stats: {
      ...extractSpeeds(rawData),
      ...extractAccelerationStats(rawData),
      ...extractAngularStats(rawData),
      ...extractCountermeasureCounts(rawData),
    },
  }
}

async function writeManifest(filePath: string, manifest: Record<string, CardStats>) {
  const content = `export const shipCardStats = ${JSON.stringify(manifest, null, 2)} as const\n`
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, 'utf8')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const manifest = new Map<string, CardStats>()

  for (const endpoint of ERKUL_ENDPOINTS) {
    const payload = await fetchJson(endpoint)
    const records = collectRecords(payload)

    for (const record of records) {
      const next = toCardStats(record)
      if (!next) continue

      const existing = manifest.get(next.key)
      manifest.set(next.key, {
        scmSpeed: existing?.scmSpeed ?? next.stats.scmSpeed,
        navSpeed: existing?.navSpeed ?? next.stats.navSpeed,
        boostSpeedForward: existing?.boostSpeedForward ?? next.stats.boostSpeedForward,
        boostSpeedBackward: existing?.boostSpeedBackward ?? next.stats.boostSpeedBackward,
        forwardGs: existing?.forwardGs ?? next.stats.forwardGs,
        reverseGs: existing?.reverseGs ?? next.stats.reverseGs,
        boostForwardGs: existing?.boostForwardGs ?? next.stats.boostForwardGs,
        boostReverseGs: existing?.boostReverseGs ?? next.stats.boostReverseGs,
        pitch: existing?.pitch ?? next.stats.pitch,
        yaw: existing?.yaw ?? next.stats.yaw,
        roll: existing?.roll ?? next.stats.roll,
        boostPitch: existing?.boostPitch ?? next.stats.boostPitch,
        boostYaw: existing?.boostYaw ?? next.stats.boostYaw,
        boostRoll: existing?.boostRoll ?? next.stats.boostRoll,
        noiseCount: existing?.noiseCount ?? next.stats.noiseCount,
        decoyCount: existing?.decoyCount ?? next.stats.decoyCount,
      })
    }
  }

  const jsonManifest = Object.fromEntries([...manifest.entries()].sort(([left], [right]) => left.localeCompare(right)))
  await writeManifest(args.manifestPath, jsonManifest)

  const report = {
    importedAt: new Date().toISOString(),
    ships: Object.keys(jsonManifest).length,
  }

  if (args.reportPath) {
    await fs.mkdir(path.dirname(args.reportPath), { recursive: true })
    await fs.writeFile(args.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
