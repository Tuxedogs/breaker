import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import {
  estimateArmorInteraction,
  formatEntityLabel,
  formatMetric,
} from '../lib/calculations'
import { formatWeaponClassLabel } from '../lib/weapons/normalize'
import type {
  ArmorInteractionEstimate,
  DefenseShieldState,
  SelectedWeaponComparison,
  Ship,
} from '../types'
import type { ArmorInteractionFilterChip } from './ArmorInteractionSummaryPanel'

type Props = {
  controlStrip?: ReactNode
  ships: Ship[]
  selectedWeapons: SelectedWeaponComparison[]
  shieldMode: DefenseShieldState
  onShieldModeChange: (mode: DefenseShieldState) => void
  onFilterChipClick?: (chip: ArmorInteractionFilterChip) => void
  onOpenWeapons: () => void
  onOpenShips: () => void
}

type MatrixCellModel = ReturnType<typeof buildMatrixCellModel>
type MatrixEstimateView = ReturnType<typeof buildEstimateViewModel>

function buildVisibleShips(ships: Ship[]) {
  return ships.slice(0, 4)
}

function sortSelectedWeapons(selectedWeapons: SelectedWeaponComparison[]) {
  return selectedWeapons
    .map((selection, index) => ({ selection, index }))
    .sort((left, right) => {
      const leftPriority = left.selection.weapon.damageType === 'energy' ? 0 : 1
      const rightPriority = right.selection.weapon.damageType === 'energy' ? 0 : 1

      if (leftPriority !== rightPriority) return leftPriority - rightPriority
      return left.index - right.index
    })
    .map(({ selection }) => selection)
}

function getShieldChipLabel(state: DefenseShieldState) {
  return state === 'up' ? 'Shield Up' : 'Shield Down'
}

function getEstimateTimingTone(estimate: ArmorInteractionEstimate) {
  if (!estimate.damagesFreshArmor && estimate.armorDamageStartsAtPercent == null) return 'none'
  if (estimate.damagesFreshArmor || estimate.armorDamageStartsAtPercent === 100) return 'early'
  if ((estimate.armorDamageStartsAtPercent ?? 0) >= 75) return 'early'
  if ((estimate.armorDamageStartsAtPercent ?? 0) >= 45) return 'mid'
  return 'late'
}

function getEstimatePenetrationLabel(estimate: ArmorInteractionEstimate) {
  if (!estimate.damagesFreshArmor && estimate.armorDamageStartsAtPercent == null) {
    return 'No Armor Dmg'
  }
  if (estimate.damagesFreshArmor || estimate.armorDamageStartsAtPercent === 100) {
    return 'Armor Dmg @ Full'
  }
  return `Armor Dmg @ ${Math.round(estimate.armorDamageStartsAtPercent ?? 0)}%`
}

function getEstimateStateLabel(estimate: ArmorInteractionEstimate) {
  if (!estimate.damagesFreshArmor && estimate.armorDamageStartsAtPercent == null) return 'None'
  if (estimate.damagesFreshArmor || estimate.armorDamageStartsAtPercent === 100) {
    return 'Early / Full'
  }

  if ((estimate.armorDamageStartsAtPercent ?? 0) >= 75) return 'Early'
  if ((estimate.armorDamageStartsAtPercent ?? 0) >= 45) return 'Mid'
  return 'Late'
}

function getMarkerAlign(percent: number) {
  if (percent <= 8) return 'start'
  if (percent >= 92) return 'end'
  return 'center'
}

function buildEstimateViewModel(estimate: ArmorInteractionEstimate, shieldState: DefenseShieldState) {
  const tone = getEstimateTimingTone(estimate)
  const markerPercent =
    !estimate.damagesFreshArmor && estimate.armorDamageStartsAtPercent == null
      ? 100
      : estimate.damagesFreshArmor || estimate.armorDamageStartsAtPercent === 100
        ? 0
        : Math.max(0, Math.min(100, 100 - (estimate.armorDamageStartsAtPercent ?? 0)))

  return {
    estimate,
    shieldState,
    tone,
    shieldChipLabel: getShieldChipLabel(shieldState),
    stateLabel: getEstimateStateLabel(estimate),
    penetrationLabel: getEstimatePenetrationLabel(estimate),
    markerPercent,
    markerAlign: getMarkerAlign(markerPercent),
    markerLabel:
      !estimate.damagesFreshArmor && estimate.armorDamageStartsAtPercent == null
        ? 'No damage'
        : 'Damage start',
  }
}

