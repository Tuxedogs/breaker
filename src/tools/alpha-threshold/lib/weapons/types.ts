import type {
  GroupedWeaponClass,
  GroupedWeaponDamageType,
  GroupedWeaponSize,
  WeaponRecord,
  WeaponThresholdType,
} from '../../types'

export type { GroupedWeaponClass, GroupedWeaponDamageType, GroupedWeaponSize }
export type { WeaponRecord, WeaponThresholdType }

export type ManualWeaponSeed = {
  name: string
  size: string
  type: WeaponThresholdType
  burstDps: number
  alpha: number
  speed: number
}
