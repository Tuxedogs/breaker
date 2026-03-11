export type ShipSizeGroup =
  | 'capital'
  | 'large'
  | 'medium'
  | 'small'

export type Ship = {
  manufacturer: string
  name: string
  sizeGroup: ShipSizeGroup
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
  | 'health-desc'
  | 'ballistic-desc'
  | 'energy-desc'
  | 'manufacturer-asc'

export type ComparisonSlot = {
  id: string
  weaponKey: string | null
}

export type SlotTone = 'cyan' | 'violet' | 'amber' | 'emerald'

export type SelectedWeaponComparison = {
  slotId: string
  slotLabel: string
  tone: SlotTone
  weapon: Weapon
}

export type ShipComparisonResult = {
  slotId: string
  slotLabel: string
  tone: SlotTone
  weapon: Weapon
  thresholdType: WeaponType
  threshold: number
  passes: boolean
  overflow: boolean
}

export type SelectedShipResult = {
  ship: Ship
  results: ShipComparisonResult[]
  passingCount: number
  blockedCount: number
  hasSelections: boolean
}

export type ShipSizeGroupOption = {
  id: ShipSizeGroup
  label: string
}

export type ShipSidebarGroup = {
  id: ShipSizeGroup
  label: string
  ships: Ship[]
  visibleCount: number
  selectedCount: number
  collapsed: boolean
}
