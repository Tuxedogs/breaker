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

export type ComponentPriority = 1 | 2 | 3 | 4 | 5 | 6
export type ZonePosition = {
  // Normalized to the specific source image for that view, in the 0-1 range.
  x: number
  y: number
  w: number
  h: number
  wPx?: number
  hPx?: number
}

export type ShipViewDef = {
  id: string
  label: string
}

export type ComponentZone = {
  id: string
  label: string
  shortLabel?: string
  groupId?: string
  priority: ComponentPriority
  color: string
  effect: string
  positions: Record<string, ZonePosition>
}

export type SubTargetShip = {
  id: string
  label: string
  class: 'capital' | 'medium' | 'small'
  viewDefs: ShipViewDef[]
  views: Record<string, string>
  zones: ComponentZone[]
}

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
