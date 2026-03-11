import type {
  SelectedShipResult,
  SelectedWeaponComparison,
  Ship,
  ShipComparisonResult,
  ShipSizeGroup,
  ShipSizeGroupOption,
  WeaponRecord,
  WeaponThresholdType,
} from '../types'

const wholeFormatter = new Intl.NumberFormat('en-US')
const decimalFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

export const SHIP_SIZE_GROUPS: ShipSizeGroupOption[] = [
  { id: 'capital', label: 'Capitals' },
  { id: 'large', label: 'Large' },
  { id: 'medium', label: 'Medium' },
  { id: 'small', label: 'Small' },
]

export function getThresholdForWeaponType(
  ship: Ship,
  thresholdType: WeaponThresholdType
): number {
  return thresholdType === 'ballistic'
    ? ship.ballisticThreshold
    : ship.energyThreshold
}

export function canDamageHull(weaponAlpha: number, threshold: number): boolean {
  return weaponAlpha >= threshold
}

export function formatMetric(value: number): string {
  return Number.isInteger(value)
    ? wholeFormatter.format(value)
    : decimalFormatter.format(value)
}

export function formatEntityLabel(value: string): string {
  return value.replaceAll('_', ' ')
}

export function getWeaponKey(weapon: WeaponRecord): string {
  return weapon.id
}

export function getShipGroupLabel(sizeGroup: ShipSizeGroup): string {
  return (
    SHIP_SIZE_GROUPS.find((group) => group.id === sizeGroup)?.label ?? sizeGroup
  )
}

export function getDefaultCollapsedGroups(): Record<ShipSizeGroup, boolean> {
  return {
    capital: true,
    large: false,
    medium: false,
    small: false,
  }
}

export function getDefaultSelectedShips(): string[] {
  return []
}

export function getLaneAxisMax(
  ships: Ship[],
  weapons: SelectedWeaponComparison[],
  thresholdType: WeaponThresholdType
): number {
  const thresholdValues = ships.map((ship) =>
    getThresholdForWeaponType(ship, thresholdType)
  )
  const highestThreshold = Math.max(...thresholdValues, 1)
  const highestWeaponAlpha = Math.max(
    ...weapons
      .filter((weapon) => weapon.weapon.damageType === thresholdType)
      .map((weapon) => weapon.weapon.alpha ?? 0),
    0
  )
  const visibleWeaponMax = Math.min(highestWeaponAlpha, highestThreshold * 2.25)

  return Math.max(highestThreshold * 1.1, visibleWeaponMax, 1)
}

export function getAxisPercent(value: number, axisMax: number): number {
  if (axisMax <= 0) return 0

  return Math.min(100, (value / axisMax) * 100)
}

export function buildShipComparisonResult(
  ship: Ship,
  selectedWeapon: SelectedWeaponComparison,
  axisMaxByType: Record<WeaponThresholdType, number>
): ShipComparisonResult {
  const thresholdType = selectedWeapon.weapon.damageType as WeaponThresholdType
  const weaponAlpha = selectedWeapon.weapon.alpha ?? 0
  const threshold = getThresholdForWeaponType(ship, thresholdType)

  return {
    slotId: selectedWeapon.slotId,
    slotLabel: selectedWeapon.slotLabel,
    tone: selectedWeapon.tone,
    weapon: selectedWeapon.weapon,
    thresholdType,
    threshold,
    passes: canDamageHull(weaponAlpha, threshold),
    overflow: weaponAlpha > axisMaxByType[thresholdType],
  }
}

export function buildSelectedShipResult(
  ship: Ship,
  selectedWeapons: SelectedWeaponComparison[],
  axisMaxByType: Record<WeaponThresholdType, number>
): SelectedShipResult {
  const results = selectedWeapons.map((selectedWeapon) =>
    buildShipComparisonResult(ship, selectedWeapon, axisMaxByType)
  )
  const passingCount = results.filter((result) => result.passes).length

  return {
    ship,
    results,
    passingCount,
    blockedCount: results.length - passingCount,
    hasSelections: results.length > 0,
  }
}
