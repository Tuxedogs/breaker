import type { GimbalModeDefinition } from '../types'

export const GIMBAL_MODES: GimbalModeDefinition[] = [
  {
    id: 'AM',
    label: 'Auto Manual',
    tagline: 'System-assisted tracking within the gimbal cone',
    strengths: [
      'Auto-corrects for pilot micro-inputs',
      'Easily maintains lock on slow capital components',
      'Low mental load for most engagements',
    ],
    weaknesses: [
      'Cone desync on fast or evasive targets',
      'Easy to defend against inexperienced gunners',
      'Ineffective beyond mid-range(800m) on moving targets',
    ],
    bestFor: 'Capital ships, close range, slow-moving targets',
  },
  {
    id: 'PM',
    label: 'Precision Manual',
    tagline: 'Full manual crosshair — you control the lead',
    strengths: [
      'Almost exact placement on any target',
      'Subtarget to change pip location',
      'Effective at most normal ranges and target speeds',
    ],
    weaknesses: [
      'Requires active lead and strafe calculation',
      'Higher skill floor for fast or kiting targets',
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
      'Locked to turret rotation rates',
      'Extremely limited firing arc',
      'Not recommended for most engagements',
    ],
    bestFor: 'Rarely — only if ROF margin is meaningful for your loadout',
  },
]
