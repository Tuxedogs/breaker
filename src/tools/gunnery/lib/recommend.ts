import type { GimbalMode, ModeRecommendation, OperatorType, TargetType, Range, TargetSpeed } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// RECOMMENDATION MATRIX
//
// Key format: `${operatorType}-${targetType}-${range}-${speed}`
// Value:       'AM' | 'PM' | 'Fixed'
//
// To change any recommendation → edit the value on that line.
// To add a new operator type   → add 27 lines with that type as the prefix.
// ─────────────────────────────────────────────────────────────────────────────

const MATRIX: Record<string, GimbalMode> = {

  // ── Heavy Fighter ─────────────────────────────────────────────────────────
  // Close range: always AM regardless of target size or speed
  // Mid range:   AM for slow; PM for medium/fast on small targets; AM otherwise
  // Far range:   PM across the board
  'heavy-fighter-capital-close-slow':    'AM',
  'heavy-fighter-capital-close-medium':  'AM',
  'heavy-fighter-capital-close-fast':    'AM',
  'heavy-fighter-capital-mid-slow':      'AM',
  'heavy-fighter-capital-mid-medium':    'AM',
  'heavy-fighter-capital-mid-fast':      'PM',
  'heavy-fighter-capital-far-slow':      'PM',
  'heavy-fighter-capital-far-medium':    'PM',
  'heavy-fighter-capital-far-fast':      'PM',

  'heavy-fighter-medium-close-slow':     'AM',
  'heavy-fighter-medium-close-medium':   'AM',
  'heavy-fighter-medium-close-fast':     'AM',
  'heavy-fighter-medium-mid-slow':       'AM',
  'heavy-fighter-medium-mid-medium':     'AM',
  'heavy-fighter-medium-mid-fast':       'PM',
  'heavy-fighter-medium-far-slow':       'PM',
  'heavy-fighter-medium-far-medium':     'PM',
  'heavy-fighter-medium-far-fast':       'PM',

  'heavy-fighter-small-close-slow':      'AM',
  'heavy-fighter-small-close-medium':    'AM',
  'heavy-fighter-small-close-fast':      'AM',
  'heavy-fighter-small-mid-slow':        'AM',
  'heavy-fighter-small-mid-medium':      'PM',
  'heavy-fighter-small-mid-fast':        'PM',
  'heavy-fighter-small-far-slow':        'PM',
  'heavy-fighter-small-far-medium':      'PM',
  'heavy-fighter-small-far-fast':        'PM',

  // ── Medium Fighter ────────────────────────────────────────────────────────
  // Placeholder — fill in when ready
  // 'medium-fighter-capital-close-slow': 'AM',
  // ...

  // ── Gunship ───────────────────────────────────────────────────────────────
  // Placeholder — fill in when ready
  // 'gunship-capital-close-slow': 'AM',
  // ...

  // ── Capital Gunner ────────────────────────────────────────────────────────
  // Placeholder — fill in when ready
  // 'capital-gunner-capital-close-slow': 'AM',
  // ...
}

// ─────────────────────────────────────────────────────────────────────────────
// STRONG-CONFIDENCE KEYS
// Add a key here once you are certain of the recommendation.
// Everything else is reported as 'moderate' confidence.
// ─────────────────────────────────────────────────────────────────────────────

const STRONG_KEYS = new Set([
  'heavy-fighter-capital-close-slow',
  'heavy-fighter-capital-close-medium',
  'heavy-fighter-medium-close-slow',
  'heavy-fighter-medium-close-medium',
  'heavy-fighter-small-close-slow',
  'heavy-fighter-small-close-medium',
  'heavy-fighter-small-close-fast',
  'heavy-fighter-small-mid-medium',
  'heavy-fighter-small-mid-fast',
])

// ─────────────────────────────────────────────────────────────────────────────
// REASONING STRINGS
// Key matches the matrix key exactly.
// If a key has no entry here, a generic fallback is used.
// ─────────────────────────────────────────────────────────────────────────────

