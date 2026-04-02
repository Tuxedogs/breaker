import type {
  GroupedWeaponClass,
  GroupedWeaponSize,
  WeaponDamageType,
  WeaponRecord,
  WeaponThresholdType,
} from '../../types'

export type { GroupedWeaponClass, GroupedWeaponSize }
export type { WeaponRecord, WeaponThresholdType }

export type ManualWeaponSeed = {
  name: string
  size: string
  type: WeaponDamageType
  weaponClass?: string
  burstDps: number
  alpha: number
  speed: number
  patch?: string
}
