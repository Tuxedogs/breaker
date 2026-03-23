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
  selectionMode: 'ship' | 'weapon' | null
  nextShipSlotIndex: number
  nextWeaponSlotIndex: number
  onShieldModeChange: (mode: DefenseShieldState) => void
  onFilterChipClick?: (chip: ArmorInteractionFilterChip) => void
  onOpenWeapons: () => void
  onOpenShips: () => void
  onOpenWeaponsAt?: (slotIndex: number) => void
  onOpenShipsAt?: (slotIndex: number) => void
}

type MatrixCellModel = ReturnType<typeof buildMatrixCellModel>
type MatrixEstimateView = ReturnType<typeof buildEstimateViewModel>
const DESTINATION_TONES = ['cyan', 'violet', 'amber', 'emerald'] as const

function buildVisibleShips(ships: Ship[]) {
  return ships.slice(0, 4)
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
    return 'Armor Dmg at 100%'
  }
  return `Armor Dmg at ${Math.round(estimate.armorDamageStartsAtPercent ?? 0)}%`
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

function isPlaceholderShip(ship: Ship) {
  return ship.name === '' && ship.manufacturer === ''
}

function isPlaceholderWeapon(selection: SelectedWeaponComparison) {
  return selection.weapon.name === '' && selection.weapon.weaponClass === ''
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
  selectionMode,
  nextShipSlotIndex,
  nextWeaponSlotIndex,
  onShieldModeChange,
  onFilterChipClick,
  onOpenWeapons,
  onOpenShips,
  onOpenWeaponsAt,
  onOpenShipsAt,
}: Props) {
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null)
  const visibleShips = buildVisibleShips(ships)
  const orderedWeapons = selectedWeapons
  const isPlaceholderPreview =
    (visibleShips.length > 0 &&
      visibleShips.every((ship) => ship.name === '' && ship.manufacturer === '')) ||
    (orderedWeapons.length > 0 &&
      orderedWeapons.every(
        (selection) => selection.weapon.name === '' && selection.weapon.weaponClass === ''
      ))
  const activeShipDestinationIndex = Math.min(nextShipSlotIndex, Math.max(0, visibleShips.length - 1))
  const activeWeaponDestinationIndex = Math.min(
    nextWeaponSlotIndex,
    Math.max(0, orderedWeapons.length - 1)
  )
  const activeShipTone = DESTINATION_TONES[activeShipDestinationIndex % DESTINATION_TONES.length]
  const activeWeaponTone =
    DESTINATION_TONES[activeWeaponDestinationIndex % DESTINATION_TONES.length]
  const firstEnergyColumnIndex = orderedWeapons.findIndex(
    (selection) => selection.weapon.damageType === 'energy'
  )
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
      className={[
        'alpha-threshold-tab-panel',
        'alpha-comparison-matrix-panel',
        isPlaceholderPreview ? 'alpha-comparison-matrix-placeholder-preview' : '',
        selectionMode ? 'alpha-comparison-matrix-selection-active' : '',
        selectionMode === 'ship' ? 'alpha-comparison-matrix-selection-ship' : '',
        selectionMode === 'weapon' ? 'alpha-comparison-matrix-selection-weapon' : '',
      ].filter(Boolean).join(' ')}
      aria-label="Threshold comparison matrix"
    >
      {controlStrip ? <div className="alpha-analysis-control-shell">{controlStrip}</div> : null}

      <div className="alpha-comparison-matrix-shell">
          <div className="alpha-comparison-matrix-scroll">
            <div
              className="alpha-comparison-matrix-table"
              style={gridStyle}
              data-weapon-count={orderedWeapons.length}
            >
              <div className="alpha-comparison-matrix-header-row">
                <div className="alpha-comparison-matrix-corner">
                  <p className="alpha-comparison-matrix-corner-label">Chart Controls</p>
                  <p className="alpha-comparison-matrix-corner-copy">
                    Start here: configure ships & weapons to populate the main chart.
                  </p>
                  <div className="alpha-comparison-matrix-corner-controls">
                    <div className="alpha-comparison-matrix-corner-control-row">
                      <button
                        type="button"
                        className={[
                          'alpha-comparison-matrix-corner-pill',
                          'alpha-tool-frame-banner-mode',
                          selectionMode !== 'weapon' ? 'alpha-tool-frame-banner-mode-active' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={onOpenShips}
                      >
                        Ships
                      </button>
                      <button
                        type="button"
                        className={[
                          'alpha-comparison-matrix-corner-pill',
                          'alpha-tool-frame-banner-mode',
                          selectionMode === 'weapon' ? 'alpha-tool-frame-banner-mode-active' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={onOpenWeapons}
                      >
                        Weapons
                      </button>
                    </div>
                    <div
                      className="alpha-comparison-matrix-corner-control-row alpha-comparison-matrix-corner-control-row-shield"
                      role="group"
                      aria-label="Shield mode"
                    >
                      <button
                        type="button"
                        className={[
                          'alpha-comparison-matrix-corner-pill',
                          'alpha-tool-frame-banner-mode',
                          'alpha-comparison-matrix-shield-toggle',
                          shieldMode === 'up'
                            ? 'alpha-comparison-matrix-shield-toggle-up'
                            : 'alpha-comparison-matrix-shield-toggle-down',
                        ].join(' ')}
                        aria-pressed={shieldMode === 'up'}
                        onClick={() => onShieldModeChange(shieldMode === 'up' ? 'down' : 'up')}
                      >
                        Shield:
                        <span
                          className={[
                            'alpha-comparison-matrix-shield-toggle-state',
                            shieldMode === 'up'
                              ? 'alpha-comparison-matrix-shield-toggle-state-active'
                              : '',
                          ].join(' ')}
                        >
                          {' '}
                          On
                        </span>
                        {' / '}
                        <span
                          className={[
                            'alpha-comparison-matrix-shield-toggle-state',
                            shieldMode === 'down'
                              ? 'alpha-comparison-matrix-shield-toggle-state-active'
                              : '',
                          ].join(' ')}
                        >
                          Off
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {orderedWeapons.map((selection) => {
                  const isActive = activeColumnId === selection.slotId
                  const columnIndex = orderedWeapons.findIndex(
                    (entry) => entry.slotId === selection.slotId
                  )
                  const placeholderWeapon = isPlaceholderWeapon(selection)
                  const isDestinationColumn =
                    selectionMode === 'weapon' && columnIndex === activeWeaponDestinationIndex
                  const panelToneClass =
                    `alpha-comparison-matrix-panel-tone-${DESTINATION_TONES[columnIndex % DESTINATION_TONES.length]}`
                  const destinationToneClass = isDestinationColumn
                    ? `alpha-comparison-matrix-destination-${activeWeaponTone}`
                    : ''

                  return (
                    <header
                      key={selection.slotId}
                      className={[
                        'alpha-comparison-matrix-weapon-header',
                        panelToneClass,
                        placeholderWeapon ? 'alpha-comparison-matrix-panel-placeholder' : '',
                        isActive ? 'alpha-comparison-matrix-weapon-header-active' : '',
                        isDestinationColumn ? 'alpha-comparison-matrix-destination-column' : '',
                        destinationToneClass,
                      ].filter(Boolean).join(' ')}
                      data-col-index={columnIndex}
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
                      onClick={() => {
                        if (onOpenWeaponsAt) {
                          onOpenWeaponsAt(columnIndex)
                          return
                        }
                        onOpenWeapons()
                      }}
                    >
                      <p className="alpha-comparison-matrix-weapon-eyebrow">
                        {placeholderWeapon
                          ? 'Armor'
                          : selection.weapon.damageType === 'ballistic'
                            ? 'Ballistic'
                            : 'Energy'}
                      </p>
                      <h3 className="alpha-comparison-matrix-weapon-name">
                        {placeholderWeapon ? 'Armor' : formatEntityLabel(selection.weapon.name)}
                      </h3>
                      <p className="alpha-comparison-matrix-weapon-meta">
                        {placeholderWeapon
                          ? 'T0 A0'
                          : `${formatWeaponClassLabel(selection.weapon.weaponClass)} - ${getVelocityLabel(selection)}`}
                      </p>
                      <div className="alpha-comparison-matrix-weapon-actions">
                        {placeholderWeapon ? null : (
                          <>
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
                          </>
                        )}
                      </div>
                    </header>
                  )
                })}
              </div>

              <div className="alpha-comparison-matrix-body">
                {visibleShips.map((ship) => {
                  const rowActive = activeRowId === ship.id
                  const rowIndex = visibleShips.findIndex((entry) => entry.id === ship.id)
                  const placeholderShip = isPlaceholderShip(ship)
                  const isDestinationRow =
                    selectionMode === 'ship' && rowIndex === activeShipDestinationIndex
                  const rowPanelToneClass =
                    `alpha-comparison-matrix-panel-tone-${DESTINATION_TONES[rowIndex % DESTINATION_TONES.length]}`
                  const destinationToneClass = isDestinationRow
                    ? `alpha-comparison-matrix-destination-${activeShipTone}`
                    : ''
                  const blurPlaceholderIdentity =
                    selectionMode === 'ship' && isDestinationRow && placeholderShip
                  const durability = getShipDurabilityBreakdown(ship)

                  return (
                    <div
                      key={ship.id}
                      className={[
                        'alpha-comparison-matrix-row',
                        rowActive ? 'alpha-comparison-matrix-row-active' : '',
                        isDestinationRow ? 'alpha-comparison-matrix-destination-row' : '',
                      ].filter(Boolean).join(' ')}
                      data-row-index={rowIndex}
                      onPointerEnter={() => setActiveRowId(ship.id)}
                      onPointerLeave={() =>
                        setActiveRowId((current) => (current === ship.id ? null : current))
                      }
                      onFocusCapture={() => setActiveRowId(ship.id)}
                      onBlurCapture={() =>
                        setActiveRowId((current) => (current === ship.id ? null : current))
                      }
                    >
                      <article
                        className={[
                          'alpha-comparison-matrix-ship-card',
                          rowPanelToneClass,
                          placeholderShip ? 'alpha-comparison-matrix-panel-placeholder' : '',
                          blurPlaceholderIdentity
                            ? 'alpha-comparison-matrix-placeholder-identity-blur'
                            : '',
                          destinationToneClass,
                        ].filter(Boolean).join(' ')}
                        onClick={() => {
                          if (onOpenShipsAt) {
                            onOpenShipsAt(rowIndex)
                            return
                          }
                          onOpenShips()
                        }}
                      >
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
                              {placeholderShip ? 'Manu' : 'Manufacturer'}
                            </p>
                            <h3 className="alpha-comparison-matrix-ship-name">
                              {placeholderShip ? 'Select' : formatEntityLabel(ship.name)}
                            </h3>
                            {placeholderShip ? null : (
                              <p className="alpha-comparison-matrix-ship-summary">
                                {getShipSummaryLine(ship)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="alpha-comparison-matrix-ship-durability">
                          <div className="alpha-comparison-matrix-ship-durability-head">
                            <p className="alpha-comparison-matrix-ship-section-label">
                              Durability Mix
                            </p>
                            <p className="alpha-comparison-matrix-ship-durability-copy">
                              {placeholderShip
                                ? '50 / 50'
                                : `Armor ${Math.round(durability.armorPercent)}% • Hull ${Math.round(durability.hullPercent)}%`}
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
                                <dd>{placeholderShip ? 'N/A' : getCompactMetricLabel(ship.navSpeed)}</dd>
                              </div>
                              <div className="alpha-comparison-matrix-ship-stat-row">
                                <dt>SCM</dt>
                                <dd>{placeholderShip ? 'N/A' : getCompactMetricLabel(ship.scmSpeed)}</dd>
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
                                <dd>{placeholderShip ? 'N/A' : formatMetric(ship.armorHp)}</dd>
                              </div>
                              <div className="alpha-comparison-matrix-ship-stat-row">
                                <dt>Hull HP</dt>
                                <dd>{placeholderShip ? 'N/A' : formatMetric(ship.vitalHp)}</dd>
                              </div>
                            </dl>
                          </section>
                        </div>
                      </article>

                      {orderedWeapons.map((selection) => {
                        const columnIndex = orderedWeapons.findIndex(
                          (entry) => entry.slotId === selection.slotId
                        )
                        const isDestinationColumn =
                          selectionMode === 'weapon' && columnIndex === activeWeaponDestinationIndex
                        const columnToneClass = isDestinationColumn
                          ? `alpha-comparison-matrix-destination-${activeWeaponTone}`
                          : ''
                        const model = cellModels.get(
                          `${ship.id}:${selection.slotId}`
                        ) as MatrixCellModel
                        const activeResult: MatrixEstimateView =
                          shieldMode === 'up' ? model.shieldsOn : model.shieldsOff
                        const columnActive = activeColumnId === selection.slotId
                        const shieldBlocked =
                          shieldMode === 'up' && selection.weapon.damageType === 'energy'
                        const placeholderWeapon = isPlaceholderWeapon(selection)
                        const placeholderCell = placeholderShip || placeholderWeapon
                        const isPrimaryShieldBlockedPanel =
                          shieldBlocked && firstEnergyColumnIndex !== -1 && columnIndex === firstEnergyColumnIndex && rowIndex === 0

                        return (
                          <article
                            key={`${ship.id}:${selection.slotId}`}
                            className={[
                              'alpha-comparison-matrix-cell',
                              `alpha-comparison-matrix-cell-${activeResult.tone}`,
                              placeholderCell ? 'alpha-comparison-matrix-panel-placeholder' : '',
                              columnActive ? 'alpha-comparison-matrix-cell-column-active' : '',
                              shieldBlocked ? 'alpha-comparison-matrix-cell-shield-blocked' : '',
                              shieldBlocked && !isPrimaryShieldBlockedPanel
                                ? 'alpha-comparison-matrix-cell-shield-blocked-muted'
                                : '',
                              isDestinationRow ? 'alpha-comparison-matrix-destination-row-cell' : '',
                              isDestinationColumn
                                ? 'alpha-comparison-matrix-destination-column-cell'
                                : '',
                              columnToneClass || destinationToneClass,
                            ].filter(Boolean).join(' ')}
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
                            tabIndex={isPlaceholderPreview ? -1 : 0}
                          >
                            <div className="alpha-comparison-matrix-cell-content" aria-hidden={shieldBlocked}>
                              {placeholderCell ? (
                                <>
                                  <div className="alpha-comparison-matrix-cell-head">
                                    <p className="alpha-comparison-matrix-cell-state">Armor</p>
                                    <p className="alpha-comparison-matrix-cell-summary">Armor Dmg at 0%</p>
                                  </div>
                                  <div className="alpha-comparison-matrix-cell-inline-metrics">
                                    <span>
                                      <strong>T</strong>0
                                    </span>
                                    <span>
                                      <strong>A</strong>0
                                    </span>
                                  </div>
                                  <div className="alpha-comparison-matrix-cell-chart">
                                    <div className="alpha-comparison-matrix-cell-track-scale">
                                      <span>100% armor</span>
                                      <span>0% armor</span>
                                    </div>
                                    <div
                                      className="alpha-comparison-matrix-cell-track"
                                      aria-label="Armor placeholder threshold marker"
                                    >
                                      <div className="alpha-comparison-matrix-cell-track-fill" />
                                      <span
                                        className="alpha-comparison-matrix-cell-marker"
                                        style={{ left: '100%' }}
                                      />
                                    </div>
                                    <div className="alpha-comparison-matrix-cell-track-caption-row">
                                      <span
                                        className="alpha-comparison-matrix-cell-track-caption alpha-comparison-matrix-cell-track-caption-end"
                                        style={{ left: '100%' }}
                                      >
                                        Damage start
                                      </span>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
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
                                </>
                              )}
                            </div>

                            {isPrimaryShieldBlockedPanel ? (
                              <div
                                className="alpha-comparison-matrix-cell-overlay alpha-comparison-matrix-cell-overlay-interactive"
                                aria-label="Turn Shields Off for Armor vs Energy"
                              >
                                <p className="alpha-comparison-matrix-cell-overlay-copy">
                                  Turn Shields{' '}
                                  <button
                                    type="button"
                                    className="alpha-comparison-matrix-cell-overlay-action"
                                    onClick={(event) => {
                                      event.preventDefault()
                                      event.stopPropagation()
                                      onShieldModeChange('down')
                                    }}
                                  >
                                    Off
                                  </button>{' '}
                                  for Armor vs Energy
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
    </section>
  )
}


