import type {
  GroupedWeaponClass,
  GroupedWeaponDamageType,
  GroupedWeaponSize,
  WeaponDamageType,
  WeaponRecord,
  WeaponThresholdType,
} from '../../types'

export type { GroupedWeaponClass, GroupedWeaponDamageType, GroupedWeaponSize }
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
