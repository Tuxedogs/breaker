import {
  createWeaponId,
  inferWeaponClass,
  normalizeWeaponClass,
  parseWeaponSize,
} from '../normalize'
import type { ManualWeaponSeed } from '../types'
import type {
  WeaponRecord,
  WeaponThresholdType,
} from '../../../types'

const EXCLUDED_MANUAL_PATTERNS = [
  /rocket pod/i,
  /laser beam/i,
  /point defense/i,
  /bengal/i,
  /idris/i,
  /javelin/i,
  /ground/i,
  /cutlass steel/i,
  /defense division/i,
  /sharkmouth edition/i,
  /wikelo/i,
  /atls/i,
] as const

type ParsedManualDumpRow = {
  size: string
  name: string
  type: string
  burstDps: number
  alpha: number
  speed: number
}

function parseNumericValue(value: string): number {
  return Number.parseFloat(value.replace(/,/g, '').trim())
}

export function normalizeManualDamageType(value: string): WeaponThresholdType | 'distortion' | null {
  const normalizedValue = value.trim().toLowerCase()

  if (normalizedValue.startsWith('ballistic')) return 'ballistic'
  if (normalizedValue.startsWith('distortion')) return 'distortion'
  if (
    normalizedValue.startsWith('laser') ||
    normalizedValue.startsWith('neutron') ||
    normalizedValue.startsWith('plasma') ||
    normalizedValue.startsWith('tachyon') ||
    normalizedValue.startsWith('energy')
  ) {
    return 'energy'
  }

  return null
}

export function shouldExcludeManualWeapon(name: string): boolean {
  return EXCLUDED_MANUAL_PATTERNS.some((pattern) => pattern.test(name))
}

export function isSupportedManualWeaponSize(size: string, name: string): boolean {
  const parsedSize = parseWeaponSize(size)

  if (parsedSize >= 1 && parsedSize <= 5) return true
  if (parsedSize === 8 && /medusa cannon/i.test(name)) return true

  return false
}

export function normalizeManualWeaponClass(value: string, name: string): string {
  if (value.trim()) {
    return normalizeWeaponClass(value)
      .replace('scatter gun', 'scattergun')
      .replace('scattergun', 'scattergun')
      .replace('massdriver', 'mass driver')
  }

  return inferWeaponClass(name)
}

export function parseManualDumpRow(rawRow: string): ParsedManualDumpRow | null {
  const normalizedRow = rawRow.trim()

  if (!normalizedRow) return null

  const columns = normalizedRow
    .split(/\t|\s{2,}/)
    .map((column) => column.trim())
    .filter(Boolean)

  if (columns.length < 6) return null

  const [size, name, type, burstDps, alpha, speed] = columns
  const parsedBurstDps = parseNumericValue(burstDps)
  const parsedAlpha = parseNumericValue(alpha)
  const parsedSpeed = parseNumericValue(speed)

  if (
    Number.isNaN(parsedBurstDps) ||
    Number.isNaN(parsedAlpha) ||
    Number.isNaN(parsedSpeed)
  ) {
    return null
  }

  return {
    size,
    name,
    type,
    burstDps: parsedBurstDps,
    alpha: parsedAlpha,
    speed: parsedSpeed,
  }
}

export function parseManualWeaponDump(
  rawDump: string,
  patch = '4.7 PTU'
): ManualWeaponSeed[] {
  const seeds: Array<ManualWeaponSeed | null> = rawDump
    .split(/\r?\n/)
    .map((row) => parseManualDumpRow(row))
    .filter((row): row is ParsedManualDumpRow => row !== null)
    .map((row) => {
      const damageType = normalizeManualDamageType(row.type)

      if (!damageType) return null
      if (shouldExcludeManualWeapon(row.name)) return null
      if (!isSupportedManualWeaponSize(row.size, row.name)) return null

      return {
        name: row.name,
        size: row.size,
        type: damageType,
        weaponClass: normalizeManualWeaponClass('', row.name),
        alpha: row.alpha,
        burstDps: row.burstDps,
        speed: row.speed,
        patch,
      } satisfies ManualWeaponSeed
    })

  return seeds.filter((row): row is ManualWeaponSeed => row !== null)
}

export function normalizeManualWeaponRecord(
  seed: ManualWeaponSeed,
  source: WeaponRecord['source'] = 'manual'
): WeaponRecord {
  const size = parseWeaponSize(seed.size)
  const weaponClass = seed.weaponClass
    ? normalizeWeaponClass(seed.weaponClass)
    : inferWeaponClass(seed.name)

  return {
    id: createWeaponId({
      damageType: seed.type,
      size,
      name: seed.name,
    }),
    name: seed.name,
    size,
    damageType: seed.type,
    weaponClass,
    alpha: seed.alpha,
    burstDps: seed.burstDps,
    projectileSpeed: seed.speed,
    source,
    sourceId: seed.name,
    patch: seed.patch,
  }
}
