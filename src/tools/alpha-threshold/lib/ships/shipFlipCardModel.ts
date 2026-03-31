import { formatMetric } from '../calculations'
import type { Ship } from '../../types'

function formatStat(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return formatMetric(value)
}

function formatSpeedMps(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${formatMetric(value)} m/s`
}

/**
 * Maps a Ship (and optional shipDetails.flight) into labels for the matrix flip card.
 */
export function buildShipFlipCardModel(ship: Ship) {
  const flight = ship.shipDetails?.flight

  return {
    energyThreshold: formatStat(ship.energyThreshold),
    ballisticThreshold: formatStat(ship.ballisticThreshold),
    armor: formatStat(ship.armorHp),
    hull: formatStat(ship.vitalHp),
    scmForward: formatSpeedMps(flight?.scmSpeed ?? ship.scmSpeed ?? null),
    navSpeed: formatSpeedMps(flight?.navSpeed ?? ship.navSpeed ?? null),
    boostForward: formatSpeedMps(flight?.boostSpeedForward ?? null),
    pitch: formatStat(flight?.pitch ?? null),
    yaw: formatStat(flight?.yaw ?? null),
    roll: formatStat(flight?.roll ?? null),
    boostPitch: formatStat(flight?.boostPitch ?? null),
    boostYaw: formatStat(flight?.boostYaw ?? null),
    boostRoll: formatStat(flight?.boostRoll ?? null),
  }
}
