import { formatEntityLabel } from '../lib/calculations'
import type { SelectedWeaponComparison, Ship, WeaponRecord } from '../types'
import { ArmorInteractionSummaryPanel } from './ArmorInteractionSummaryPanel'

type Props = {
  ships: Ship[]
  weapons: WeaponRecord[]
}

type Scenario = {
  ship: Ship
  selections: SelectedWeaponComparison[]
}

type MatchupBlock =
  | { type: 'dual'; selection: SelectedWeaponComparison }
  | { type: 'single-grid'; selections: SelectedWeaponComparison[] }

type SingleStateRow = SelectedWeaponComparison[]

const TESTBED_SHIP_NAMES = [
  'Perseus',
  'Avenger_Stalker',
  'Gladius',
  'Hammerhead',
  'Polaris',
] as const

const TESTBED_WEAPON_NAMES = [
  '11-Series Broadsword',
  'Tarantula GT-870 Mk 3',
  'Deadbolt III',
  'Deadbolt V',
  'RSI Medusa',
  'Attrition-4',
  'M7A',
  'Omnisky XV',
] as const

const TONES: SelectedWeaponComparison['tone'][] = ['cyan', 'violet', 'amber', 'emerald']

function getShipByName(ships: Ship[], name: string) {
  return ships.find((ship) => ship.name === name)
}

function getWeaponByName(weapons: WeaponRecord[], name: string) {
  return weapons.find((weapon) => weapon.name === name)
}

function toSelectedWeaponComparisons(weapons: WeaponRecord[]) {
  return weapons.map((weapon, index) => ({
    slotId: `ui-testbed-${weapon.id}-${index}`,
    slotLabel: `Slot ${index + 1}`,
    tone: TONES[index % TONES.length] ?? 'cyan',
    weapon,
  }))
}

function buildScenarios(ships: Ship[], weapons: WeaponRecord[]): Scenario[] {
  const shipMap = new Map<string, Ship>()
  for (const name of TESTBED_SHIP_NAMES) {
    const ship = getShipByName(ships, name)
    if (ship) shipMap.set(name, ship)
  }

  const weaponMap = new Map<string, WeaponRecord>()
  for (const name of TESTBED_WEAPON_NAMES) {
    const weapon = getWeaponByName(weapons, name)
    if (weapon) weaponMap.set(name, weapon)
  }

  const scenarios: Array<{ shipName: string; weaponNames: readonly string[] }> = [
    {
      shipName: 'Perseus',
      weaponNames: [
        '11-Series Broadsword',
        'Tarantula GT-870 Mk 3',
        'Deadbolt III',
        'Deadbolt V',
        'RSI Medusa',
      ],
    },
    {
      shipName: 'Avenger_Stalker',
      weaponNames: ['Attrition-4', 'M7A', 'Deadbolt III'],
    },
    {
      shipName: 'Gladius',
      weaponNames: ['Attrition-4', 'Omnisky XV', 'Deadbolt III'],
    },
    {
      shipName: 'Hammerhead',
      weaponNames: ['Attrition-4', 'M7A', 'Deadbolt V'],
    },
    {
      shipName: 'Polaris',
      weaponNames: ['M7A', 'Deadbolt V', 'RSI Medusa'],
    },
  ]

  return scenarios
    .map((scenario) => {
      const ship = shipMap.get(scenario.shipName)
      if (!ship) return null

      const selectedWeapons = toSelectedWeaponComparisons(
        scenario.weaponNames
          .map((weaponName) => weaponMap.get(weaponName))
          .filter((weapon): weapon is WeaponRecord => weapon != null)
      )

      if (!selectedWeapons.length) return null

      return {
        ship,
        selections: selectedWeapons,
      }
    })
    .filter((scenario): scenario is Scenario => scenario !== null)
}

function getLayoutMode(selection: SelectedWeaponComparison): 'dual-state' | 'single-state' {
  return selection.weapon.damageType === 'ballistic' ? 'dual-state' : 'single-state'
}