const REASONING: Record<string, string> = {
  // Heavy fighter — capital targets
  'heavy-fighter-capital-close-slow':
    'Large, slow capital at close range. AM auto-correction handles component tracking — no manual lead needed from a heavy fighter platform.',
  'heavy-fighter-capital-close-medium':
    'Capital moving at moderate speed. Still inside effective AM range from a heavy fighter — let the gimbal work.',
  'heavy-fighter-capital-close-fast':
    'Fast capital at close range. AM remains effective — proximity keeps the cone centered despite target speed.',
  'heavy-fighter-capital-mid-slow':
    'Mid-range capital, slow. AM handles the angular velocity at this distance from a heavy fighter.',
  'heavy-fighter-capital-mid-medium':
    'Mid-range capital at moderate speed. AM still within envelope — monitor and switch to PM if tracking starts slipping.',
  'heavy-fighter-capital-mid-fast':
    'Fast capital at mid range. Target speed is breaking the AM cone — switch to PM and manually lead.',
  'heavy-fighter-capital-far-slow':
    'Long range reduces AM effectiveness. Use PM with careful lead even on a slow capital.',
  'heavy-fighter-capital-far-medium':
    'PM required at this range. Lead significantly ahead of the capital\'s vector.',
  'heavy-fighter-capital-far-fast':
    'PM only. Long range plus speed — AM is ineffective. Commit to manual lead.',

  // Heavy fighter — medium targets
  'heavy-fighter-medium-close-slow':
    'Slow medium target close in. AM tracks cleanly from a heavy fighter at this range.',
  'heavy-fighter-medium-close-medium':
    'Medium speed, close range. AM handles this from a heavy fighter — still within correction envelope.',
  'heavy-fighter-medium-close-fast':
    'Fast medium at close range. AM still recommended — proximity is the deciding factor here.',
  'heavy-fighter-medium-mid-slow':
    'Mid-range medium, slow. AM manages the angular offset at this range and speed.',
  'heavy-fighter-medium-mid-medium':
    'Mid-range medium at moderate speed. AM is on the edge — acceptable from a heavy fighter but monitor drift.',
  'heavy-fighter-medium-mid-fast':
    'Fast medium at mid range. AM cone desync likely — switch to PM for manual lead.',
  'heavy-fighter-medium-far-slow':
    'Far range reduces AM to near-useless regardless of speed. PM required.',
  'heavy-fighter-medium-far-medium':
    'PM at this range. Lead the medium target based on projectile travel time.',
  'heavy-fighter-medium-far-fast':
    'PM hard. Fast medium at far range — high lead required, burst fire to walk shots in.',

  // Heavy fighter — small targets
  'heavy-fighter-small-close-slow':
    'Slow small target at close range. AM can track from a heavy fighter — target speed is low enough.',
  'heavy-fighter-small-close-medium':
    'Close range keeps AM viable even on a small target at medium speed.',
  'heavy-fighter-small-close-fast':
    'Fast small at close range. AM still holds — proximity compensates for target speed.',
  'heavy-fighter-small-mid-slow':
    'Mid-range small target, slow. AM manages this from a heavy fighter.',
  'heavy-fighter-small-mid-medium':
    'Small target at mid range with medium speed — AM cone starts losing the track. Switch to PM for direct crosshair control.',
  'heavy-fighter-small-mid-fast':
    'Fast small at mid range. PM required — AM will not keep up with the angular velocity.',
  'heavy-fighter-small-far-slow':
    'Far range, small target. PM only — AM is not effective at this distance regardless of speed.',
  'heavy-fighter-small-far-medium':
    'PM. Far range small target — patience and significant lead required.',
  'heavy-fighter-small-far-fast':
    'PM hard. Fast small target at far range — near-maximum difficulty shot. Consider repositioning.',
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT FALLBACK
// Used when an operator type has no matrix entry yet.
// Applies baseline logic: capital/close → AM, everything else → PM.
// ─────────────────────────────────────────────────────────────────────────────

function defaultMode(targetType: TargetType, range: Range, speed: TargetSpeed): GimbalMode {
  if (targetType === 'capital' && range === 'close') return 'AM'
  if (targetType === 'capital' && range === 'mid' && speed !== 'fast') return 'AM'
  return 'PM'
}

// ─────────────────────────────────────────────────────────────────────────────

export function recommendMode(
  operatorType: OperatorType,
  targetType: TargetType,
  range: Range,
  speed: TargetSpeed,
): ModeRecommendation {
  const key = `${operatorType}-${targetType}-${range}-${speed}`
  const inMatrix = key in MATRIX
  const mode = inMatrix ? MATRIX[key] : defaultMode(targetType, range, speed)
  const confidence = STRONG_KEYS.has(key) ? 'strong' : 'moderate'
  const reasoning = REASONING[key] ?? `Use ${mode} for this combination.`

  return { mode, confidence, reasoning }
}
