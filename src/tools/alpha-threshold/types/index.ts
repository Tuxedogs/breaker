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
  armor: number
  armorHp: number
  vitalHp: number
  patch?: string
  history: ShipBalanceSnapshot[]
  hardpointGroups?: ShipHardpointGroup[]
}

export type ShipBalanceSnapshot = {
  patch: string
  armor: number
  ballisticThreshold: number
  energyThreshold: number
  armorHp: number
  vitalHp: number
}

export type ShipBalanceChangeEntry = {
  ship: Ship
  current: ShipBalanceSnapshot
  previous: ShipBalanceSnapshot
  fields: ShipBalanceFieldChange[]
  changeMagnitude: number
}

export type ShipBalanceFieldKey =
  | 'ballisticThreshold'
  | 'energyThreshold'
  | 'armor'
  | 'armorHp'
  | 'vitalHp'

export type ShipBalanceFieldDirection = 'up' | 'down'

export type ShipBalanceFieldChange = {
  key: ShipBalanceFieldKey
  label: string
  before: number
  after: number
  delta: number
  direction: ShipBalanceFieldDirection
}

export type HardpointRole = 'pilot' | 'turret'

export type ShipHardpointGroup = {
  id: string
  role: HardpointRole
  label: string
  size: number
  count: number
}

export type WeaponDamageType = 'ballistic' | 'energy' | 'distortion'
export type WeaponThresholdType = Extract<WeaponDamageType, 'ballistic' | 'energy'>
export type WeaponSource =
  | 'manual'
  | 'erkul'
  | 'spviewer'
  | 'scunpacked'
  | 'merged'

export type WeaponRecord = {
  id: string
  name: string
  size: number
  damageType: WeaponDamageType
  weaponClass: string
  alpha: number | null
  burstDps: number | null
  projectileSpeed: number | null
  source?: WeaponSource
  sourceId?: string
  patch?: string
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
  label?: string
  role?: HardpointRole
  size?: number
  count?: number
}

export type SlotTone = 'cyan' | 'violet' | 'amber' | 'emerald'
export type AxisScaleMode = 'global' | 'by-size' | 'per-row'

export type SelectedWeaponComparison = {
  slotId: string
  slotLabel: string
  tone: SlotTone
  weapon: WeaponRecord
}

export type ShipComparisonResult = {
  slotId: string
  slotLabel: string
  tone: SlotTone
  weapon: WeaponRecord
  thresholdType: WeaponThresholdType
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
  axisMaxByType: Record<WeaponThresholdType, number>
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

export type ShipManufacturerOption = {
  value: string
  label: string
  count: number
}

export type GroupedWeaponClass = {
  weaponClass: string
  weapons: WeaponRecord[]
}

export type GroupedWeaponDamageType = {
  damageType: WeaponThresholdType
  classes: GroupedWeaponClass[]
}

export type GroupedWeaponSize = {
  size: number
  damageTypes: GroupedWeaponDamageType[]
}
