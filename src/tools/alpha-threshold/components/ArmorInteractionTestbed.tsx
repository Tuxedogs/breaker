import { formatEntityLabel } from '../lib/calculations'
import type { SelectedWeaponComparison, Ship } from '../types'
import { ArmorInteractionSummaryPanel } from './ArmorInteractionSummaryPanel'

type Props = {
  ships: Ship[]
  selectedWeapons: SelectedWeaponComparison[]
}

type ShipAnalysisGroup = {
  ship: Ship
  selections: SelectedWeaponComparison[]
}

type MatchupBlock =
  | { type: 'dual'; selection: SelectedWeaponComparison }
  | { type: 'single-group'; rows: SingleStateRow[] }

type SingleStateRow = SelectedWeaponComparison[]

function buildShipAnalysisGroups(
  ships: Ship[],
  selectedWeapons: SelectedWeaponComparison[]
): ShipAnalysisGroup[] {
  if (!ships.length || !selectedWeapons.length) return []

  return ships.slice(0, 4).map((ship) => ({
    ship,
    selections: selectedWeapons,
  }))
}

function getLayoutMode(selection: SelectedWeaponComparison): 'dual-state' | 'single-state' {
  return selection.weapon.damageType === 'ballistic' ? 'dual-state' : 'single-state'
}

function buildMatchupBlocks(selections: SelectedWeaponComparison[]): MatchupBlock[] {
  const blocks: MatchupBlock[] = []
  let currentSingles: SelectedWeaponComparison[] = []

  function flushSingles() {
    if (!currentSingles.length) return
    blocks.push({ type: 'single-group', rows: buildSingleStateRows(currentSingles) })
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

export function ArmorInteractionTestbed({ ships, selectedWeapons }: Props) {
  const groups = buildShipAnalysisGroups(ships, selectedWeapons)

  if (!groups.length) {
    return (
      <section
        className="alpha-threshold-tab-panel alpha-threshold-board-empty"
        aria-live="polite"
      >
        <div className="alpha-empty-state">
          <h2 className="surface-title">Shield-Aware Armor Validation</h2>
          <p className="mt-3 text-sm text-slate-400">
            Select at least one ship and one weapon to build the analysis board.
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
          Live ship and weapon matchups for reading shield state, armor onset, and confidence through the shield-aware model.
        </p>
      </header>

      <div className="alpha-ui-testbed-grid">
        {groups.map((group) => (
          <section
            key={group.ship.id}
            className="alpha-ui-testbed-ship-column"
            aria-label={`${formatEntityLabel(group.ship.name)} armor interaction group`}
          >
            <header className="alpha-ui-testbed-card-head">
              <div>
                <p className="alpha-ui-testbed-label">
                  {formatEntityLabel(group.ship.manufacturer)}
                </p>
                <h3 className="alpha-ui-testbed-title">{formatEntityLabel(group.ship.name)}</h3>
              </div>
            </header>

            <div className="alpha-ui-testbed-matchup-stack">
              {buildMatchupBlocks(group.selections).map((block, blockIndex) => {
                if (block.type === 'dual') {
                  return (
                    <article
                      key={`${group.ship.id}-${block.selection.slotId}`}
                      className="alpha-ui-testbed-card alpha-ui-testbed-card-dual"
                    >
                      <ArmorInteractionSummaryPanel
                        ship={group.ship}
                        selectedWeapon={block.selection}
                      />
                    </article>
                  )
                }

                return (
                  <div
                    key={`${group.ship.id}-single-group-${blockIndex}`}
                  >
                    {block.rows.map((row, rowIndex) => (
                      <div
                        key={`${group.ship.id}-single-row-${blockIndex}-${rowIndex}`}
                        className="alpha-ui-testbed-single-row"
                      >
                        {row.map((selection) => (
                          <div
                            key={`${group.ship.id}-${selection.slotId}`}
                            className={`alpha-ui-testbed-single-cell ${row.length === 1 ? 'alpha-ui-testbed-single-cell-span' : ''}`}
                          >
                            <article
                              className="alpha-ui-testbed-card alpha-ui-testbed-card-single"
                            >
                              <ArmorInteractionSummaryPanel
                                ship={group.ship}
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
