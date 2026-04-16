export type GimbalMode = 'AM' | 'PM' | 'Fixed'
export type WeaponType = 'cf-repeaters' | 'ndb' | 'medusa'
export type TargetType = 'fighter' | 'heavy-fighter' | 'large' | 'capital'
export type Range = 'close' | 'mid' | 'far'
export type TargetSpeed = 'slow' | 'medium' | 'fast'
export type GunnerySection = 'mode-recommender' | 'sub-targeting' | 'diagnosis'

export type ModeRecommendation = {
  mode: GimbalMode
  confidence: 'strong' | 'moderate'
  reasoning: string
}

export type GimbalModeDefinition = {
  id: GimbalMode
  label: string
  tagline: string
  strengths: string[]
  weaknesses: string[]
  bestFor: string
}

export type {
  ComponentPriority,
  ComponentSize,
  NormalizedShipDefinition,
  NormalizedShipZone,
  ShipDefinition,
  ShipValidationIssue,
  ShipViewTab,
  ViewId,
  ZoneComponentMeta,
  ZonePosition,
  ZoneType,
} from '../data/subtarget-ships/types'

export type { ShipZone } from '../data/subtarget-ships/types'

export type ComponentZone = import('../data/subtarget-ships/types').NormalizedShipZone
export type SubTargetShip = import('../data/subtarget-ships/types').NormalizedShipDefinition

export type DiagnosisEntry = {
  id: string
  symptom: string
  cause: string
  correction: string
  relatedMode: GimbalMode | null
}

export type VisualToggles = {
  showGimbalCone: boolean
  showCrosshairDrift: boolean
  showTargetMovement: boolean
}
