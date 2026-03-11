import {
  createWeaponId,
  inferWeaponClass,
  parseWeaponSize,
} from '../normalize'
import type { WeaponRecord } from '../../../types'

type SpviewerWeaponSeed = {
  uuid?: string
  displayName?: string
  size?: string | number
  damageType?: WeaponRecord['damageType']
  alphaDamage?: number | null
  burstDps?: number | null
  speed?: number | null
  patch?: string
}

export function normalizeSpviewerWeapon(seed: SpviewerWeaponSeed): WeaponRecord {
  const name = seed.displayName ?? 'Unknown SPViewer Weapon'
  const size = parseWeaponSize(seed.size ?? 0)
  const damageType = seed.damageType === 'energy' || seed.damageType === 'distortion'
    ? seed.damageType
    : 'ballistic'

  return {
    id: createWeaponId({ damageType, size, name }),
    name,
    size,
    damageType,
    weaponClass: inferWeaponClass(name),
    alpha: seed.alphaDamage ?? null,
    burstDps: seed.burstDps ?? null,
    projectileSpeed: seed.speed ?? null,
    source: 'spviewer',
    sourceId: seed.uuid,
    patch: seed.patch,
  }
}