function buildMatrixCellModel(ship: Ship, selection: SelectedWeaponComparison) {
  const shieldsOnEstimate = estimateArmorInteraction(selection.weapon, ship, 'up')
  const shieldsOffEstimate = estimateArmorInteraction(selection.weapon, ship, 'down')

  return {
    shieldsOn: buildEstimateViewModel(shieldsOnEstimate, 'up'),
    shieldsOff: buildEstimateViewModel(shieldsOffEstimate, 'down'),
  }
}

function getVelocityLabel(selection: SelectedWeaponComparison) {
  return selection.weapon.projectileSpeed != null
    ? `${formatMetric(selection.weapon.projectileSpeed)} m/s`
    : 'Velocity Unknown'
}

function getCompactMetricLabel(value: number | null | undefined) {
  if (value == null) return 'N/A'
  return formatMetric(value)
}

function getShipSummaryLine(ship: Ship) {
  const armorHp = ship.armorHp ?? 0
  const hullHp = ship.vitalHp ?? 0
  const totalDurability = armorHp + hullHp
  const armorShare = totalDurability > 0 ? armorHp / totalDurability : 0

  if (armorShare >= 0.58 || armorHp >= hullHp * 1.25) return 'Armor-weighted durability'
  if (armorShare <= 0.4 || hullHp >= armorHp * 1.4) {
    return 'Light durability profile'
  }
  return 'Balanced durability'
}

function getShipDurabilityBreakdown(ship: Ship) {
  const armorHp = Math.max(0, ship.armorHp ?? 0)
  const hullHp = Math.max(0, ship.vitalHp ?? 0)
  const total = armorHp + hullHp

  if (total <= 0) {
    return {
      armorPercent: 50,
      hullPercent: 50,
    }
  }

  return {
    armorPercent: (armorHp / total) * 100,
    hullPercent: (hullHp / total) * 100,
  }
}

function getMatrixGridStyle(columnCount: number): CSSProperties {
  return {
    ['--alpha-matrix-columns' as string]: `minmax(var(--alpha-matrix-ship-width), var(--alpha-matrix-ship-width)) repeat(${columnCount}, minmax(var(--alpha-matrix-weapon-min-width), 1fr))`,
    ['--alpha-matrix-min-width' as string]: `calc(var(--alpha-matrix-ship-width) + (${columnCount} * var(--alpha-matrix-weapon-min-width)) + (${columnCount} * var(--alpha-matrix-gap)))`,
  }
}