function buildMatchupBlocks(selections: SelectedWeaponComparison[]): MatchupBlock[] {
  const blocks: MatchupBlock[] = []
  let currentSingles: SelectedWeaponComparison[] = []

  function flushSingles() {
    if (!currentSingles.length) return
    blocks.push({ type: 'single-grid', selections: currentSingles })
    currentSingles = []
  }

  for (const selection of selections) {
    if (getLayoutMode(selection) === 'single-state') {
      currentSingles.push(selection)
      continue
    }

    flushSingles()
    blocks.push({ type: 'dual', selection })
  }

  flushSingles()
  return blocks
}

function buildSingleStateRows(
  selections: SelectedWeaponComparison[]
): SingleStateRow[] {
  const rows: SingleStateRow[] = []

  for (let index = 0; index < selections.length; index += 2) {
    rows.push(selections.slice(index, index + 2))
  }

  return rows
}

export function ArmorInteractionTestbed({ ships, weapons }: Props) {
  const scenarios = buildScenarios(ships, weapons)

  if (!scenarios.length) {
    return (
      <section
        className="alpha-threshold-tab-panel alpha-threshold-board-empty"
        aria-live="polite"
      >
        <div className="alpha-empty-state">
          <h2 className="surface-title">UI Testbed</h2>
          <p className="mt-3 text-sm text-slate-400">
            Curated ship or weapon records are missing from the current source.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="alpha-threshold-tab-panel" aria-label="Armor interaction UI testbed">
      <header className="alpha-ui-testbed-head">
        <div>
          <p className="page-kicker">Armor Interaction Review</p>
          <h2 className="surface-title mt-2">Shield-Aware Armor Validation</h2>
        </div>
        <p className="alpha-ui-testbed-copy">
          Curated ship and weapon matchups for reading shield state, armor onset, and confidence before the wider calculator adopts this model.
        </p>
      </header>

      <div className="alpha-ui-testbed-grid">
        {scenarios.map((scenario) => (
          <section
            key={scenario.ship.id}
            className="alpha-ui-testbed-ship-column"
            aria-label={`${formatEntityLabel(scenario.ship.name)} armor interaction group`}
          >
            <header className="alpha-ui-testbed-card-head">
              <div>
                <p className="alpha-ui-testbed-label">Ship</p>
                <h3 className="alpha-ui-testbed-title">{formatEntityLabel(scenario.ship.name)}</h3>
              </div>
              <p className="alpha-ui-testbed-meta">
                {formatEntityLabel(scenario.ship.manufacturer)} / {scenario.ship.source}
              </p>
            </header>

            <div className="alpha-ui-testbed-matchup-stack">
              {buildMatchupBlocks(scenario.selections).map((block, blockIndex) => {
                if (block.type === 'dual') {
                  return (
                    <article
                      key={`${scenario.ship.id}-${block.selection.slotId}`}
                      className="alpha-ui-testbed-card alpha-ui-testbed-card-dual"
                    >
                      <ArmorInteractionSummaryPanel
                        ship={scenario.ship}
                        selectedWeapon={block.selection}
                      />
                    </article>
                  )
                }

                return (
                  <div
                    key={`${scenario.ship.id}-single-grid-${blockIndex}`}
                    className="alpha-ui-testbed-single-grid"
                  >
                    {buildSingleStateRows(block.selections).map((row, rowIndex) => (
                      <div
                        key={`${scenario.ship.id}-single-row-${blockIndex}-${rowIndex}`}
                        className="alpha-ui-testbed-single-row"
                      >
                        {row.map((selection) => (
                          <div
                            key={`${scenario.ship.id}-${selection.slotId}`}
                            className={`alpha-ui-testbed-single-cell ${row.length === 1 ? 'alpha-ui-testbed-single-cell-span' : ''}`}
                          >
                            <article
                              className="alpha-ui-testbed-card alpha-ui-testbed-card-single"
                            >
                              <ArmorInteractionSummaryPanel
                                ship={scenario.ship}
                                selectedWeapon={selection}
                                compact
                              />
                            </article>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
