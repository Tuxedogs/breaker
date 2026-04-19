import {
  AirlockIcon,
  PowerPlantIcon,
  QuantumDriveIcon,
  RadarIcon,
  ShieldGeneratorIcon,
  TurretStationIcon,
} from '../../../../components/icons/DeckMarkerIcons'
import type {
  ComponentPriority,
  ZoneCategory,
  ZoneCategoryGroup,
  ZoneCategoryGroupMeta,
  ZoneCategoryMeta,
  ZoneComponentMeta,
  ZoneType,
} from './types'

export const PRIORITY_LABELS: Record<ComponentPriority, string> = {
  1: 'Primary - Weapons',
  2: 'Secondary - Power Plant',
  3: 'Tertiary - QT Drive',
  4: 'Quaternary - Prio. only when ordered',
  5: 'Navigation - Entry Point',
  6: 'Other - No Immediate Effect',
}

export const ZONE_COMPONENT_META: Record<ZoneType, ZoneComponentMeta> = {
  'power-plant': {
    label: 'Power Plant',
    color: 'var(--component-power)',
    Icon: PowerPlantIcon,
  },
  shield: {
    label: 'Shield Generator',
    color: 'var(--component-shield)',
    Icon: ShieldGeneratorIcon,
  },
  'qt-drive': {
    label: 'Quantum Drive',
    color: 'var(--component-qt)',
    Icon: QuantumDriveIcon,
  },
  radar: {
    label: 'Radar',
    color: 'var(--component-radar)',
    Icon: RadarIcon,
  },
  weapon: {
    label: 'Weapon',
    color: 'var(--component-gun)',
    Icon: TurretStationIcon,
  },
  airlock: {
    label: 'Airlock',
    color: 'var(--component-navigation)',
    Icon: AirlockIcon,
  },
  }

export const ZONE_CATEGORY_GROUP_ORDER: ZoneCategoryGroup[] = ['components', 'externals', 'entry-points']

export const ZONE_CATEGORY_GROUP_META: Record<ZoneCategoryGroup, ZoneCategoryGroupMeta> = {
  components: {
    label: 'Components',
    collapsible: true,
    defaultExpanded: true,
    defaultChecked: true,
  },
  externals: {
    label: 'Externals',
    collapsible: true,
    defaultExpanded: false,
    defaultChecked: false,
  },
  'entry-points': {
    label: 'Entry Points',
    collapsible: false,
    defaultExpanded: false,
    defaultChecked: false,
  },
}

export const ZONE_CATEGORY_ORDER: ZoneCategory[] = [
  'power',
  'shield',
  'qt-drive',
  'radar',
  'main-weapon',
  'pdc',
  'mav-thruster',
  'entry-point',
]

export const ZONE_CATEGORY_META: Record<ZoneCategory, ZoneCategoryMeta> = {
  power: {
    label: 'Power',
    color: 'var(--component-power)',
    group: 'components',
  },
  shield: {
    label: 'Shield',
    color: 'var(--component-shield)',
    group: 'components',
  },
  'qt-drive': {
    label: 'QT Drive',
    color: 'var(--component-qt)',
    group: 'components',
  },
  radar: {
    label: 'Radar',
    color: 'var(--component-radar)',
    group: 'components',
  },
  'main-weapon': {
    label: 'Main Weapons',
    color: 'var(--component-gun)',
    group: 'externals',
  },
  pdc: {
    label: 'PDC',
    color: 'var(--component-gun)',
    group: 'externals',
  },
  'mav-thruster': {
    label: 'MAV Thrusters',
    color: 'var(--component-navigation)',
    group: 'externals',
  },
  'entry-point': {
    label: 'Entry Points',
    color: 'var(--component-navigation)',
    group: 'entry-points',
  },
}
