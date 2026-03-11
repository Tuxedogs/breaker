import {
  createWeaponId,
  inferWeaponClass,
  parseWeaponSize,
} from '../normalize'
import type { ManualWeaponSeed } from '../types'
import type { WeaponRecord } from '../../../types'

export function normalizeManualWeaponRecord(
  seed: ManualWeaponSeed,
  source: WeaponRecord['source'] = 'merged'
): WeaponRecord {
  const size = parseWeaponSize(seed.size)

  return {
    id: createWeaponId({
      damageType: seed.type,
      size,
      name: seed.name,
    }),
    name: seed.name,
    size,
    damageType: seed.type,
    weaponClass: inferWeaponClass(seed.name),
    alpha: seed.alpha,
    burstDps: seed.burstDps,
    projectileSpeed: seed.speed,
    source,
    sourceId: seed.name,
  }
}
