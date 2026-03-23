import type { DefenseShieldState } from '../types'

export const DEFAULT_SHIELD_MODE: DefenseShieldState = 'up'

export function parseShieldMode(value: string | null | undefined): DefenseShieldState {
  return value === 'down' ? 'down' : DEFAULT_SHIELD_MODE
}
