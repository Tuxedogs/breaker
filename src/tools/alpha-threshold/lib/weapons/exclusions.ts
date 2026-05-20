import type { WeaponRecord } from '../../types'

function normalizeWeaponName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const THRESHOLD_POOL_EXCLUDED_EXACT_NAMES = new Set([
  'reign 3',
  'yengtu',
  'weak',
  'evsd',
  'atvs',
  'wasp',
  'thlilye laser',
  'gvsr',
  'gsvr',
  'whip',
  'singe 2',
  'singe 3',
  'warlord',
  'war',
  'wrath',
])

const THRESHOLD_POOL_EXCLUDED_NAME_PATTERNS: Array<{ pattern: string; reason: string }> = []

export function getThresholdWeaponPoolExclusionReason(weapon: WeaponRecord): string | null {
  const normalizedName = normalizeWeaponName(weapon.name)

  if (THRESHOLD_POOL_EXCLUDED_EXACT_NAMES.has(normalizedName)) {
    return 'Excluded bespoke or non-standard weapon omitted from threshold preset pools.'
  }

  const nameMatch = THRESHOLD_POOL_EXCLUDED_NAME_PATTERNS.find(({ pattern }) =>
    normalizedName.includes(pattern)
  )

  if (nameMatch) return nameMatch.reason

  return null
}

export function isExcludedFromThresholdWeaponPool(weapon: WeaponRecord): boolean {
  return getThresholdWeaponPoolExclusionReason(weapon) != null
}
