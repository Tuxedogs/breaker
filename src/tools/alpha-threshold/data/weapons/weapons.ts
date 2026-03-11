import { normalizeManualWeaponRecord } from '../../lib/weapons/adapters/manual'
import type { WeaponRecord } from '../../types'
import { manualWeaponSeeds } from './manualSeeds'

export const weapons: WeaponRecord[] = manualWeaponSeeds.map((weaponSeed) =>
  normalizeManualWeaponRecord(weaponSeed)
)
