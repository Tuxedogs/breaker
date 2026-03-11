export type ThresholdMode = 'ballistic' | 'energy'

export type Ship = {
  manufacturer: string
  name: string
  health: number
  ballisticThreshold: number
  energyThreshold: number
}

export type WeaponType = 'ballistic' | 'energy'

export type Weapon = {
  name: string
  size: string
  type: WeaponType
  burstDps: number
  alpha: number
  speed: number
}

export type ShipOverride = {
  health?: number
  ballisticThreshold?: number
  energyThreshold?: number
}

export type WeaponOverride = {
  alpha?: number
  burstDps?: number
  speed?: number
}

export type ShipOverridesMap = Record<string, ShipOverride>
export type WeaponOverridesMap = Record<string, WeaponOverride>

export type ShipSortKey =
  | 'threshold-desc'
  | 'health-desc'
  | 'manufacturer-asc'

export type ComparisonSlot = {
  id: string
  weaponName: string | null
}

export type ComparisonResult = {
  threshold: number
  passes: boolean
}

export type SlotTone = 'cyan' | 'violet' | 'amber'

export type SelectedWeaponComparison = {
  slotId: string
  slotLabel: string
  tone: SlotTone
  weapon: Weapon
}
