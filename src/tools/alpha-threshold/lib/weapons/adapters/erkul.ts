import {
  createWeaponId,
  inferWeaponClass,
  parseWeaponSize,
} from '../normalize'
import type { WeaponRecord } from '../../../types'

type ErkulWeaponSeed = {
  id?: string
  name?: string
  size?: string | number
  type?: WeaponRecord['damageType']
  alpha?: number | null
  burstDps?: number | null
  projectileSpeed?: number | null
  patch?: string
}

export function normalizeErkulWeapon(seed: ErkulWeaponSeed): WeaponRecord {
  const name = seed.name ?? 'Unknown Erkul Weapon'
  const size = parseWeaponSize(seed.size ?? 0)
  const damageType = seed.type === 'energy' || seed.type === 'distortion'
    ? seed.type
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
    source: 'erkul',
    sourceId: seed.id,
    patch: seed.patch,
  }
}
