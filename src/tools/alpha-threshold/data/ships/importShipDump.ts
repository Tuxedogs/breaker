type ShipSizeGroup = 'small' | 'medium' | 'large' | 'capital'

type ManualShipSeed = {
  manufacturer: string
  name: string
  sizeGroup: ShipSizeGroup
  armor: number
  hp: number
  ballisticThreshold: number
  energyThreshold: number
  patch: string
}

function normalizeShipNameParts(parts: string[]): string {
  return parts.join(' ').trim()
}

function toPositiveNumber(value: string, label: string, line: string): number {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid ${label} "${value}" in line: "${line}"`)
  }

  return parsed
}


export function parseManualShipDump(
  rawDump: string,
  sizeGroup: ShipSizeGroup,
  patch = '4.7 PTU'
): ManualShipSeed[] {
  const lines = rawDump
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.map((line) => {
    const tokens = line.split(/\s+/)

    if (tokens.length < 6) {
      throw new Error(
        `Invalid line. Expected at least 6 tokens (manufacturer, name, armor, hp, ballisticDivisor, energyDivisor). Got ${tokens.length}: "${line}"`
      )
    }

    const manufacturer = tokens[0]
    const energyDivisorRaw = tokens[tokens.length - 1]
    const ballisticDivisorRaw = tokens[tokens.length - 2]
    const hpRaw = tokens[tokens.length - 3]
    const armorRaw = tokens[tokens.length - 4]
    const nameParts = tokens.slice(1, tokens.length - 4)

    if (nameParts.length === 0) {
      throw new Error(`Missing ship name in line: "${line}"`)
    }

    const armor = toPositiveNumber(armorRaw, 'armor', line)
    const hp = toPositiveNumber(hpRaw, 'hp', line)
    const ballisticDivisor = toPositiveNumber(
      ballisticDivisorRaw,
      'ballisticDivisor',
      line
    )
    const energyDivisor = toPositiveNumber(
      energyDivisorRaw,
      'energyDivisor',
      line
    )

    if (ballisticDivisor === 0 || energyDivisor === 0) {
      throw new Error(`Threshold divisors cannot be 0 in line: "${line}"`)
    }

    return {
      manufacturer,
      name: normalizeShipNameParts(nameParts),
      sizeGroup,
      armor,
      hp,
      ballisticThreshold: Math.round(hp / ballisticDivisor),
      energyThreshold: Math.round(hp / energyDivisor),
      patch,
    }
  })
}

export function buildManualShipSeedsFromDump(
  rawDump: string,
  sizeGroup: ShipSizeGroup,
  patch = '4.7 PTU'
): ManualShipSeed[] {
  return parseManualShipDump(rawDump, sizeGroup, patch)
}

// -------------------------
// INPUTS
// -------------------------
/**
 * Expected line format:
 * Manufacturer Ship Name Armor HP BallisticDivisor EnergyDivisor
 *
 * Example:
 * ANVL Hurricane 6600 7800 22 11
 */
// -------------------------
// 
// -----------------------
//const capitalDump = `
//`


// -------------------------
// OUTPUTS
// -------------------------
