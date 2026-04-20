import type { GimbalModeDefinition } from '../types'

export const GIMBAL_MODES: GimbalModeDefinition[] = [
  {
    id: 'AM',
    label: 'Auto Manual',
    tagline: 'System-assisted tracking within the gimbal cone',
    behaviorProfile: [
      'Uses gimbal cone assistance, attempts to automatically track and find a solution on target.',
      'Forgives small pilot and gunner micro-adjustments without demanding constant pip correction.',
      'Reduces workload during sustained tracking, especially when the turret crew is also managing callouts or component focus.',
  
    ],
    bestUse: [
      'Capital work where component tracking matters more than maximum manual precision.',
    ],
    strengths: [
      'Low mental load combat, promoting situaional awareness.',
      'Strong tracking continuity against slow targets.',
    ],
    tradeoffs: [
      'The cone can be defeated by hard lateral movement, offset vectors, or range extension.',
      'Target switching can be annoying, AM takes additional time to acquire solutions.',
      'Extremely weak against agile targets.',
    ],
    switchWhen: [
      'Switch to PM when the target repeatedly outranges the cone or forces offset lead.',
      'Switch to PM when component saturation matters more than precision firing while holding.',
    ],
    exampleTargets: [
      'Capital ships',
      'Large ships',
    ],
  },
  {
    id: 'PM',
    label: 'Precision Manual',
    tagline: 'Full manual pip placement with no tracking assist',
    behaviorProfile: [
      'Places the crosshair fully under gunner control with no tracking assist or cone correction.',
      'Handles agile, offset, or harder-to-hold targets better.',
    ],
    bestUse: [
      'All scenarios.',
    ],
    strengths: [
      'Highest control over pip placement and lead.',
      'Better answer for fast, angular, or evasive movement.',
      'Strong precision ceiling for experienced gunners.',
    ],
    tradeoffs: [
      'No automatic correction for pilot movement, turret drift, or bad lead.',
      'Can underperform AM when the target is slow and pilot control requires multiple small boosted inputs.',
    ],
    switchWhen: [
      'Engaging capitals in rate-locks.',
    ],
    exampleTargets: [
      'Light fighters',
      'Fast heavy fighters',
      'Offset or kiting targets',
      'Components at range',
    ],
  },
]
