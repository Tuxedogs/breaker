import {
  buildArmorSteps,
  evaluateThresholdCell,
  getThresholdForWeaponType,
} from './calculations'
import type { Ship, WeaponRecord, WeaponThresholdType } from '../types'

export type RecommendationBand = 'guaranteed' | 'strong' | 'viable' | 'weak'
export type RecommendationFilter = 'all' | `type:${WeaponThresholdType}` | `class:${string}`

export type WeaponRecommendation = {
  weapon: WeaponRecord
  viabilityScore: number
  viabilityPercent: number
  viabilityBand: RecommendationBand
  firstPenetrationArmorPercent: number | null
  firstPenetrationStepLabel: string
  firstPenetrationX: number
  viableCoveragePercent: number
  penetrationConsistencyPercent: number
  penetratedStepCount: number
  totalStepCount: number
  thresholdType: WeaponThresholdType
}

const ARMOR_STEPS = buildArmorSteps()

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundPercent(value: number) {
  return Math.round(clamp(value, 0, 1) * 100)
}

function getFirstPenetrationArmorPercent(
  ship: Ship,
  weapon: WeaponRecord,
  thresholdType: WeaponThresholdType
) {
  for (const armorPercent of ARMOR_STEPS) {
    const cell = evaluateThresholdCell(
      weapon.alpha ?? 0,
      getThresholdForWeaponType(ship, thresholdType),
      armorPercent
    )

    if (cell.penetrates) {
      return armorPercent
    }
  }

  return null
}

function getPenetratedArmorSteps(
  ship: Ship,
  weapon: WeaponRecord,
  thresholdType: WeaponThresholdType
) {
  return ARMOR_STEPS.filter((armorPercent) =>
    evaluateThresholdCell(
      weapon.alpha ?? 0,
      getThresholdForWeaponType(ship, thresholdType),
      armorPercent
    ).penetrates
  )
}

function getRecommendationBand(viabilityPercent: number): RecommendationBand {
  if (viabilityPercent >= 100) return 'guaranteed'
  if (viabilityPercent >= 90) return 'strong'
  if (viabilityPercent >= 75) return 'viable'
  return 'weak'
}

function getTieBreakerScore(weapon: WeaponRecord, maxAlpha: number, maxSpeed: number) {
  const alphaScore = maxAlpha > 0 ? clamp((weapon.alpha ?? 0) / maxAlpha, 0, 1) : 0
  const speedScore =
    maxSpeed > 0 ? clamp((weapon.projectileSpeed ?? 0) / maxSpeed, 0, 1) : 0

  return alphaScore * 0.75 + speedScore * 0.25
}

export function isThresholdRecommendationWeapon(weapon: WeaponRecord): weapon is WeaponRecord & {
  damageType: WeaponThresholdType
} {
  return weapon.damageType === 'ballistic' || weapon.damageType === 'energy'
}

function shouldExcludeRecommendationWeapon(weapon: WeaponRecord) {
  const normalizedName = weapon.name.trim().toLowerCase()

  return (
    normalizedName.includes('sledge') ||
    normalizedName.includes('singe') ||
    normalizedName.includes('deadbolt') ||
    /\bm\d+a\b/.test(normalizedName)
  )
}

export function matchesRecommendationFilter(
  weapon: WeaponRecord,
  filter: RecommendationFilter
) {
  if (filter === 'all') return true
  if (filter.startsWith('type:')) {
    return weapon.damageType === filter.slice(5)
  }
  if (filter.startsWith('class:')) {
    return weapon.weaponClass === filter.slice(6)
  }
  return true
}

export function evaluateWeaponRecommendation(
  ship: Ship,
  weapon: WeaponRecord,
  maxAlpha: number,
  maxSpeed: number
): WeaponRecommendation | null {
  if (!isThresholdRecommendationWeapon(weapon)) return null
  if (shouldExcludeRecommendationWeapon(weapon)) return null

  const thresholdType = weapon.damageType
  const penetratedArmorSteps = getPenetratedArmorSteps(ship, weapon, thresholdType)
  const firstPenetrationArmorPercent =
    getFirstPenetrationArmorPercent(ship, weapon, thresholdType)
  const penetratedStepCount = penetratedArmorSteps.length
  const totalStepCount = ARMOR_STEPS.length
  const viableCoverage = penetratedStepCount / totalStepCount
  const firstPenetrationScore =
    firstPenetrationArmorPercent == null ? 0 : firstPenetrationArmorPercent / 100
  const penetrationConsistencyScore =
    firstPenetrationArmorPercent == null
      ? 0
      : penetratedArmorSteps.filter((armorPercent) => armorPercent <= firstPenetrationArmorPercent)
          .length / (firstPenetrationArmorPercent + 1)
  const tieBreakerScore = getTieBreakerScore(weapon, maxAlpha, maxSpeed)
  const weightedScore =
    firstPenetrationScore * 0.5 +
    viableCoverage * 0.35 +
    tieBreakerScore * 0.15
  const guaranteed =
    firstPenetrationArmorPercent === 100 && penetratedStepCount === totalStepCount
  const viabilityScore = guaranteed ? 1 : clamp(weightedScore, 0, 0.99)
  const viabilityPercent = roundPercent(viabilityScore)

  return {
    weapon,
    viabilityScore,
    viabilityPercent,
    viabilityBand: getRecommendationBand(viabilityPercent),
    firstPenetrationArmorPercent,
    firstPenetrationStepLabel:
      firstPenetrationArmorPercent == null
        ? 'No penetration on the armor curve'
        : `Begins penetrating at ${firstPenetrationArmorPercent}% armor`,
    firstPenetrationX:
      firstPenetrationArmorPercent == null ? 1 : 1 - firstPenetrationArmorPercent / 100,
    viableCoveragePercent: roundPercent(viableCoverage),
    penetrationConsistencyPercent: roundPercent(penetrationConsistencyScore),
    penetratedStepCount,
    totalStepCount,
    thresholdType,
  }
}

export function buildWeaponRecommendations(
  ship: Ship,
  weapons: WeaponRecord[]
): WeaponRecommendation[] {
  const thresholdWeapons = weapons.filter(isThresholdRecommendationWeapon)
  const maxAlpha = Math.max(...thresholdWeapons.map((weapon) => weapon.alpha ?? 0), 0)
  const maxSpeed = Math.max(...thresholdWeapons.map((weapon) => weapon.projectileSpeed ?? 0), 0)
  const evaluatedRecommendations = thresholdWeapons
    .map((weapon) => evaluateWeaponRecommendation(ship, weapon, maxAlpha, maxSpeed))
    .filter((recommendation): recommendation is WeaponRecommendation => Boolean(recommendation))

  return evaluatedRecommendations.sort((left, right) => {
      if (right.viabilityScore !== left.viabilityScore) {
        return right.viabilityScore - left.viabilityScore
      }
      if (
        (right.firstPenetrationArmorPercent ?? -1) !==
        (left.firstPenetrationArmorPercent ?? -1)
      ) {
        return (right.firstPenetrationArmorPercent ?? -1) - (left.firstPenetrationArmorPercent ?? -1)
      }
      if ((right.weapon.alpha ?? 0) !== (left.weapon.alpha ?? 0)) {
        return (right.weapon.alpha ?? 0) - (left.weapon.alpha ?? 0)
      }
      return (right.weapon.projectileSpeed ?? 0) - (left.weapon.projectileSpeed ?? 0)
    })
}
