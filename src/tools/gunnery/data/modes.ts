import type { GimbalModeDefinition } from '../types'

export const GIMBAL_MODES: GimbalModeDefinition[] = [
  {
    id: 'AM',
    label: 'Auto Manual',
    tagline: 'System-assisted tracking within the gimbal cone',
    strengths: [
      'Auto-corrects for pilot micro-inputs',
      'Maintains lock on slow capital components',
      'Low mental load — focus on positioning',
    ],
    weaknesses: [
      'Cone desync on fast or evasive targets',
      'Pilot inputs immediately shift cone center',
      'Ineffective beyond mid-range on moving targets',
    ],
    bestFor: 'Capital ships, close range, slow-moving targets',
  },
  {
    id: 'PM',
    label: 'Precision Manual',
    tagline: 'Full manual crosshair — you control the lead',
    strengths: [
      'Exact placement on any target',
      'Subtarget pip tracks your aim directly',
      'Effective at all ranges and target speeds',
    ],
    weaknesses: [
      'Requires active lead compensation',
      'Higher skill floor for fast targets',
      'No auto-correction — every miss is yours',
    ],
    bestFor: 'Fast, small, or dynamic targets at any range',
  },
  {
    id: 'Fixed',
    label: 'Fixed',
    tagline: 'No gimbal — minor ROF gain only',
    strengths: [
      'Slight rate of fire increase',
    ],
    weaknesses: [
      'No gimbal cone offset',
      'Extremely limited firing arc',
      'Not recommended for most engagements',
    ],
    bestFor: 'Rarely — only if ROF margin is meaningful for your loadout',
  },
]
