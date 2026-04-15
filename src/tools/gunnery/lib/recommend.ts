import type { GimbalMode, ModeRecommendation, Range, TargetSpeed, TargetType, WeaponType } from '../types'

const MATRIX: Record<string, GimbalMode> = {
  'cf-repeaters-fighter-close-fast': 'AM',
  'cf-repeaters-fighter-mid-fast': 'AM',
  'cf-repeaters-fighter-far-fast': 'PM',
  'cf-repeaters-fighter-close-medium': 'AM',
  'cf-repeaters-fighter-mid-medium': 'AM',
  'cf-repeaters-fighter-far-medium': 'PM',
  'cf-repeaters-fighter-close-slow': 'AM',
  'cf-repeaters-fighter-mid-slow': 'AM',
  'cf-repeaters-fighter-far-slow': 'AM',
  'cf-repeaters-heavy-fighter-close-fast': 'AM',
  'cf-repeaters-heavy-fighter-mid-fast': 'AM',
  'cf-repeaters-heavy-fighter-far-fast': 'PM',
  'cf-repeaters-heavy-fighter-close-medium': 'AM',
  'cf-repeaters-heavy-fighter-mid-medium': 'AM',
  'cf-repeaters-heavy-fighter-far-medium': 'PM',
  'cf-repeaters-heavy-fighter-close-slow': 'AM',
  'cf-repeaters-heavy-fighter-mid-slow': 'AM',
  'cf-repeaters-heavy-fighter-far-slow': 'AM',
  'cf-repeaters-large-close-fast': 'AM',
  'cf-repeaters-large-mid-fast': 'AM',
  'cf-repeaters-large-far-fast': 'AM',
  'cf-repeaters-large-close-medium': 'AM',
  'cf-repeaters-large-mid-medium': 'AM',
  'cf-repeaters-large-far-medium': 'AM',
  'cf-repeaters-large-close-slow': 'AM',
  'cf-repeaters-large-mid-slow': 'AM',
  'cf-repeaters-large-far-slow': 'AM',

  'ndb-fighter-close-fast': 'AM',
  'ndb-fighter-mid-fast': 'PM',
  'ndb-fighter-far-fast': 'PM',
  'ndb-fighter-close-medium': 'AM',
  'ndb-fighter-mid-medium': 'PM',
  'ndb-fighter-far-medium': 'PM',
  'ndb-fighter-close-slow': 'AM',
  'ndb-fighter-mid-slow': 'PM',
  'ndb-fighter-far-slow': 'PM',
  'ndb-heavy-fighter-close-fast': 'AM',
  'ndb-heavy-fighter-mid-fast': 'AM',
  'ndb-heavy-fighter-far-fast': 'PM',
  'ndb-heavy-fighter-close-medium': 'AM',
  'ndb-heavy-fighter-mid-medium': 'AM',
  'ndb-heavy-fighter-far-medium': 'PM',
  'ndb-heavy-fighter-close-slow': 'AM',
  'ndb-heavy-fighter-mid-slow': 'AM',
  'ndb-heavy-fighter-far-slow': 'PM',
  'ndb-large-close-fast': 'AM',
  'ndb-large-mid-fast': 'AM',
  'ndb-large-far-fast': 'AM',
  'ndb-large-close-medium': 'AM',
  'ndb-large-mid-medium': 'AM',
  'ndb-large-far-medium': 'AM',
  'ndb-large-close-slow': 'AM',
  'ndb-large-mid-slow': 'AM',
  'ndb-large-far-slow': 'AM',

  'medusa-fighter-close-fast': 'PM',
  'medusa-fighter-mid-fast': 'PM',
  'medusa-fighter-far-fast': 'PM',
  'medusa-fighter-close-medium': 'PM',
  'medusa-fighter-mid-medium': 'PM',
  'medusa-fighter-far-medium': 'PM',
  'medusa-fighter-close-slow': 'PM',
  'medusa-fighter-mid-slow': 'PM',
  'medusa-fighter-far-slow': 'PM',
  'medusa-large-close-fast': 'AM',
  'medusa-large-mid-fast': 'PM',
  'medusa-large-far-fast': 'PM',
  'medusa-large-close-medium': 'AM',
  'medusa-large-mid-medium': 'PM',
  'medusa-large-far-medium': 'PM',
  'medusa-large-close-slow': 'AM',
  'medusa-large-mid-slow': 'PM',
  'medusa-large-far-slow': 'PM',
  'medusa-capital-close-fast': 'AM',
  'medusa-capital-mid-fast': 'AM',
  'medusa-capital-far-fast': 'PM',
  'medusa-capital-close-medium': 'AM',
  'medusa-capital-mid-medium': 'AM',
  'medusa-capital-far-medium': 'PM',
  'medusa-capital-close-slow': 'AM',
  'medusa-capital-mid-slow': 'AM',
  'medusa-capital-far-slow': 'PM',
}

const WEAPON_LABELS: Record<WeaponType, string> = {
  'cf-repeaters': 'CF Repeaters',
  ndb: 'NDBs',
  medusa: 'Medusa',
}

const TARGET_LABELS: Record<TargetType, string> = {
  fighter: 'Fighter',
  'heavy-fighter': 'Heavy Fighter',
  large: 'Large',
  capital: 'Capital',
}

const RANGE_LABELS: Record<Range, string> = {
  close: 'Close',
  mid: 'Mid',
  far: 'Far',
}

const SPEED_LABELS: Record<TargetSpeed, string> = {
  slow: 'Slow',
  medium: 'Medium',
  fast: 'Fast',
}

export function recommendMode(
  weaponType: WeaponType,
  targetType: TargetType,
  range: Range,
  speed: TargetSpeed,
): ModeRecommendation {
  const key = `${weaponType}-${targetType}-${range}-${speed}`
  const mode = MATRIX[key] ?? 'PM'

  return {
    mode,
    confidence: 'strong',
    reasoning: `${WEAPON_LABELS[weaponType]} vs ${TARGET_LABELS[targetType]} at ${RANGE_LABELS[range]} range against a ${SPEED_LABELS[speed].toLowerCase()} target resolves to ${mode}.`,
  }
}
