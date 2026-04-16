import { idris } from './idris'
import { normalizeShipDefinitions } from './normalizeShips'
import { perseus } from './perseus'
import type { ShipDefinition } from './types'
import { validateShipDefinitions } from './validateShips'

export const SHIP_DEFINITIONS: ShipDefinition[] = [perseus, idris]

export const SHIP_VALIDATION_ISSUES = validateShipDefinitions(SHIP_DEFINITIONS)

export const SHIPS = normalizeShipDefinitions(SHIP_DEFINITIONS, SHIP_VALIDATION_ISSUES)

export { PRIORITY_LABELS, ZONE_COMPONENT_META } from './componentMeta'
export { validateShipDefinitions } from './validateShips'
export { normalizeShipDefinitions } from './normalizeShips'
