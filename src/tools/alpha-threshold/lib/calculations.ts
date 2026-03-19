import type {
  ArmorStatePercent,
  AxisScaleMode,
  HeatmapTraceModel,
  HeatmapTraceStatus,
  PenetrationState,
  SelectedShipResult,
  SelectedWeaponComparison,
  Ship,
  ShipHeatmapModel,
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function getMatchedThresholdForWeapon(
  ship: Ship,
  selectedWeapon: SelectedWeaponComparison
) {
  const matchedDamageType = selectedWeapon.weapon.damageType as WeaponThresholdType
  const baseThreshold = getThresholdForWeaponType(ship, matchedDamageType)

  return {
    matchedDamageType,
    baseThreshold,
  }
}

export function getPenetrationStartRatio(
  ship: Ship,
  selectedWeapon: SelectedWeaponComparison
) {
  const { baseThreshold } = getMatchedThresholdForWeapon(ship, selectedWeapon)
  const weaponAlpha = selectedWeapon.weapon.alpha ?? 0

  if (baseThreshold <= 0) return 1
  if (weaponAlpha <= 0) return 0

  return clamp(weaponAlpha / baseThreshold, 0, 1)
}

export function getEffectiveThresholdAtArmorRatio(
  ship: Ship,
  selectedWeapon: SelectedWeaponComparison,
  armorRatio: number
) {
  const { baseThreshold } = getMatchedThresholdForWeapon(ship, selectedWeapon)
  return baseThreshold * clamp(armorRatio, 0, 1)
}

function getHeatmapTraceStatus(
  penetrationStartArmorRatio: number,
  alwaysDeflects: boolean,
  alwaysPenetrates: boolean
): HeatmapTraceStatus {
  if (alwaysDeflects) return 'always-deflects'
  if (alwaysPenetrates) return 'always-penetrates'
  if (penetrationStartArmorRatio >= 0.7) return 'penetrates-early'
  return 'crosses-late'
}

function getPenetrationState(
  baseThreshold: number,
  weaponAlpha: number,
  penetrationStartArmorRatio: number
): PenetrationState {
  if (!Number.isFinite(baseThreshold) || baseThreshold <= 0) return 'immediate'
  if (!Number.isFinite(weaponAlpha) || weaponAlpha <= 0) return 'blocked'
  if (penetrationStartArmorRatio >= 1) return 'immediate'
  return 'threshold'
}

export function buildHeatmapTraceModel(
  ship: Ship,
  selectedWeapon: SelectedWeaponComparison
): HeatmapTraceModel {
  const { matchedDamageType, baseThreshold } = getMatchedThresholdForWeapon(
    ship,
    selectedWeapon
  )
  const weaponAlpha = selectedWeapon.weapon.alpha ?? 0
  const penetrationStartArmorRatio = getPenetrationStartRatio(ship, selectedWeapon)
  const penetrationStartArmorPercent = penetrationStartArmorRatio * 100
  const penetrationStartX = 1 - penetrationStartArmorRatio
  const effectiveThresholdAtCrossover = getEffectiveThresholdAtArmorRatio(
    ship,
    selectedWeapon,
    penetrationStartArmorRatio
  )
  const overUnderDeltaAtFullArmor = weaponAlpha - baseThreshold
  const alwaysDeflects = weaponAlpha <= 0
  const alwaysPenetrates = baseThreshold <= 0 || weaponAlpha >= baseThreshold
  const penetrationState = getPenetrationState(
    baseThreshold,
    weaponAlpha,
    penetrationStartArmorRatio
  )
  const transitionWidth = 0.04
  const nearCrossoverBandStart = clamp(
    penetrationStartX - transitionWidth,
    0,
    1
  )
  const nearCrossoverBandEnd = clamp(
    penetrationStartX + transitionWidth,
    0,
    1
  )

  return {
    weapon: selectedWeapon,
    matchedDamageType,
    baseThreshold,
    weaponAlpha,
    penetrationStartArmorRatio,
    penetrationStartArmorPercent,
    penetrationStartX,
    effectiveThresholdAtCrossover,
    overUnderDeltaAtFullArmor,
    alwaysDeflects,
    alwaysPenetrates,
    nearCrossoverBandStart,
    nearCrossoverBandEnd,
    penetrationState,
    status: getHeatmapTraceStatus(
      penetrationStartArmorRatio,
      alwaysDeflects,
      alwaysPenetrates
    ),
  }
}

export function buildShipHeatmapModel(
  ship: Ship,
  selectedWeapons: SelectedWeaponComparison[]
): ShipHeatmapModel {
  const traces = selectedWeapons.map((selectedWeapon) =>
    buildHeatmapTraceModel(ship, selectedWeapon)
  )

  return {
    ship,
    lanes: {
      ballistic: {
        lane: 'ballistic',
        label: 'Ballistic Lane',
        traces: traces.filter((trace) => trace.matchedDamageType === 'ballistic'),
        threshold: ship.ballisticThreshold,
      },
      energy: {
        lane: 'energy',
        label: 'Energy Lane',
        traces: traces.filter((trace) => trace.matchedDamageType === 'energy'),
        threshold: ship.energyThreshold,
      },
    },
  }
}

export function calculateThresholdMargin(
  weaponAlpha: number,
  baseThreshold: number,
  armorPercent: number = 100
) {
  const armorRatio = armorPercent / 100
  const effectiveThreshold = baseThreshold * armorRatio
  const margin = weaponAlpha - effectiveThreshold

  return {
    margin,
    penetrates: margin >= 0,
    effectiveThreshold,
  }
}

export function evaluateThresholdCell(
  weaponAlpha: number,
  baseThreshold: number,
  armorPercent: number
) {
  const { margin, penetrates, effectiveThreshold } = calculateThresholdMargin(
    weaponAlpha,
    baseThreshold,
    armorPercent
  )

  return {
    margin,
    penetrates,
    effectiveThreshold,
    ratio:
      effectiveThreshold > 0
        ? weaponAlpha / effectiveThreshold
        : weaponAlpha > 0
          ? Number.POSITIVE_INFINITY
          : 0,
  }
}

export function buildArmorSteps() {
  return Array.from({ length: 101 }, (_, index) => 100 - index)
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

  return getNiceAxisMax(Math.max(highestThreshold * 1.1, visibleWeaponMax, 1))
}

export function getNiceAxisMax(value: number): number {
  if (value <= 0) return 1

  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude

  if (normalized <= 1) return magnitude
  if (normalized <= 1.5) return 1.5 * magnitude
  if (normalized <= 2) return 2 * magnitude
  if (normalized <= 2.5) return 2.5 * magnitude
  if (normalized <= 5) return 5 * magnitude

  return 10 * magnitude
}

export function getAxisPercent(value: number, axisMax: number): number {
  if (axisMax <= 0) return 0

  return Math.min(100, (value / axisMax) * 100)
}

export function buildShipComparisonResult(
  ship: Ship,
  selectedWeapon: SelectedWeaponComparison,
  axisMaxByType: Record<WeaponThresholdType, number>,
  armorPercent: number = 100
): ShipComparisonResult {
  const thresholdType = selectedWeapon.weapon.damageType as WeaponThresholdType
  const weaponAlpha = selectedWeapon.weapon.alpha ?? 0
  const threshold = getThresholdForWeaponType(ship, thresholdType)
  const { margin, penetrates, effectiveThreshold } = calculateThresholdMargin(
    weaponAlpha,
    threshold,
    armorPercent
  )

  return {
    slotId: selectedWeapon.slotId,
    slotLabel: selectedWeapon.slotLabel,
    tone: selectedWeapon.tone,
    weapon: selectedWeapon.weapon,
    thresholdType,
    threshold,
    effectiveThreshold,
    margin,
    passes: penetrates,
    overflow: weaponAlpha > axisMaxByType[thresholdType],
  }
}

export function buildSelectedShipResult(
  ship: Ship,
  selectedWeapons: SelectedWeaponComparison[],
  axisMaxByType: Record<WeaponThresholdType, number>,
  armorPercent: ArmorStatePercent = 100
): SelectedShipResult {
  const results = selectedWeapons.map((selectedWeapon) =>
    buildShipComparisonResult(ship, selectedWeapon, axisMaxByType, armorPercent)
  )
  const passingCount = results.filter((result) => result.passes).length

  return {
    ship,
    results,
    passingCount,
    blockedCount: results.length - passingCount,
    hasSelections: results.length > 0,
    axisMaxByType,
    armorPercent,
  }
}

export function buildShipWeaponMatrix(
  ships: Ship[],
  weapons: SelectedWeaponComparison[],
  armorPercent: ArmorStatePercent = 100
) {
  return ships.map((ship) => ({
    ship,
    weapons: weapons.map((weapon) => {
      const thresholdType = weapon.weapon.damageType as WeaponThresholdType
      const threshold = getThresholdForWeaponType(ship, thresholdType)
      const { margin, penetrates, effectiveThreshold } = calculateThresholdMargin(
        weapon.weapon.alpha ?? 0,
        threshold,
        armorPercent
      )

      return {
        weapon,
        threshold,
        effectiveThreshold,
        margin,
        penetrates,
      }
    }),
  }))
}

export function buildAxisMaxByType(
  ships: Ship[],
  selectedWeapons: SelectedWeaponComparison[]
): Record<WeaponThresholdType, number> {
  return {
    ballistic: getLaneAxisMax(ships, selectedWeapons, 'ballistic'),
    energy: getLaneAxisMax(ships, selectedWeapons, 'energy'),
  }
}

export function resolveAxisMaxByType(
  ship: Ship,
  selectedShips: Ship[],
  selectedWeapons: SelectedWeaponComparison[],
  axisScaleMode: AxisScaleMode
): Record<WeaponThresholdType, number> {
  if (axisScaleMode === 'per-row') {
    return buildAxisMaxByType([ship], selectedWeapons)
  }

  if (axisScaleMode === 'by-size') {
    return buildAxisMaxByType(
      selectedShips.filter((candidate) => candidate.sizeGroup === ship.sizeGroup),
      selectedWeapons
    )
  }

  return buildAxisMaxByType(selectedShips, selectedWeapons)
}
