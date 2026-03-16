import {
  createWeaponId,
  inferWeaponClass,
  normalizeWeaponClass,
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
  data?: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function inferDamageType(rawData: Record<string, unknown> | null, seed: ErkulWeaponSeed): WeaponRecord['damageType'] {
  if (seed.type === 'energy' || seed.type === 'distortion') return seed.type
  if (seed.type === 'ballistic') return 'ballistic'

  const damage = asRecord(asRecord(rawData?.ammo)?.data)?.damage
  const damageRecord = asRecord(damage)
  const distortion = asNumber(damageRecord?.damageDistortion, 0)
  const energy = asNumber(damageRecord?.damageEnergy, 0)
  const physical = asNumber(damageRecord?.damagePhysical, 0)

  if (distortion > 0 && distortion >= energy && distortion >= physical) return 'distortion'
  if (energy > 0 && energy >= physical) return 'energy'
  return 'ballistic'
}

export function normalizeErkulWeapon(seed: ErkulWeaponSeed): WeaponRecord {
  const rawData = asRecord(seed.data)
  const name = seed.name ?? String(rawData?.name ?? rawData?.shortName ?? 'Unknown Erkul Weapon')
  const inferredSize = typeof rawData?.size === 'string' || typeof rawData?.size === 'number'
    ? rawData.size
    : 0
  const size = parseWeaponSize(seed.size ?? inferredSize)
  const damageType = inferDamageType(rawData, seed)
  const damage = asRecord(asRecord(asRecord(rawData?.ammo)?.data)?.damage)
  const fireActions = Array.isArray(asRecord(rawData?.weapon)?.fireActions)
    ? (asRecord(rawData?.weapon)?.fireActions as Array<Record<string, unknown>>)
    : []
  const primaryFireAction = fireActions[0] ?? null
  const pelletCount = Math.max(1, asNumber(primaryFireAction?.pelletCount, 1))
  const alpha = seed.alpha ?? (
    (
      asNumber(damage?.damagePhysical, 0) +
      asNumber(damage?.damageEnergy, 0) +
      asNumber(damage?.damageDistortion, 0) +
      asNumber(damage?.damageThermal, 0) +
      asNumber(damage?.damageBiochemical, 0) +
      asNumber(damage?.damageStun, 0)
    ) * pelletCount
  )
  const fireRate = asNumber(primaryFireAction?.fireRate, 0)
  const burstDps = seed.burstDps ?? (fireRate > 0 ? alpha * (fireRate / 60) : null)
  const projectileSpeedValue = seed.projectileSpeed ?? asNumber(asRecord(asRecord(rawData?.ammo)?.data)?.speed, 0)
  const projectileSpeed = projectileSpeedValue > 0 ? projectileSpeedValue : null
  const group = typeof rawData?.group === 'string' ? rawData.group : ''
  const weaponClass = group ? normalizeWeaponClass(group) : inferWeaponClass(name)

  return {
    id: createWeaponId({ damageType, size, name }),
    name,
    size,
    damageType,
    weaponClass,
    alpha,
    burstDps,
    projectileSpeed,
    source: 'erkul',
    sourceId: seed.id ?? (typeof rawData?.ref === 'string' ? rawData.ref : undefined),
    patch: seed.patch,
  }
}
