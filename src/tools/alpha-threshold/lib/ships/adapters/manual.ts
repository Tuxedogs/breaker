import {
  createShipId,
  normalizeShipManufacturer,
  normalizeShipName,
  normalizeShipSizeGroup,
} from '../normalize'
import type { ManualShipSeed, ShipRecord, ShipSizeGroup } from '../types'

type ParsedManualShipDumpRow = {
  manufacturer: string
  name: string
  health: number
  ballisticThreshold: number
  energyThreshold: number
}

function parseNumericValue(value: string): number {
  return Number.parseFloat(value.replace(/,/g, '').trim())
}

export function parseManualShipDumpRow(
  rawRow: string
): ParsedManualShipDumpRow | null {
  const normalizedRow = rawRow.trim()

  if (!normalizedRow) return null

  const columns = normalizedRow
    .split(/\t|\s{2,}/)
    .map((column) => column.trim())
    .filter(Boolean)

  if (columns.length < 5) return null

  const [manufacturer, name, health, ballisticThreshold, energyThreshold] =
    columns

  const parsedHealth = parseNumericValue(health)
  const parsedBallisticThreshold = parseNumericValue(ballisticThreshold)
  const parsedEnergyThreshold = parseNumericValue(energyThreshold)

  if (
    Number.isNaN(parsedHealth) ||
    Number.isNaN(parsedBallisticThreshold) ||
    Number.isNaN(parsedEnergyThreshold)
  ) {
    return null
  }

  return {
    manufacturer,
    name,
    health: parsedHealth,
    ballisticThreshold: parsedBallisticThreshold,
    energyThreshold: parsedEnergyThreshold,
  }
}

export function parseManualShipDump(
  rawDump: string,
  sizeGroup: ShipSizeGroup,
  patch = '4.7 PTU'
): ManualShipSeed[] {
  return rawDump
    .split(/\r?\n/)
    .map((row) => parseManualShipDumpRow(row))
    .filter((row): row is ParsedManualShipDumpRow => row !== null)
    .map((row) => ({
      manufacturer: row.manufacturer,
      name: row.name,
      sizeGroup,
      health: row.health,
      ballisticThreshold: row.ballisticThreshold,
      energyThreshold: row.energyThreshold,
      patch,
    }))
}

export function normalizeManualShipRecord(
  seed: ManualShipSeed,
  source: ShipRecord['source'] = 'manual'
): ShipRecord {
  const manufacturer = normalizeShipManufacturer(seed.manufacturer)
  const name = normalizeShipName(seed.name)

  return {
    id: createShipId({ manufacturer, name }),
    manufacturer,
    name,
    sizeGroup: normalizeShipSizeGroup(seed.sizeGroup),
    health: seed.health,
    ballisticThreshold: seed.ballisticThreshold,
    energyThreshold: seed.energyThreshold,
    source,
    sourceId: `${manufacturer}:${name}`,
    patch: seed.patch,
  }
}
