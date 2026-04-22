import type { WeaponRecord } from '../../types'

const THRESHOLD_POOL_EXCLUDED_NAME_PATTERNS = [
  {
    pattern: 'omnisky',
    reason: 'Currently treated as universal E100 overmatch and omitted from per-target threshold comparisons.',
  },
] as const

export function getThresholdWeaponPoolExclusionReason(weapon: WeaponRecord): string | null {
  const normalizedName = weapon.name.trim().toLowerCase()

  const nameMatch = THRESHOLD_POOL_EXCLUDED_NAME_PATTERNS.find(({ pattern }) =>
    normalizedName.includes(pattern)
  )

  if (nameMatch) return nameMatch.reason

  return null
}

export function isExcludedFromThresholdWeaponPool(weapon: WeaponRecord): boolean {
  return getThresholdWeaponPoolExclusionReason(weapon) != null
}
