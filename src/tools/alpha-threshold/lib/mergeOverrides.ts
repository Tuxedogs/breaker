import type {
  Ship,
  ShipOverride,
  WeaponRecord,
  WeaponOverride,
} from '../types'

export function mergeShipOverride(ship: Ship, override?: ShipOverride): Ship {
  if (!override) return ship

  return {
    ...ship,
    health: override.health ?? ship.health,
    ballisticThreshold:
      override.ballisticThreshold ?? ship.ballisticThreshold,
    energyThreshold:
      override.energyThreshold ?? ship.energyThreshold,
  }
}

export function mergeWeaponOverride(
  weapon: WeaponRecord,
  override?: WeaponOverride
): WeaponRecord {
  if (!override) return weapon

  const alpha = override.alpha ?? weapon.alpha
  const burstDps = override.burstDps ?? weapon.burstDps
  const projectileSpeed = override.speed ?? weapon.projectileSpeed

  return {
    ...weapon,
    alpha,
    burstDps,
    projectileSpeed,
    calculatorProfile: weapon.calculatorProfile
      ? {
          ...weapon.calculatorProfile,
          baseAlpha: alpha,
          effectiveAlpha: alpha,
          baseBurstDps: burstDps,
          effectiveBurstDps: burstDps,
          projectileSpeed,
        }
      : weapon.calculatorProfile,
  }
}
