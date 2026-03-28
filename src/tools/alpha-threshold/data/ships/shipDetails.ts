import { shipCardStats } from './cardStats'
import type { Ship, ShipExtendedDetails, ThresholdDataSourceKey } from '../../types'

type ShipDetailsSeed = Record<string, ShipExtendedDetails>

type ShipDetailsDatasetBySource = Record<ThresholdDataSourceKey, ShipDetailsSeed>

function getShipDetailsLookupKey(ship: Pick<Ship, 'manufacturer' | 'name'>) {
  return `${ship.manufacturer}::${ship.name}`.toLowerCase()
}

function pruneEmptyObject<T extends Record<string, number | string | null | undefined>>(value: T) {
  const entries = Object.entries(value).filter(([, entry]) => entry != null)
  if (entries.length === 0) return undefined
  return Object.fromEntries(entries) as T
}

function buildCardStatDetails(): ShipDetailsSeed {
  return Object.fromEntries(
    Object.entries(shipCardStats).map(([key, value]) => {
      const flight = pruneEmptyObject({
        scmSpeed: value.scmSpeed ?? null,
        navSpeed: value.navSpeed ?? null,
      })
      const countermeasures = pruneEmptyObject({
        noiseCount: value.noiseCount ?? null,
        decoyCount: value.decoyCount ?? null,
      })

      return [
        key,
        {
          ...(flight ? { flight } : {}),
          ...(countermeasures ? { countermeasures } : {}),
        },
      ] as const
    })
  )
}

// Future source-specific enrichment lands here. Keep the threshold seed shape lean.
const manualShipDetails: ShipDetailsSeed = {}

const baseShipDetails = buildCardStatDetails()

const shipDetailsBySource: ShipDetailsDatasetBySource = {
  manual: manualShipDetails,
  'erkul-live': baseShipDetails,
  'erkul-ptu': baseShipDetails,
  spviewer: baseShipDetails,
  merged: {
    ...baseShipDetails,
    ...manualShipDetails,
  },
}

export function getShipDetailsForSource(
  ship: Pick<Ship, 'manufacturer' | 'name'>,
  source: ThresholdDataSourceKey
): ShipExtendedDetails | undefined {
  return shipDetailsBySource[source][getShipDetailsLookupKey(ship)]
}

export function getMergedShipDetails(ship: Pick<Ship, 'manufacturer' | 'name'>) {
  return getShipDetailsForSource(ship, 'merged')
}
