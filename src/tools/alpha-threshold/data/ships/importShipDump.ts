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
// -------------------------

const smallDump = `
ANVL Hurricane 6600 7800 22 11
AEGS Sabre 5400 6200 21 11
ESP Talon 3000 2000 9 7
KRUG L-22 Wolf 2700 1700 10 6
`

const mediumDump = `
CRUS Spirit A1 2500 16500 11 6
CRUS Starfighter Ion 6000 12000 22 13
DRAK Cutlass Black 5400 9400 17 11
ESP Prowler 9000 12500 41 30
`




const largeDump = `
RSI Apollo Medivac 10800 33000 45 27
`

//const capitalDump = `
//`


// -------------------------
// OUTPUTS
// -------------------------

const smallSeeds = buildManualShipSeedsFromDump(smallDump, 'small', '4.7 PTU')
const mediumSeeds = buildManualShipSeedsFromDump(mediumDump, 'medium', '4.7 PTU')
const largeSeeds = buildManualShipSeedsFromDump(largeDump, 'large', '4.7 PTU')

console.log('smallSeeds', smallSeeds)
console.log('mediumSeeds', mediumSeeds)
console.log('largeSeeds', largeSeeds)