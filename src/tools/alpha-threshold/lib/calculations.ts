import type { ComparisonResult, Ship, ThresholdMode, Weapon } from '../types'

const wholeFormatter = new Intl.NumberFormat('en-US')
const decimalFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

export function getActiveThreshold(ship: Ship, mode: ThresholdMode): number {
  return mode === 'ballistic' ? ship.ballisticThreshold : ship.energyThreshold
}

export function canDamageHull(weaponAlpha: number, threshold: number): boolean {
  return weaponAlpha >= threshold
}

export function getComparisonResult(
  ship: Ship,
  weapon: Weapon,
  mode: ThresholdMode
): ComparisonResult {
  const threshold = getActiveThreshold(ship, mode)

  return {
    threshold,
    passes: canDamageHull(weapon.alpha, threshold),
  }
}

export function getAxisMax(
  ships: Ship[],
  weapons: Weapon[],
  mode: ThresholdMode
): number {
  const thresholdValues = ships.map((ship) => getActiveThreshold(ship, mode))
  const weaponValues = weapons.map((weapon) => weapon.alpha)

  return Math.max(...thresholdValues, ...weaponValues, 1)
}

export function getAxisPercent(value: number, axisMax: number): number {
  if (axisMax <= 0) return 0

  return Math.min(100, (value / axisMax) * 100)
}

export function formatMetric(value: number): string {
  return Number.isInteger(value)
    ? wholeFormatter.format(value)
    : decimalFormatter.format(value)
}

export function formatEntityLabel(value: string): string {
  return value.replaceAll('_', ' ')
}

export function getWeaponKey(weapon: Weapon): string {
  return `${weapon.type}:${weapon.size}:${weapon.name}`
}
