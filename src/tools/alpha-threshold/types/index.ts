export type ShipSizeGroup =
  | 'capital'
  | 'large'
  | 'medium'
  | 'small'

export type DefenseDamageChannel = 'physical' | 'energy'
export type DefenseShieldState = 'up' | 'down'

export type DamageRange = {
  min: number
  max: number
}

export type ShipDefenseProfile = {
  id: string
  name: string
  source: 'live' | 'ptu'
  armor: {
    hp: number
    physical: {
      damageMultiplier: number
      deflectionThreshold: number
    }
    energy: {
      damageMultiplier: number
      deflectionThreshold: number
    }
  }
  hull: {
    hp: number
    physical: { damageMultiplier: number }
    energy: { damageMultiplier: number }
  }
  shields: {
    count: number
    size: number | number[]
    installedShieldIds: readonly string[]
    installedShieldNames: readonly string[]
    installedShieldClass?: readonly string[]
    hasBespokeShield: boolean
    rawShieldRecords: readonly string[]
    physical: {
      resistance: DamageRange
      absorption: DamageRange
    }
    energy: {
      resistance: DamageRange
      absorption: DamageRange
    }
    distortion?: {
      resistance: DamageRange
      absorption: DamageRange
    }
    passThrough: {
      physical: DamageRange
      energy: DamageRange
    }
  }
  observedBreakpoints?: Record<string, {
    shieldsDown?: {
      source?: 'observed' | 'estimated'
      damagesFreshArmor?: boolean
      armorDamageStartsAtPercent?: number | null
      estimatedArmorOnsetBand?: readonly [number, number] | null
      notes?: readonly string[]
    }
    shieldsUp?: {
      source?: 'observed' | 'estimated'
      damagesFreshArmor?: boolean
      armorDamageStartsAtPercent?: number | null
      estimatedArmorOnsetBand?: readonly [number, number] | null
      notes?: readonly string[]
    }
  }>
}

export type ArmorInteractionEstimate = {
  damageChannel: DefenseDamageChannel
  shieldState: DefenseShieldState
  armorDamageMultiplier: number
  shieldPassThrough: number
  effectiveArmorAlpha: number
  deflectionThreshold: number
  thresholdRatio: number
  damagesFreshArmor: boolean
  armorDamageStartsAtPercent: number | null
  armorDamageStartsAtPercentSource:
    | 'observed'
    | 'estimated'
    | 'threshold'
    | 'none'
  estimatedArmorOnsetBand?: readonly [number, number] | null
  confidence: 'low' | 'medium' | 'high'
  notes?: string[]
}

export type Ship = {
  id: string
  manufacturer: string
  name: string
  role?: string | null
  career?: string | null
  isGroundVehicle?: boolean
  source?: ThresholdDataSourceKey | 'erkul' | 'spviewer' | 'scunpacked' | 'manual' | 'merged' | 'live' | 'ptu'
  imageSrc?: string
  imageAlt?: string
  scmSpeed?: number | null
  navSpeed?: number | null
  noiseCount?: number | null
  decoyCount?: number | null
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
  defenseProfile?: ShipDefenseProfile
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

export type HardpointRole = 'pilot' | 'turret' | 'weapon'

export type ShipHardpointGroup = {
  id: string
  role: HardpointRole
  label: string
  size: number
  count: number
}

export type AttackerHardpointProfile = {
  shipName: string
  pilotHardpointSize: number | null
  turretHardpointSize: number | null
}

export type WeaponDamageType = 'ballistic' | 'energy' | 'distortion'
export type WeaponThresholdType = Extract<WeaponDamageType, 'ballistic' | 'energy'>
export type ThresholdDataSourceKey =
  | 'merged'
  | 'manual'
  | 'erkul-live'
  | 'erkul-ptu'
  | 'spviewer'
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
  calculatorProfile?: WeaponCalculatorProfile
  source?: WeaponSource
  sourceId?: string
  patch?: string
}

export type WeaponCalculatorProfile = {
  damageChannel: DefenseDamageChannel
  mountCount: number
  baseAlpha: number | null
  effectiveAlpha: number | null
  baseBurstDps: number | null
  effectiveBurstDps: number | null
  projectileSpeed: number | null
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
  hardpointSize: number
  operator: HardpointRole
  weaponKey: string | null
  label?: string
  role?: HardpointRole
  size?: number
  count?: number
}

export type SlotTone = 'cyan' | 'violet' | 'amber' | 'emerald'
export type AxisScaleMode = 'global' | 'by-size' | 'per-row'
export type ArmorStatePercent = 25 | 50 | 75 | 100

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
  effectiveThreshold: number
  margin: number
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
  armorPercent: ArmorStatePercent
}

export type HeatmapTraceStatus =
  | 'always-deflects'
  | 'crosses-late'
  | 'penetrates-early'
  | 'always-penetrates'

export type PenetrationState = 'blocked' | 'threshold' | 'immediate'

export type HeatmapTraceModel = {
  weapon: SelectedWeaponComparison
  matchedDamageType: WeaponThresholdType
  baseThreshold: number
  weaponAlpha: number
  penetrationStartArmorRatio: number
  penetrationStartArmorPercent: number
  penetrationStartX: number
  effectiveThresholdAtCrossover: number
  overUnderDeltaAtFullArmor: number
  alwaysDeflects: boolean
  alwaysPenetrates: boolean
  nearCrossoverBandStart: number
  nearCrossoverBandEnd: number
  status: HeatmapTraceStatus
  penetrationState: PenetrationState
}

export type ShipHeatmapLaneModel = {
  lane: WeaponThresholdType
  label: string
  traces: HeatmapTraceModel[]
  threshold: number
}

export type ShipHeatmapModel = {
  ship: Ship
  lanes: Record<WeaponThresholdType, ShipHeatmapLaneModel>
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
