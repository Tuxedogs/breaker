import type {
  ArmorStatePercent,
  ArmorInteractionEstimate,
  AxisScaleMode,
  DefenseDamageChannel,
  DefenseShieldState,
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
import { getWeaponsForSource } from '../data/weapons/weapons'

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

function getDamageChannel(damageType: WeaponRecord['damageType']): DefenseDamageChannel {
  return damageType === 'ballistic' ? 'physical' : 'energy'
}

function getFallbackArmorThreshold(ship: Ship, damageChannel: DefenseDamageChannel) {
  return damageChannel === 'physical' ? ship.ballisticThreshold : ship.energyThreshold
}

function getThresholdRatio(effectiveArmorAlpha: number, deflectionThreshold: number): number {
  if (deflectionThreshold <= 0) {
    return effectiveArmorAlpha > 0 ? Number.POSITIVE_INFINITY : 0
  }

  return effectiveArmorAlpha / deflectionThreshold
}

function getWeaponConfidenceOverride(
  weapon: WeaponRecord
): ArmorInteractionEstimate['confidence'] | null {
  const normalizedName = weapon.name.trim().toLowerCase()

  if (normalizedName.startsWith('deadbolt') && weapon.size >= 4) {
    return 'high'
  }

  if (/^m\d+a$/i.test(weapon.name.trim()) && weapon.size >= 3) {
    return 'high'
  }

  if (normalizedName.startsWith('attrition-') && weapon.size >= 4) {
    return 'high'
  }

  if (normalizedName.includes('medusa')) {
    return 'high'
  }

  if (normalizedName.startsWith('omnisky')) {
    return 'medium'
  }

  return null
}

type ObservedBreakpointState = NonNullable<
  NonNullable<Ship['defenseProfile']>['observedBreakpoints']
>[string]['shieldsUp']

type AnchorEstimate = {
  onsetPercent: number
  band: [number, number]
  notes: string[]
}

function getObservedOnsetRatio(
  state: NonNullable<ObservedBreakpointState> | undefined
): number | null {
  if (!state) return null
  if (state.armorDamageStartsAtPercent != null) {
    return clamp(state.armorDamageStartsAtPercent / 100, 0, 1)
  }

  return state.damagesFreshArmor === true ? 1 : null
}

function getObservedBallisticShieldCarryover(ship: Ship): number | null {
  const observedBreakpoints = ship.defenseProfile?.observedBreakpoints
  if (!observedBreakpoints) return null

  const carryovers = Object.entries(observedBreakpoints)
    .filter(([weaponId]) => weaponId.startsWith('ballistic:'))
    .map(([, states]) => {
      const downRatio = getObservedOnsetRatio(states.shieldsDown)
      const upRatio = getObservedOnsetRatio(states.shieldsUp)
      if (downRatio == null || upRatio == null || downRatio <= 0) return null

      return clamp(upRatio / downRatio, 0, 1.25)
    })
    .filter((value): value is number => value != null)

  if (!carryovers.length) return null

  carryovers.sort((left, right) => left - right)
  return carryovers[Math.floor(carryovers.length / 2)] ?? null
}

function estimateBallisticOnsetFromThreshold(
  ship: Ship,
  weapon: WeaponRecord,
  shieldState: DefenseShieldState,
  thresholdRatio: number,
  damageChannel: DefenseDamageChannel
): AnchorEstimate | null {
  if (weapon.damageType !== 'ballistic' || damageChannel !== 'physical') return null

  const baseRatio =
    shieldState === 'down'
      ? thresholdRatio
      : (() => {
          const carryover = getObservedBallisticShieldCarryover(ship)
          if (carryover == null) return null

          const shieldsDownRatio =
            ship.defenseProfile?.armor.physical.deflectionThreshold
              ? (weapon.alpha ?? 0) / ship.defenseProfile.armor.physical.deflectionThreshold
              : null
          if (shieldsDownRatio == null) return null

          return shieldsDownRatio * carryover
        })()

  if (baseRatio == null) return null

  if (baseRatio >= 1) {
    return {
      onsetPercent: 100,
      band: [100, 100],
      notes:
        shieldState === 'up'
          ? ['Estimated from observed ship ballistic shield carryover and current alpha, yielding guaranteed fresh armor damage.']
          : ['Estimated from ballistic armor threshold ratio, yielding guaranteed fresh armor damage.'],
    }
  }

  const onsetPercent = Math.round(clamp(baseRatio * 100, 1, 99))
  const band: [number, number] = [
    Math.max(1, onsetPercent - 3),
    Math.min(99, onsetPercent + 3),
  ]

  return {
    onsetPercent,
    band,
    notes:
      shieldState === 'up'
        ? ['Estimated from observed ship ballistic shield carryover, weapon alpha, and armor threshold ratio.']
        : ['Estimated directly from ballistic alpha versus armor threshold ratio.'],
  }
}

const weaponLookup = new Map(
  ['merged', 'erkul-live', 'erkul-ptu', 'manual', 'spviewer']
    .flatMap((source) => getWeaponsForSource(source as WeaponThresholdType extends never ? never : 'merged' | 'erkul-live' | 'erkul-ptu' | 'manual' | 'spviewer'))
    .map((weapon) => [weapon.id, weapon] as const)
)

function getAnchorEffectiveArmorAlpha(
  ship: Ship,
  weaponId: string,
  shieldState: DefenseShieldState
): number | null {
  const defenseProfile = ship.defenseProfile
  if (!defenseProfile) return null

  const anchorWeapon = weaponLookup.get(weaponId)
  if (!anchorWeapon || anchorWeapon.alpha == null) return null

  const damageChannel = weaponId.startsWith('ballistic:') ? 'physical' : 'energy'
  const shieldPassThrough =
    shieldState === 'up'
      ? defenseProfile.shields.passThrough[damageChannel].max
      : 1

  return anchorWeapon.alpha * shieldPassThrough
}

function estimateOnsetFromAnchors(
  ship: Ship,
  weapon: WeaponRecord,
  shieldState: DefenseShieldState,
  effectiveArmorAlpha: number,
  damageChannel: DefenseDamageChannel
): AnchorEstimate | null {
  const observedBreakpoints = ship.defenseProfile?.observedBreakpoints
  if (!observedBreakpoints) return null

  const anchorEntries = Object.entries(observedBreakpoints)
    .map(([weaponId, states]) => {
      const state = shieldState === 'up' ? states.shieldsUp : states.shieldsDown
      if (!state) return null

      const sameChannel =
        (weaponId.startsWith('ballistic:') && damageChannel === 'physical') ||
        (!weaponId.startsWith('ballistic:') && damageChannel === 'energy')

      if (!sameChannel) return null

      return { weaponId, state }
    })
    .filter((entry): entry is { weaponId: string; state: NonNullable<ObservedBreakpointState> } => entry !== null)

  if (!anchorEntries.length) return null

  const anchors = anchorEntries
    .map((entry) => ({
      ...entry,
      effectiveArmorAlpha: getAnchorEffectiveArmorAlpha(ship, entry.weaponId, shieldState),
    }))
    .filter((entry): entry is typeof entry & { effectiveArmorAlpha: number } => entry.effectiveArmorAlpha != null)
    .sort((left, right) => left.effectiveArmorAlpha - right.effectiveArmorAlpha)

  if (!anchors.length) return null

  const lowerObserved = [...anchors]
    .reverse()
    .find((entry) =>
      entry.effectiveArmorAlpha <= effectiveArmorAlpha &&
      entry.state.armorDamageStartsAtPercent != null
    )
  const higherFresh = anchors.find((entry) =>
    entry.effectiveArmorAlpha > effectiveArmorAlpha &&
    entry.state.damagesFreshArmor === true
  )

  if (!lowerObserved) return null

  const lowerOnset = lowerObserved.state.armorDamageStartsAtPercent ?? null
  if (lowerOnset == null) return null

  if (!higherFresh) {
    const conservative = Math.round(clamp(lowerOnset + 4, lowerOnset, 95))
    return {
      onsetPercent: conservative,
      band: [Math.max(lowerOnset, conservative - 4), Math.min(100, conservative + 2)],
      notes: [`Estimated from ${weaponLookup.get(lowerObserved.weaponId)?.name ?? lowerObserved.weaponId} at ${lowerOnset}%.`],
    }
  }

  const relativeLift =
    lowerObserved.effectiveArmorAlpha > 0
      ? (effectiveArmorAlpha - lowerObserved.effectiveArmorAlpha) / lowerObserved.effectiveArmorAlpha
      : 0
  const cappedLift = clamp(relativeLift, 0, 0.25)
  const onsetPercent = Math.round(clamp(lowerOnset + cappedLift * 32, lowerOnset, 99))
  const band: [number, number] = [
    Math.max(lowerOnset, onsetPercent - 4),
    Math.min(100, onsetPercent + 2),
  ]

  return {
    onsetPercent,
    band,
    notes: [
      `Estimated from ${weaponLookup.get(lowerObserved.weaponId)?.name ?? lowerObserved.weaponId} at ${lowerOnset}% and ${weapon.name}'s higher alpha.`,
    ],
  }
}

export function estimateArmorInteraction(
  weapon: WeaponRecord,
  ship: Ship,
  shieldState: DefenseShieldState
): ArmorInteractionEstimate {
  const notes: string[] = []
  const defenseProfile = ship.defenseProfile
  const damageChannel = getDamageChannel(weapon.damageType)

  if (weapon.damageType === 'distortion') {
    notes.push('Distortion currently maps to the energy channel for this phase.')
  }

  if (!defenseProfile) {
    notes.push('Defense profile missing on ship; using neutral fallback values.')

    const effectiveArmorAlpha = weapon.alpha ?? 0
    const deflectionThreshold =
      damageChannel === 'physical' ? ship.ballisticThreshold : ship.energyThreshold
    const thresholdRatio = getThresholdRatio(effectiveArmorAlpha, deflectionThreshold)

    return {
      damageChannel,
      shieldState,
      armorDamageMultiplier: 1,
      shieldPassThrough: 1,
      effectiveArmorAlpha,
      deflectionThreshold,
      thresholdRatio,
      damagesFreshArmor: thresholdRatio >= 1,
      armorDamageStartsAtPercent: thresholdRatio >= 1 ? 100 : null,
      armorDamageStartsAtPercentSource: thresholdRatio >= 1 ? 'threshold' : 'none',
      estimatedArmorOnsetBand: null,
      confidence: 'low',
      notes,
    }
  }

  const armor = defenseProfile.armor[damageChannel]
  const armorDamageMultiplier = armor.damageMultiplier
  const resolvedDeflectionThreshold =
    armor.deflectionThreshold > 0
      ? armor.deflectionThreshold
      : getFallbackArmorThreshold(ship, damageChannel)
  const shieldPassThrough =
    shieldState === 'up'
      ? defenseProfile.shields.passThrough[damageChannel].max
      : 1

  if (shieldState === 'up' && shieldPassThrough <= 0) {
    notes.push(
      `Resolved shield profile fully blocks ${damageChannel} damage from reaching armor while shields are up.`
    )

    return {
      damageChannel,
      shieldState,
      armorDamageMultiplier,
      shieldPassThrough,
      effectiveArmorAlpha: 0,
      deflectionThreshold: resolvedDeflectionThreshold,
      thresholdRatio: 0,
      damagesFreshArmor: false,
      armorDamageStartsAtPercent: null,
      armorDamageStartsAtPercentSource: 'none',
      estimatedArmorOnsetBand: null,
      confidence: 'high',
      notes,
    }
  }

  const effectiveArmorAlpha = (weapon.alpha ?? 0) * shieldPassThrough
  const deflectionThreshold = resolvedDeflectionThreshold
  const thresholdRatio = getThresholdRatio(effectiveArmorAlpha, deflectionThreshold)
  const observedBreakpoint = defenseProfile.observedBreakpoints?.[weapon.id]
  const observedState =
    shieldState === 'up'
      ? observedBreakpoint?.shieldsUp
      : observedBreakpoint?.shieldsDown
  const hasObservedDamageOverride = observedState?.damagesFreshArmor != null
  const explicitObservedOnset = observedState?.armorDamageStartsAtPercent ?? null
  const explicitObservedOnsetSource = observedState?.source ?? 'observed'
  const ballisticCurveEstimate =
    !observedState
      ? estimateBallisticOnsetFromThreshold(
          ship,
          weapon,
          shieldState,
          thresholdRatio,
          damageChannel
        )
      : null
  const anchorEstimate =
    explicitObservedOnset == null && observedState?.damagesFreshArmor === false
      ? estimateOnsetFromAnchors(
          ship,
          weapon,
          shieldState,
          effectiveArmorAlpha,
          damageChannel
        )
      : null

  if (shieldState === 'up' && defenseProfile.shields.count === 0) {
    notes.push('Ship has no resolved shields; shield-up calculation uses pass-through 1.0.')
  }

  if (!observedState && !ballisticCurveEstimate && thresholdRatio < 1) {
    notes.push('Observed breakpoint missing; calibration curve not implemented yet.')
  }

  if (observedState?.notes?.length) {
    notes.push(...observedState.notes)
  }

  if (anchorEstimate) {
    notes.push(...anchorEstimate.notes)
  }

  if (ballisticCurveEstimate) {
    notes.push(...ballisticCurveEstimate.notes)
  }

  const thresholdOnsetPercent =
    !hasObservedDamageOverride && thresholdRatio > 0 && thresholdRatio < 1
      ? Math.round(clamp(thresholdRatio * 100, 1, 99))
      : null

  const damagesFreshArmor = hasObservedDamageOverride
    ? Boolean(observedState?.damagesFreshArmor)
    : thresholdRatio >= 1

  const armorDamageStartsAtPercent =
    explicitObservedOnset ??
    ballisticCurveEstimate?.onsetPercent ??
    anchorEstimate?.onsetPercent ??
    thresholdOnsetPercent ??
    (!hasObservedDamageOverride && thresholdRatio >= 1 ? 100 : null) ??
    (observedState?.damagesFreshArmor === true ? 100 : null)

  const armorDamageStartsAtPercentSource =
    explicitObservedOnset != null
      ? explicitObservedOnsetSource
      : ballisticCurveEstimate
        ? 'estimated'
      : anchorEstimate
        ? 'estimated'
        : thresholdOnsetPercent != null
          ? 'threshold'
        : !hasObservedDamageOverride && thresholdRatio >= 1
          ? 'threshold'
          : observedState?.damagesFreshArmor === true
            ? 'observed'
            : 'none'
  const rawEstimatedArmorOnsetBand =
    explicitObservedOnsetSource === 'estimated'
      ? observedState?.estimatedArmorOnsetBand ?? null
      : ballisticCurveEstimate?.band ?? anchorEstimate?.band ?? null
  const estimatedArmorOnsetBand =
    armorDamageStartsAtPercent === 100 ? null : rawEstimatedArmorOnsetBand
  const computedConfidence =
    explicitObservedOnset != null || hasObservedDamageOverride
      ? 'high'
      : ballisticCurveEstimate
        ? 'medium'
      : anchorEstimate
        ? 'medium'
        : thresholdOnsetPercent != null
          ? 'medium'
        : !hasObservedDamageOverride && thresholdRatio >= 1
          ? 'medium'
          : 'low'
  const confidence = getWeaponConfidenceOverride(weapon) ?? computedConfidence

  return {
    damageChannel,
    shieldState,
    armorDamageMultiplier,
    shieldPassThrough,
    effectiveArmorAlpha,
    deflectionThreshold,
    thresholdRatio,
    damagesFreshArmor,
    armorDamageStartsAtPercent,
    armorDamageStartsAtPercentSource,
    estimatedArmorOnsetBand,
    confidence,
    ...(notes.length ? { notes } : {}),
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