export function ThresholdComparisonMatrix({
  controlStrip,
  ships,
  selectedWeapons,
  shieldMode,
  onShieldModeChange,
  onFilterChipClick,
  onOpenWeapons,
  onOpenShips,
}: Props) {
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null)
  const visibleShips = buildVisibleShips(ships)
  const orderedWeapons = useMemo(() => sortSelectedWeapons(selectedWeapons), [selectedWeapons])
  const isEmpty = visibleShips.length === 0 || orderedWeapons.length === 0
  const gridStyle = getMatrixGridStyle(orderedWeapons.length)

  const cellModels = useMemo(() => {
    return new Map(
      visibleShips.flatMap((ship) =>
        orderedWeapons.map((selection) => [
          `${ship.id}:${selection.slotId}`,
          buildMatrixCellModel(ship, selection),
        ] as const)
      )
    )
  }, [orderedWeapons, visibleShips])

  return (
    <section
      className={`alpha-threshold-tab-panel ${isEmpty ? 'alpha-threshold-board-empty' : 'alpha-comparison-matrix-panel'}`}
      aria-label="Threshold comparison matrix"
    >
      {controlStrip ? <div className="alpha-analysis-control-shell">{controlStrip}</div> : null}

      {isEmpty ? (
        <div className="alpha-empty-state" aria-live="polite">
          <h2 className="surface-title">Shield-Aware Armor Validation</h2>
          <p className="mt-3 text-sm text-slate-400">
            Select at least one ship and one weapon to build the analysis matrix.
          </p>
        </div>
      ) : (
        <div className="alpha-comparison-matrix-shell">
          <div className="alpha-comparison-matrix-scroll">
            <div
              className="alpha-comparison-matrix-table"
              style={gridStyle}
              data-weapon-count={orderedWeapons.length}
            >
              <div className="alpha-comparison-matrix-header-row">
                <div className="alpha-comparison-matrix-corner">
                  <p className="alpha-comparison-matrix-corner-label">Ships</p>
                  <p className="alpha-comparison-matrix-corner-copy">
                    Configure matrix inputs.
                  </p>
                  <div className="alpha-comparison-matrix-corner-controls">
                    <div className="alpha-comparison-matrix-corner-control-row">
                      <button
                        type="button"
                        className="alpha-comparison-matrix-corner-pill alpha-tool-frame-banner-mode alpha-tool-frame-banner-mode-active"
                        onClick={onOpenShips}
                      >
                        Ships
                      </button>
                      <button
                        type="button"
                        className="alpha-comparison-matrix-corner-pill alpha-tool-frame-banner-mode"
                        onClick={onOpenWeapons}
                      >
                        Edit Weapons
                      </button>
                    </div>
                    <div
                      className="alpha-comparison-matrix-corner-control-row"
                      role="group"
                      aria-label="Shield mode"
                    >
                      <button
                        type="button"
                        className={[
                          'alpha-comparison-matrix-corner-pill',
                          'alpha-tool-frame-banner-mode',
                          shieldMode === 'up' ? 'alpha-tool-frame-banner-mode-active' : '',
                        ].join(' ')}
                        aria-pressed={shieldMode === 'up'}
                        onClick={() => onShieldModeChange('up')}
                      >
                        Shields On
                      </button>
                      <button
                        type="button"
                        className={[
                          'alpha-comparison-matrix-corner-pill',
                          'alpha-tool-frame-banner-mode',
                          shieldMode === 'down' ? 'alpha-tool-frame-banner-mode-active' : '',
                        ].join(' ')}
                        aria-pressed={shieldMode === 'down'}
                        onClick={() => onShieldModeChange('down')}
                      >
                        Shields Off
                      </button>
                    </div>
                  </div>
                </div>

                {orderedWeapons.map((selection) => {
                  const isActive = activeColumnId === selection.slotId

                  return (
                    <header
                      key={selection.slotId}
                      className={`alpha-comparison-matrix-weapon-header ${isActive ? 'alpha-comparison-matrix-weapon-header-active' : ''}`}
                      onPointerEnter={() => setActiveColumnId(selection.slotId)}
                      onPointerLeave={() =>
                        setActiveColumnId((current) =>
                          current === selection.slotId ? null : current
                        )
                      }
                      onFocusCapture={() => setActiveColumnId(selection.slotId)}
                      onBlurCapture={() =>
                        setActiveColumnId((current) =>
                          current === selection.slotId ? null : current
                        )
                      }
                    >
                      <p className="alpha-comparison-matrix-weapon-eyebrow">
                        {selection.weapon.damageType === 'ballistic' ? 'Ballistic' : 'Energy'}
                      </p>
                      <h3 className="alpha-comparison-matrix-weapon-name">
                        {formatEntityLabel(selection.weapon.name)}
                      </h3>
                      <p className="alpha-comparison-matrix-weapon-meta">
                        {formatWeaponClassLabel(selection.weapon.weaponClass)} - {getVelocityLabel(selection)}
                      </p>
                      <div className="alpha-comparison-matrix-weapon-actions">
                        <button
                          type="button"
                          className="alpha-comparison-matrix-chip"
                          onClick={() =>
                            onFilterChipClick?.({
                              kind: 'damageType',
                              slotId: selection.slotId,
                              label:
                                selection.weapon.damageType === 'ballistic'
                                  ? 'Ballistic'
                                  : 'Energy',
                              value: selection.weapon.damageType,
                            })
                          }
                        >
                          {selection.weapon.damageType === 'ballistic' ? 'Ballistic' : 'Energy'}
                        </button>
                        <button
                          type="button"
                          className="alpha-comparison-matrix-chip"
                          onClick={() =>
                            onFilterChipClick?.({
                              kind: 'weaponClass',
                              slotId: selection.slotId,
                              label: formatWeaponClassLabel(selection.weapon.weaponClass),
                              value: selection.weapon.weaponClass,
                            })
                          }
                        >
                          {formatWeaponClassLabel(selection.weapon.weaponClass)}
                        </button>
                      </div>
                    </header>
                  )
                })}
              </div>

              <div className="alpha-comparison-matrix-body">
                {visibleShips.map((ship) => {
                  const rowActive = activeRowId === ship.id
                  const durability = getShipDurabilityBreakdown(ship)

                  return (
                    <div
                      key={ship.id}
                      className={`alpha-comparison-matrix-row ${rowActive ? 'alpha-comparison-matrix-row-active' : ''}`}
                      onPointerEnter={() => setActiveRowId(ship.id)}
                      onPointerLeave={() =>
                        setActiveRowId((current) => (current === ship.id ? null : current))
                      }
                      onFocusCapture={() => setActiveRowId(ship.id)}
                      onBlurCapture={() =>
                        setActiveRowId((current) => (current === ship.id ? null : current))
                      }
                    >
                      <article className="alpha-comparison-matrix-ship-card">
                        <div className="alpha-comparison-matrix-ship-header">
                          <div className="alpha-comparison-matrix-ship-media">
                            {ship.imageSrc ? (
                              <img
                                className="alpha-comparison-matrix-ship-image"
                                src={ship.imageSrc}
                                alt={ship.imageAlt ?? `${formatEntityLabel(ship.name)} ship image`}
                                loading="lazy"
                              />
                            ) : (
                              <div
                                className="alpha-comparison-matrix-ship-image-fallback"
                                aria-hidden="true"
                              >
                                {formatEntityLabel(ship.manufacturer).slice(0, 2)}
                              </div>
                            )}
                          </div>

                          <div className="alpha-comparison-matrix-ship-copy">
                            <p className="alpha-comparison-matrix-ship-eyebrow">
                              Manufacturer
                            </p>
                            <h3 className="alpha-comparison-matrix-ship-name">
                              {formatEntityLabel(ship.name)}
                            </h3>
                            <p className="alpha-comparison-matrix-ship-summary">
                              {getShipSummaryLine(ship)}
                            </p>
                          </div>
                        </div>

                        <div className="alpha-comparison-matrix-ship-durability">
                          <div className="alpha-comparison-matrix-ship-durability-head">
                            <p className="alpha-comparison-matrix-ship-section-label">
                              Durability Mix
                            </p>
                            <p className="alpha-comparison-matrix-ship-durability-copy">
                              Armor {Math.round(durability.armorPercent)}% • Hull{' '}
                              {Math.round(durability.hullPercent)}%
                            </p>
                          </div>
                          <div
                            className="alpha-comparison-matrix-ship-durability-track"
                            aria-label="Armor to hull durability ratio"
                          >
                            <span
                              className="alpha-comparison-matrix-ship-durability-fill alpha-comparison-matrix-ship-durability-fill-armor"
                              style={{ flexBasis: `${durability.armorPercent}%` }}
                            />
                            <span
                              className="alpha-comparison-matrix-ship-durability-fill alpha-comparison-matrix-ship-durability-fill-hull"
                              style={{ flexBasis: `${durability.hullPercent}%` }}
                            />
                          </div>
                        </div>

                        <div className="alpha-comparison-matrix-ship-sections">
                          <section className="alpha-comparison-matrix-ship-section" aria-label="Flight stats">
                            <p className="alpha-comparison-matrix-ship-section-label">Flight</p>
                            <dl className="alpha-comparison-matrix-ship-stat-list">
                              <div className="alpha-comparison-matrix-ship-stat-row">
                                <dt>NAV</dt>
                                <dd>{getCompactMetricLabel(ship.navSpeed)}</dd>
                              </div>
                              <div className="alpha-comparison-matrix-ship-stat-row">
                                <dt>SCM</dt>
                                <dd>{getCompactMetricLabel(ship.scmSpeed)}</dd>
                              </div>
                            </dl>
                          </section>

                          <section
                            className="alpha-comparison-matrix-ship-section"
                            aria-label="Durability stats"
                          >
                            <p className="alpha-comparison-matrix-ship-section-label">Durability</p>
                            <dl className="alpha-comparison-matrix-ship-stat-list">
                              <div className="alpha-comparison-matrix-ship-stat-row">
                                <dt>Armor HP</dt>
                                <dd>{formatMetric(ship.armorHp)}</dd>
                              </div>
                              <div className="alpha-comparison-matrix-ship-stat-row">
                                <dt>Hull HP</dt>
                                <dd>{formatMetric(ship.vitalHp)}</dd>
                              </div>
                            </dl>
                          </section>
                        </div>
                      </article>

                      {orderedWeapons.map((selection) => {
                        const model = cellModels.get(
                          `${ship.id}:${selection.slotId}`
                        ) as MatrixCellModel
                        const activeResult: MatrixEstimateView =
                          shieldMode === 'up' ? model.shieldsOn : model.shieldsOff
                        const columnActive = activeColumnId === selection.slotId
                        const shieldBlocked =
                          shieldMode === 'up' && selection.weapon.damageType === 'energy'

                        return (
                          <article
                            key={`${ship.id}:${selection.slotId}`}
                            className={`alpha-comparison-matrix-cell alpha-comparison-matrix-cell-${activeResult.tone} ${columnActive ? 'alpha-comparison-matrix-cell-column-active' : ''} ${shieldBlocked ? 'alpha-comparison-matrix-cell-shield-blocked' : ''}`}
                            onPointerEnter={() => setActiveColumnId(selection.slotId)}
                            onPointerLeave={() =>
                              setActiveColumnId((current) =>
                                current === selection.slotId ? null : current
                              )
                            }
                            onFocusCapture={() => setActiveColumnId(selection.slotId)}
                            onBlurCapture={() =>
                              setActiveColumnId((current) =>
                                current === selection.slotId ? null : current
                              )
                            }
                            tabIndex={0}
                          >
                            <div className="alpha-comparison-matrix-cell-content" aria-hidden={shieldBlocked}>
                              <div className="alpha-comparison-matrix-cell-head">
                                <p className="alpha-comparison-matrix-cell-state">
                                  {activeResult.stateLabel}
                                </p>
                                <p className="alpha-comparison-matrix-cell-shield-chip">
                                  {activeResult.shieldChipLabel}
                                </p>
                                <p className="alpha-comparison-matrix-cell-summary">
                                  {activeResult.penetrationLabel}
                                </p>
                              </div>

                              <div className="alpha-comparison-matrix-cell-inline-metrics">
                                <span>
                                  <strong>T</strong>
                                  {formatMetric(activeResult.estimate.deflectionThreshold)}
                                </span>
                                <span>
                                  <strong>A</strong>
                                  {formatMetric(activeResult.estimate.effectiveArmorAlpha)}
                                </span>
                              </div>

                              <div className="alpha-comparison-matrix-cell-chart">
                                <div className="alpha-comparison-matrix-cell-track-scale">
                                  <span>100% armor</span>
                                  <span>0% armor</span>
                                </div>
                                <div
                                  className="alpha-comparison-matrix-cell-track"
                                  aria-label={`${activeResult.penetrationLabel} threshold marker`}
                                >
                                  <div className="alpha-comparison-matrix-cell-track-fill" />
                                  <span
                                    className="alpha-comparison-matrix-cell-marker"
                                    style={{ left: `${activeResult.markerPercent}%` }}
                                  />
                                </div>
                                <div className="alpha-comparison-matrix-cell-track-caption-row">
                                  <span
                                    className={`alpha-comparison-matrix-cell-track-caption alpha-comparison-matrix-cell-track-caption-${activeResult.markerAlign}`}
                                    style={{ left: `${activeResult.markerPercent}%` }}
                                  >
                                    {activeResult.markerLabel}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {shieldBlocked ? (
                              <div
                                className="alpha-comparison-matrix-cell-overlay"
                                aria-label="Regular shield damage applies"
                              >
                                <p className="alpha-comparison-matrix-cell-overlay-copy">
                                  Regular shield damage applies
                                </p>
                              </div>
                            ) : null}
                          </article>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}


