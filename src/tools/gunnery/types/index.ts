export type GimbalMode = 'AM' | 'PM' | 'Fixed'
export type OperatorType = 'heavy-fighter' | 'medium-fighter' | 'gunship' | 'capital-gunner'
export type TargetType = 'capital' | 'medium' | 'small'
export type Range = 'close' | 'mid' | 'far'
export type TargetSpeed = 'slow' | 'medium' | 'fast'
export type GunnerySection = 'mode-recommender' | 'scenarios' | 'sub-targeting' | 'diagnosis'

export type ModeRecommendation = {
  mode: GimbalMode
  confidence: 'strong' | 'moderate'
  reasoning: string
}

// ── Mode reference data ──────────────────────────────────────────────────────

export type GimbalModeDefinition = {
  id: GimbalMode
  label: string
  tagline: string
  strengths: string[]
  weaknesses: string[]
  bestFor: string
}

// ── Scenarios ────────────────────────────────────────────────────────────────

export type Scenario = {
  id: string
  label: string
  description: string
  targetType: TargetType
  range: Range
  speed: TargetSpeed
  recommendedMode: GimbalMode
  keyRules: string[]
  emphasis: string
}

// ── Sub-targeting ────────────────────────────────────────────────────────────

export type ComponentPriority = 1 | 2 | 3 | 4

// wPx/hPx override the % w/h when set — useful for fixed-size hit zones on flexible containers
export type ZonePosition = { x: number; y: number; w: number; h: number; wPx?: number; hPx?: number }

// Views are data-driven per ship — no fixed union.
// Each ship declares its own ordered view list.
export type ShipViewDef = {
  id: string    // used as key in views and zone positions
  label: string // displayed in the view selector
}

export type ComponentZone = {
  id: string
  label: string
  shortLabel?: string  // short label shown on the zone button (e.g. "P1"); full label used in result panel
  groupId?: string     // zones sharing a groupId are connected by lines when any one is active
  priority: ComponentPriority
  color: string   // CSS var, e.g. 'var(--component-power)'
  effect: string
  // Keyed by view id. A zone only renders in views where a position is defined.
  positions: Record<string, ZonePosition>
}

export type SubTargetShip = {
  id: string
  label: string
  class: 'capital' | 'medium' | 'small'
  viewDefs: ShipViewDef[]          // ordered — first entry is the default view
  views: Record<string, string>    // view id → image path (relative to /public)
  zones: ComponentZone[]
}

// ── Diagnosis ────────────────────────────────────────────────────────────────

export type DiagnosisEntry = {
  id: string
  symptom: string
  cause: string
  correction: string
  relatedMode: GimbalMode | null
}

// ── Visual toggles ───────────────────────────────────────────────────────────

export type VisualToggles = {
  showGimbalCone: boolean
  showCrosshairDrift: boolean
  showTargetMovement: boolean
}
