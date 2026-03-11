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

  return {
    ...weapon,
    alpha: override.alpha ?? weapon.alpha,
    burstDps: override.burstDps ?? weapon.burstDps,
    projectileSpeed: override.speed ?? weapon.projectileSpeed,
  }
}
