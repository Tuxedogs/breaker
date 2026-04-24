export type PresetMetadata = {
  description?: string
  source?: string
  version?: string
}

export type ShipPresetEntry = {
  shipId?: string
  selectionKey?: string
  manufacturer?: string
  name?: string
}

export type WeaponPresetEntry = {
  weaponId?: string
  weaponKey?: string
  name?: string
  size?: number
  damageType?: 'ballistic' | 'energy'
}

export type ShipPresetDefinition = {
  id: string
  name: string
  category?: string
  hidden?: boolean
  metadata?: PresetMetadata
  entries: ShipPresetEntry[]
}

export type WeaponSizePresetDefinition = {
  id: string
  name: string
  category?: string
  metadata?: PresetMetadata
  sizes: number[]
}

export type WeaponPresetFilter = {
  damageType: 'ballistic' | 'energy'
  weaponClass: string
}

export type WeaponPresetDefinition = {
  id: string
  name: string
  category?: string
  metadata?: PresetMetadata
  sizePresetIds?: string[]
  entries?: WeaponPresetEntry[]
  filter?: WeaponPresetFilter
}

export const SHIP_PRESETS: ShipPresetDefinition[] = [
  {
    id: 'pu-mix',
    name: 'PU MIX',
    category: 'Targets',
    metadata: {
      description: 'Mixed PU presentation spread retained as the default opening target pack.',
      source: 'moonbreaker',
      version: '2.0',
    },
    entries: [
      { manufacturer: 'ANVL', name: 'Arrow' },
      { manufacturer: 'ANVL', name: 'F7A_Hornet_Mk_II' },
      { manufacturer: 'ANVL', name: 'F8C_Lightning' },
      { manufacturer: 'CRUS', name: 'A2_Hercules_Starlifter' },
      { manufacturer: 'RSI', name: 'Perseus' },
      { manufacturer: 'AEGS', name: 'Idris_M' },
    ],
  },
  {
    id: 'fighter',
    name: 'Fighter',
    category: 'Targets',
    metadata: {
      description: 'Fighter target spread for quick comparison passes.',
      source: 'moonbreaker',
      version: '2.0',
    },
    entries: [
      { manufacturer: 'ANVL', name: 'Arrow' },
      { manufacturer: 'ANVL', name: 'F7A_Hornet_Mk_II' },
      { manufacturer: 'RSI', name: 'Scorpius' },
      { manufacturer: 'ANVL', name: 'F8C_Lightning' },
      { manufacturer: 'MRAI', name: 'Guardian_MX' },
    ],
  },
  {
    id: 'mid-size',
    name: 'Mid Size',
    category: 'Targets',
    metadata: {
      description: 'Mid-size target spread for mixed-role hull checks.',
      source: 'moonbreaker',
      version: '2.0',
    },
    entries: [
      { manufacturer: 'DRAK', name: 'Cutlass_Black' },
      { manufacturer: 'ESPR', name: 'Prowler' },
      { manufacturer: 'MISC', name: 'Freelancer_MIS' },
      { manufacturer: 'ANVL', name: 'Terrapin_Medic' },
    ],
  },
  {
    id: 'large',
    name: 'Large',
    category: 'Targets',
    metadata: {
      description: 'Large target spread for heavy gunship and gunboat checks.',
      source: 'moonbreaker',
      version: '2.0',
    },
    entries: [
      { manufacturer: 'DRAK', name: 'Corsair' },
      { manufacturer: 'ANVL', name: 'Paladin' },
      { manufacturer: 'MISC', name: 'Starlancer_TAC' },
      { manufacturer: 'RSI', name: 'Perseus' },
    ],
  },
  {
    id: 'industrial',
    name: 'Industrial',
    category: 'Targets',
    metadata: {
      description: 'Industrial and freight target spread.',
      source: 'moonbreaker',
      version: '2.0',
    },
    entries: [
      { manufacturer: 'MISC', name: 'Prospector' },
      { manufacturer: 'ARGO', name: 'MOLE' },
      { manufacturer: 'MISC', name: 'Hull_B' },
      { manufacturer: 'CRUS', name: 'C2_Hercules_Starlifter' },
      { manufacturer: 'AEGS', name: 'Reclaimer' },
    ],
  },
]

export const WEAPON_SIZE_PRESETS: WeaponSizePresetDefinition[] = [
  {
    id: 'size-1-3',
    name: '1-3',
    category: 'Weapons',
    metadata: {
      description: 'Size 1 through size 3 weapons.',
      source: 'moonbreaker',
      version: '2.0',
    },
    sizes: [1, 2, 3],
  },
  {
    id: 'size-3-4',
    name: '3-4',
    category: 'Weapons',
    metadata: {
      description: 'Size 3 through size 4 weapons.',
      source: 'moonbreaker',
      version: '2.0',
    },
    sizes: [3, 4],
  },
  {
    id: 'size-5',
    name: '5',
    category: 'Weapons',
    metadata: {
      description: 'Size 5 weapons.',
      source: 'moonbreaker',
      version: '2.0',
    },
    sizes: [5],
  },
]

export const WEAPON_PRESETS: WeaponPresetDefinition[] = [
  {
    id: 'energy-repeater',
    name: 'Energy Repeater',
    category: 'Weapons',
    sizePresetIds: WEAPON_SIZE_PRESETS.map((preset) => preset.id),
    metadata: {
      description: 'Energy repeater families for the selected size range.',
      source: 'moonbreaker',
      version: '2.0',
    },
    filter: {
      damageType: 'energy',
      weaponClass: 'laser repeater',
    },
  },
  {
    id: 'energy-cannon',
    name: 'Energy Cannon',
    category: 'Weapons',
    sizePresetIds: WEAPON_SIZE_PRESETS.map((preset) => preset.id),
    metadata: {
      description: 'Energy cannon families for the selected size range.',
      source: 'moonbreaker',
      version: '2.0',
    },
    filter: {
      damageType: 'energy',
      weaponClass: 'laser cannon',
    },
  },
  {
    id: 'ballistic-repeater',
    name: 'Ballistic Repeater',
    category: 'Weapons',
    sizePresetIds: WEAPON_SIZE_PRESETS.map((preset) => preset.id),
    metadata: {
      description: 'Ballistic repeater families for the selected size range.',
      source: 'moonbreaker',
      version: '2.0',
    },
    filter: {
      damageType: 'ballistic',
      weaponClass: 'ballistic repeater',
    },
  },
  {
    id: 'ballistic-cannon',
    name: 'Ballistic Cannon',
    category: 'Weapons',
    sizePresetIds: WEAPON_SIZE_PRESETS.map((preset) => preset.id),
    metadata: {
      description: 'Ballistic cannon families for the selected size range.',
      source: 'moonbreaker',
      version: '2.0',
    },
    filter: {
      damageType: 'ballistic',
      weaponClass: 'ballistic cannon',
    },
  },
  {
    id: 'ballistic-gatling',
    name: 'Ballistic Gatling',
    category: 'Weapons',
    sizePresetIds: WEAPON_SIZE_PRESETS.map((preset) => preset.id),
    metadata: {
      description: 'Ballistic gatling families for the selected size range.',
      source: 'moonbreaker',
      version: '2.0',
    },
    filter: {
      damageType: 'ballistic',
      weaponClass: 'ballistic gatling',
    },
  },
]
