import type { ShipRecord } from './types'

export function mergeShipRecords(records: ShipRecord[]): ShipRecord[] {
  const recordMap = new Map<string, ShipRecord>()

  for (const record of records) {
    const existing = recordMap.get(record.id)

    if (!existing) {
      recordMap.set(record.id, record)
      continue
    }

    recordMap.set(record.id, {
      ...existing,
      ...record,
      source: existing.source === record.source ? record.source : 'merged',
      pilotHardpointSize: record.pilotHardpointSize ?? existing.pilotHardpointSize,
      turretHardpointSize: record.turretHardpointSize ?? existing.turretHardpointSize,
    })
  }

  return Array.from(recordMap.values())
}
