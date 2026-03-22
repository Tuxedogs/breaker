import { useState } from 'react'
import type { FocusEvent, ReactNode } from 'react'
import { formatEntityLabel } from '../lib/calculations'
import type { SelectedWeaponComparison, Ship } from '../types'
import {
  ArmorInteractionSummaryPanel,
  type ArmorInteractionFilterChip,
} from './ArmorInteractionSummaryPanel'

type Props = {
  controlStrip?: ReactNode
  ships: Ship[]
  selectedWeapons: SelectedWeaponComparison[]
  onFilterChipClick?: (chip: ArmorInteractionFilterChip) => void
}

function buildVisibleShips(ships: Ship[]) {
  return ships.slice(0, 4)
}

export function ArmorInteractionTestbed({
  controlStrip,
  ships,
  selectedWeapons,
  onFilterChipClick,
}: Props) {
  const [activeCell, setActiveCell] = useState<{ shipId: string; slotId: string } | null>(null)
  const visibleShips = buildVisibleShips(ships)
  const isEmpty = !visibleShips.length || !selectedWeapons.length

  function handleCellActivate(shipId: string, slotId: string) {
    setActiveCell({ shipId, slotId })
  }

  function handleCellDeactivate(event: FocusEvent<HTMLDivElement>, shipId: string, slotId: string) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setActiveCell((current) =>
      current?.shipId === shipId && current.slotId === slotId ? null : current
    )
  }

  return (
    <section
      className={`alpha-threshold-tab-panel ${isEmpty ? 'alpha-threshold-board-empty' : 'alpha-analysis-board'}`}
      data-ship-count={visibleShips.length}
      data-active-ship={activeCell?.shipId ?? ''}
      aria-label="Armor interaction analysis"
    >
      {controlStrip ? (
        <div className="alpha-analysis-control-shell">
          {controlStrip}
        </div>
      ) : null}

      {!isEmpty ? (
        <div className="alpha-analysis-sticky-shell">
          <div className="alpha-analysis-sticky-surface">
            <div className="alpha-ui-testbed-grid alpha-ui-testbed-header-grid">
              {visibleShips.map((ship) => (
                <section
                  key={`${ship.id}-header`}
                  className="alpha-ui-testbed-ship-column"
                  aria-label={`${formatEntityLabel(ship.name)} armor interaction header`}
                >
                  <header className="alpha-ui-testbed-card-head">
                    <div>
                      <p className="alpha-ui-testbed-label">
                        {formatEntityLabel(ship.manufacturer)}
                      </p>
                      <h3 className="alpha-ui-testbed-title">{formatEntityLabel(ship.name)}</h3>
                    </div>
                  </header>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {isEmpty ? (
        <div className="alpha-empty-state" aria-live="polite">
          <h2 className="surface-title">Shield-Aware Armor Validation</h2>
          <p className="mt-3 text-sm text-slate-400">
            Select at least one ship and one weapon to build the analysis board.
          </p>
        </div>
      ) : (
        <div className="alpha-weapon-analysis-stack">
          {selectedWeapons.map((selection) => (
            <article
              key={selection.slotId}
              className={`alpha-weapon-analysis-row alpha-weapon-analysis-row-${selection.weapon.damageType}`}
            >
              <header className="alpha-weapon-analysis-row-head">
                <div className="alpha-weapon-analysis-row-context-grid" aria-live="polite">
                  {visibleShips.map((ship) => {
                    const isActive =
                      activeCell?.slotId === selection.slotId && activeCell.shipId === ship.id

                    return (
                      <div
                        key={`${selection.slotId}-${ship.id}-context`}
                        className={`alpha-weapon-analysis-row-context-cell ${isActive ? 'alpha-weapon-analysis-row-context-cell-active' : ''}`}
                      >
                        <p className="alpha-weapon-analysis-row-eyebrow">
                          {selection.weapon.damageType === 'ballistic' ? 'Ballistic' : 'Energy'}
                        </p>
                        <p className="alpha-weapon-analysis-row-context">
                          {selection.weapon.name} · {formatEntityLabel(ship.name)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </header>

              <div className="alpha-weapon-analysis-grid">
                {visibleShips.map((ship) => (
                  <div
                    key={`${selection.slotId}-${ship.id}`}
                    className={`alpha-weapon-analysis-cell ${activeCell?.shipId === ship.id && activeCell.slotId === selection.slotId ? 'alpha-weapon-analysis-cell-active' : ''}`}
                    onPointerEnter={() => handleCellActivate(ship.id, selection.slotId)}
                    onPointerLeave={() =>
                      setActiveCell((current) =>
                        current?.shipId === ship.id && current.slotId === selection.slotId ? null : current
                      )
                    }
                    onFocusCapture={() => handleCellActivate(ship.id, selection.slotId)}
                    onBlurCapture={(event) => handleCellDeactivate(event, ship.id, selection.slotId)}
                  >
                    <ArmorInteractionSummaryPanel
                      ship={ship}
                      selectedWeapon={selection}
                      compact
                      hideWeaponHeader
                      highlighted={activeCell?.shipId === ship.id && activeCell.slotId === selection.slotId}
                      onFilterChipClick={onFilterChipClick}
                    />
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
