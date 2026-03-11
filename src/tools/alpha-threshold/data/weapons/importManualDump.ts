import { parseManualWeaponDump } from '../../lib/weapons/adapters/manual'

export function buildManualWeaponSeedsFromDump(rawDump: string) {
  return parseManualWeaponDump(rawDump, '4.7 PTU')
}
