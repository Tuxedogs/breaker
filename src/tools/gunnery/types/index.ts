export type GimbalMode = 'AM' | 'PM'
export type GunnerySection = 'mode-recommender' | 'sub-targeting' | 'diagnosis' | 'ground-school'

export type GimbalModeDefinition = {
  id: GimbalMode
  label: string
  tagline: string
  behaviorProfile: string[]
  bestUse: string[]
  strengths: string[]
  tradeoffs: string[]
  switchWhen: string[]
  exampleTargets: string[]
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
