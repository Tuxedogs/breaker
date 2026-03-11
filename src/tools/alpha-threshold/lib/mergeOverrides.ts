import type {
  Ship,
  ShipOverride,
  Weapon,
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
  weapon: Weapon,
  override?: WeaponOverride
): Weapon {
  if (!override) return weapon

  return {
    ...weapon,
    alpha: override.alpha ?? weapon.alpha,
    burstDps: override.burstDps ?? weapon.burstDps,
    speed: override.speed ?? weapon.speed,
  }
}
