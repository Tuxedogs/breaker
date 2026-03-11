import type { WeaponRecord } from './types'

export function mergeWeaponRecords(records: WeaponRecord[]): WeaponRecord[] {
  const mergedById = new Map<string, WeaponRecord>()

  records.forEach((record) => {
    const existing = mergedById.get(record.id)

    if (!existing) {
      mergedById.set(record.id, record)
      return
    }

    mergedById.set(record.id, {
      ...existing,
      ...record,
      alpha: record.alpha ?? existing.alpha,
      burstDps: record.burstDps ?? existing.burstDps,
      projectileSpeed: record.projectileSpeed ?? existing.projectileSpeed,
      source: existing.source === record.source ? existing.source : 'merged',
      sourceId: record.sourceId ?? existing.sourceId,
      patch: record.patch ?? existing.patch,
    })
  })

  return Array.from(mergedById.values())
}
