import { parseManualShipDump } from '../../lib/ships/adapters/manual'
import type { ShipSizeGroup } from '../../types'

export function buildManualShipSeedsFromDump(
  rawDump: string,
  sizeGroup: ShipSizeGroup,
  patch = '4.7 PTU'
) {
  return parseManualShipDump(rawDump, sizeGroup, patch)
}
