import {
  createWeaponId,
  inferWeaponClass,
  parseWeaponSize,
} from '../normalize'
import type { WeaponRecord } from '../../../types'

type ScunpackedWeaponSeed = {
  recordId?: string
  name?: string
  itemSize?: string | number
  damageType?: WeaponRecord['damageType']
  alpha?: number | null
  burstDps?: number | null
  projectileSpeed?: number | null
  patch?: string
}

export function normalizeScunpackedWeapon(
  seed: ScunpackedWeaponSeed
): WeaponRecord {
  const name = seed.name ?? 'Unknown scunpacked Weapon'
  const size = parseWeaponSize(seed.itemSize ?? 0)
  const damageType = seed.damageType === 'energy' || seed.damageType === 'distortion'
    ? seed.damageType
    : 'ballistic'

  return {
    id: createWeaponId({ damageType, size, name }),
    name,
    size,
    damageType,
    weaponClass: inferWeaponClass(name),
    alpha: seed.alpha ?? null,
    burstDps: seed.burstDps ?? null,
    projectileSpeed: seed.projectileSpeed ?? null,
    source: 'scunpacked',
    sourceId: seed.recordId,
    patch: seed.patch,
  }
}
