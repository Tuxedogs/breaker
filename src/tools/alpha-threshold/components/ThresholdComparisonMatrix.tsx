import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

import {
  estimateArmorInteraction,
  formatEntityLabel,
  formatMetric,
} from '../lib/calculations'
import { getShipThumbnailCandidates } from '../lib/ships/thumbnail'
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
  /** Matrix weapon header chips: open overlay with filter (not main-board analysis strip) */
  onWeaponHeaderChipClick?: (payload: {
    columnIndex: number
    chip: ArmorInteractionFilterChip
  }) => void
  onOpenWeapons: () => void
  onOpenShips: () => void
  onOpenWeaponsAt?: (slotIndex: number, autoAdvance?: boolean) => void
  onOpenShipsAt?: (slotIndex: number, autoAdvance?: boolean) => void
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

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/** 0–100 effective armor damage start % (same basis as E label). */
function getPenetrationEffectivePercent(estimate: ArmorInteractionEstimate): number {
  if (!estimate.damagesFreshArmor && estimate.armorDamageStartsAtPercent == null) return 0
  if (estimate.damagesFreshArmor || estimate.armorDamageStartsAtPercent === 100) return 100
  return Math.round(estimate.armorDamageStartsAtPercent ?? 0)
}

/**
 * E100 = green; E75–E99 = yellow; E50–E74 = yellow→orange; E1–E49 = orange→dark red; E0 = dark red.
 * Only E100 uses green; any value below 100 is not green.
 */
function getEffectivePenetrationSummaryColor(pct: number): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)))

  if (p >= 100) {
    return 'rgb(74 222 128)'
  }
  if (p >= 75) {
    const t = (p - 75) / 24
    const h = lerp(43, 52, t)
    const s = lerp(86, 92, t)
    const l = lerp(46, 56, t)
    return `hsl(${h} ${s}% ${l}%)`
  }
  if (p >= 50) {
    const t = (p - 50) / 25
    const h = lerp(26, 45, t)
    const s = lerp(90, 86, t)
    const l = lerp(48, 46, t)
    return `hsl(${h} ${s}% ${l}%)`
  }
  if (p >= 1) {
    const t = (p - 1) / 48
    const h = lerp(0, 22, t)
    const s = lerp(62, 88, t)
    const l = lerp(28, 48, t)
    return `hsl(${h} ${s}% ${l}%)`
  }
  return 'hsl(0 58% 28%)'
}

/** E = Effective (armor damage start %). E100 = 100%, E41 = 41%, etc. */
function getEstimatePenetrationLabel(estimate: ArmorInteractionEstimate) {
  return `E${getPenetrationEffectivePercent(estimate)}`
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
    penetrationEffectivePercent: getPenetrationEffectivePercent(estimate),
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

function getShipRoleLabel(ship: Ship) {
  const raw = ship.role?.trim()
  if (!raw) return '—'
  return formatEntityLabel(raw)
}

function getMatrixGridStyle(columnCount: number): CSSProperties {
  return {
    ['--alpha-matrix-columns' as string]: `minmax(var(--alpha-matrix-ship-width), var(--alpha-matrix-ship-width)) repeat(${columnCount}, minmax(var(--alpha-matrix-weapon-min-width), 1fr))`,
    ['--alpha-matrix-min-width' as string]: `calc(var(--alpha-matrix-ship-width) + (${columnCount} * var(--alpha-matrix-weapon-min-width)) + (${columnCount} * var(--alpha-matrix-gap)))`,
  }
}

function MatrixShipThumbnail({
  ship,
  layout = 'inline',
}: {
  ship: Ship
  layout?: 'inline' | 'fill'
}) {
  const candidates = useMemo(
    () => getShipThumbnailCandidates(ship),
    [ship.id, ship.imageAlt, ship.imageSrc, ship.manufacturer, ship.name]
  )
  const [candidateIndex, setCandidateIndex] = useState(0)

  useEffect(() => {
    setCandidateIndex(0)
  }, [ship.id, ship.imageSrc, ship.name])

  const current = candidates[Math.min(candidateIndex, candidates.length - 1)]
  const canAdvance = candidateIndex < candidates.length - 1

  const imageClass =
    layout === 'fill'
      ? 'alpha-comparison-matrix-ship-image alpha-comparison-matrix-ship-image--fill'
      : 'alpha-comparison-matrix-ship-image'

  return (
    <img
      className={imageClass}
      src={current.src}
      alt={layout === 'fill' ? '' : current.alt}
      loading="lazy"
      onError={() => {
        if (!canAdvance) return
        setCandidateIndex((value) => Math.min(value + 1, candidates.length - 1))
      }}
    />
  )
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
  onWeaponHeaderChipClick,
  onOpenWeapons,
  onOpenShips,
  onOpenWeaponsAt,
  onOpenShipsAt,
}: Props) {
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null)
  /** Hover/focus anchor: row highlight runs only through this column; column highlight only through this row. */
  const [hoverAnchorRowIndex, setHoverAnchorRowIndex] = useState<number | null>(null)
  const [hoverAnchorColumnIndex, setHoverAnchorColumnIndex] = useState<number | null>(null)
  const [sourceMode, setSourceMode] = useState<'ptu' | 'live'>('ptu')
  const [matrixMode, setMatrixMode] = useState<'analysis' | 'frakk'>('analysis')
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

  useEffect(() => {
    if (selectionMode) {
      setActiveRowId(null)
      setActiveColumnId(null)
      setHoverAnchorRowIndex(null)
      setHoverAnchorColumnIndex(null)
    }
  }, [selectionMode])

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
                <div
                  className="alpha-comparison-matrix-corner"
                  aria-label="Chart and shield controls"
                >
                  <div className="alpha-comparison-matrix-corner-body">
                    <div className="alpha-comparison-matrix-corner-head">
                      <NavLink
                        to="/"
                        end
                        className={({ isActive }) =>
                          [
                            'alpha-comparison-matrix-corner-home',
                            isActive ? 'alpha-comparison-matrix-corner-home-active' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')
                        }
                        aria-label="Home"
                      >
                        <svg aria-hidden viewBox="0 0 24 24" className="alpha-comparison-matrix-corner-home-icon">
                          <path
                            d="M12 4.5 4.5 10.7a1 1 0 1 0 1.3 1.54l.7-.58V19a1 1 0 0 0 1 1h3.8a1 1 0 0 0 1-1v-3.4h1.4V19a1 1 0 0 0 1 1h3.8a1 1 0 0 0 1-1v-7.34l.7.58a1 1 0 1 0 1.3-1.54L12 4.5Z"
                            fill="currentColor"
                          />
                        </svg>
                      </NavLink>
                      <div
                        className="alpha-comparison-matrix-corner-segments alpha-comparison-matrix-corner-head-segments"
                        role="radiogroup"
                        aria-label="Source"
                      >
                        {(
                          [
                            ['ptu', 'PTU'],
                            ['live', 'LIVE'],
                          ] as const
                        ).map(([id, label], i) => (
                          <span key={id} className="alpha-comparison-matrix-corner-seg-wrap">
                            {i > 0 ? (
                              <span className="alpha-comparison-matrix-corner-seg-sep" aria-hidden>
                                |
                              </span>
                            ) : null}
                            <button
                              type="button"
                              className={[
                                'alpha-comparison-matrix-corner-seg',
                                sourceMode === id ? 'alpha-comparison-matrix-corner-seg--active' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              role="radio"
                              aria-checked={sourceMode === id}
                              onClick={() => setSourceMode(id)}
                            >
                              {label}
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="alpha-comparison-matrix-corner-row">
                      <span className="alpha-comparison-matrix-corner-label" id="alpha-matrix-corner-mode-label">
                        Mode
                      </span>
                      <div
                        className="alpha-comparison-matrix-corner-segments"
                        role="radiogroup"
                        aria-labelledby="alpha-matrix-corner-mode-label"
                      >
                        {(
                          [
                            ['analysis', 'Analysis'],
                            ['frakk', 'Frakk'],
                          ] as const
                        ).map(([id, label], i) => (
                          <span key={id} className="alpha-comparison-matrix-corner-seg-wrap">
                            {i > 0 ? (
                              <span className="alpha-comparison-matrix-corner-seg-sep" aria-hidden>
                                |
                              </span>
                            ) : null}
                            <button
                              type="button"
                              className={[
                                'alpha-comparison-matrix-corner-seg',
                                matrixMode === id ? 'alpha-comparison-matrix-corner-seg--active' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              role="radio"
                              aria-checked={matrixMode === id}
                              onClick={() => setMatrixMode(id)}
                            >
                              {label}
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="alpha-comparison-matrix-corner-row">
                      <span className="alpha-comparison-matrix-corner-label" id="alpha-matrix-corner-shield-label">
                        Shields
                      </span>
                      <div
                        className="alpha-comparison-matrix-corner-segments"
                        role="group"
                        aria-labelledby="alpha-matrix-corner-shield-label"
                      >
                        <button
                          type="button"
                          className={[
                            'alpha-comparison-matrix-corner-seg',
                            shieldMode === 'up' ? 'alpha-comparison-matrix-corner-seg--active-shield-on' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          aria-pressed={shieldMode === 'up'}
                          onClick={() => onShieldModeChange('up')}
                        >
                          ON
                        </button>
                        <span className="alpha-comparison-matrix-corner-seg-sep" aria-hidden>
                          /
                        </span>
                        <button
                          type="button"
                          className={[
                            'alpha-comparison-matrix-corner-seg',
                            shieldMode === 'down' ? 'alpha-comparison-matrix-corner-seg--active-shield-off' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          aria-pressed={shieldMode === 'down'}
                          onClick={() => onShieldModeChange('down')}
                        >
                          OFF
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {orderedWeapons.map((selection) => {
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

                  const weaponSlotLabel = selection.slotLabel || `Weapon ${columnIndex + 1}`

                  return (
                    <header
                      key={selection.slotId}
                      className={[
                        'alpha-comparison-matrix-weapon-header',
                        placeholderWeapon ? 'alpha-comparison-matrix-weapon-header-empty' : '',
                        panelToneClass,
                        placeholderWeapon ? 'alpha-comparison-matrix-panel-placeholder' : '',
                        isDestinationColumn ? 'alpha-comparison-matrix-destination-column' : '',
                        destinationToneClass,
                      ].filter(Boolean).join(' ')}
                      data-col-index={columnIndex}
                      aria-label={
                        placeholderWeapon
                          ? `${weaponSlotLabel}, no weapon selected`
                          : formatEntityLabel(selection.weapon.name)
                      }
                      onPointerEnter={() => {
                        if (selectionMode || placeholderWeapon) {
                          setActiveColumnId(null)
                          return
                        }
                        setActiveColumnId(selection.slotId)
                      }}
                      onPointerLeave={() =>
                        setActiveColumnId((current) =>
                          current === selection.slotId ? null : current
                        )
                      }
                      onFocusCapture={() => {
                        if (selectionMode || placeholderWeapon) return
                        setActiveColumnId(selection.slotId)
                      }}
                      onBlurCapture={() =>
                        setActiveColumnId((current) =>
                          current === selection.slotId ? null : current
                        )
                      }
                      onClick={() => {
                        if (onOpenWeaponsAt) {
                          onOpenWeaponsAt(columnIndex, true)
                          return
                        }
                        onOpenWeapons()
                      }}
                    >
                      {placeholderWeapon ? (
                        <div className="alpha-comparison-matrix-weapon-empty">
                          <p className="alpha-comparison-matrix-weapon-empty-label">
                            {weaponSlotLabel}
                          </p>
                          <p className="alpha-comparison-matrix-weapon-empty-hint">Select weapon</p>
                        </div>
                      ) : (
                        <div className="alpha-comparison-matrix-weapon-header-body">
                          <h3 className="alpha-comparison-matrix-weapon-name">
                            {formatEntityLabel(selection.weapon.name)}
                          </h3>
                          <p className="alpha-comparison-matrix-weapon-meta">
                            {`${formatWeaponClassLabel(selection.weapon.weaponClass)} - ${getVelocityLabel(selection)}`}
                          </p>
                          <div className="alpha-comparison-matrix-weapon-actions">
                            <button
                              type="button"
                              className="alpha-comparison-matrix-chip"
                              onClick={(event) => {
                                event.stopPropagation()
                                onWeaponHeaderChipClick?.({
                                  columnIndex,
                                  chip: {
                                    kind: 'damageType',
                                    slotId: selection.slotId,
                                    label:
                                      selection.weapon.damageType === 'ballistic'
                                        ? 'Ballistic'
                                        : 'Energy',
                                    value: selection.weapon.damageType,
                                  },
                                })
                              }}
                            >
                              {selection.weapon.damageType === 'ballistic'
                                ? 'Ballistic'
                                : 'Energy'}
                            </button>
                            <button
                              type="button"
                              className="alpha-comparison-matrix-chip"
                              onClick={(event) => {
                                event.stopPropagation()
                                onWeaponHeaderChipClick?.({
                                  columnIndex,
                                  chip: {
                                    kind: 'weaponClass',
                                    slotId: selection.slotId,
                                    label: formatWeaponClassLabel(selection.weapon.weaponClass),
                                    value: selection.weapon.weaponClass,
                                  },
                                })
                              }}
                            >
                              {formatWeaponClassLabel(selection.weapon.weaponClass)}
                            </button>
                          </div>
                        </div>
                      )}
                    </header>
                  )
                })}
              </div>

              <div className="alpha-comparison-matrix-body">
                {visibleShips.map((ship) => {
                  const rowIndex = visibleShips.findIndex((entry) => entry.id === ship.id)
                  const placeholderShip = isPlaceholderShip(ship)
                  const isDestinationRow =
                    selectionMode === 'ship' && rowIndex === activeShipDestinationIndex
                  const rowPanelToneClass =
                    `alpha-comparison-matrix-panel-tone-${DESTINATION_TONES[rowIndex % DESTINATION_TONES.length]}`
                  const destinationToneClass = isDestinationRow
                    ? `alpha-comparison-matrix-destination-${activeShipTone}`
                    : ''
                  const shipSlotLabel = `Ship ${rowIndex + 1}`

                  return (
                    <div
                      key={ship.id}
                      className="alpha-comparison-matrix-row"
                      data-row-index={rowIndex}
                      onPointerEnter={() => {
                        if (selectionMode || placeholderShip) {
                          setActiveRowId(null)
                          return
                        }
                        setActiveRowId(ship.id)
                      }}
                      onPointerLeave={() => {
                        setActiveRowId((current) => (current === ship.id ? null : current))
                        setHoverAnchorRowIndex(null)
                        setHoverAnchorColumnIndex(null)
                      }}
                      onFocusCapture={() => {
                        if (selectionMode || placeholderShip) return
                        setActiveRowId(ship.id)
                      }}
                      onBlurCapture={() => {
                        setActiveRowId((current) => (current === ship.id ? null : current))
                        setHoverAnchorRowIndex(null)
                        setHoverAnchorColumnIndex(null)
                      }}
                    >
                      <article
                        className={[
                          'alpha-comparison-matrix-ship-card',
                          placeholderShip ? 'alpha-comparison-matrix-ship-card-empty' : '',
                          !placeholderShip ? 'alpha-comparison-matrix-ship-card--fill' : '',
                          rowPanelToneClass,
                          placeholderShip ? 'alpha-comparison-matrix-panel-placeholder' : '',
                          destinationToneClass,
                        ].filter(Boolean).join(' ')}
                        aria-label={
                          placeholderShip
                            ? `${shipSlotLabel}, no ship selected`
                            : `${formatEntityLabel(ship.name)}`
                        }
                        onClick={() => {
                          if (onOpenShipsAt) {
                            onOpenShipsAt(rowIndex, true)
                            return
                          }
                          onOpenShips()
                        }}
                      >
                        {placeholderShip ? (
                          <div className="alpha-comparison-matrix-ship-empty">
                            <p className="alpha-comparison-matrix-ship-empty-label">{shipSlotLabel}</p>
                            <p className="alpha-comparison-matrix-ship-empty-hint">Select ship</p>
                          </div>
                        ) : (
                          <>
                            <div className="alpha-comparison-matrix-ship-card-body">
                              <div className="alpha-comparison-matrix-ship-fill" aria-hidden="true">
                                {ship.name ? (
                                  <MatrixShipThumbnail ship={ship} layout="fill" />
                                ) : (
                                  <div
                                    className="alpha-comparison-matrix-ship-image-fallback alpha-comparison-matrix-ship-image-fallback--fill"
                                    aria-hidden="true"
                                  >
                                    {formatEntityLabel(ship.manufacturer).slice(0, 2)}
                                  </div>
                                )}
                                <div className="alpha-comparison-matrix-ship-fill-scrim" />
                              </div>

                              <div className="alpha-comparison-matrix-ship-foreground">
                              <div className="alpha-comparison-matrix-ship-header">
                                <div className="alpha-comparison-matrix-ship-copy">
                                  <p className="alpha-comparison-matrix-ship-eyebrow">
                                    {formatEntityLabel(ship.manufacturer).trim() || '—'}
                                  </p>
                                  <h3 className="alpha-comparison-matrix-ship-name">
                                    {formatEntityLabel(ship.name)}
                                  </h3>
                                  <p className="alpha-comparison-matrix-ship-summary">
                                    {getShipRoleLabel(ship)}
                                  </p>
                                </div>
                              </div>

                              <div
                                className="alpha-comparison-matrix-ship-durability-spacer"
                                aria-hidden="true"
                              />

                            <div className="alpha-comparison-matrix-ship-sections">
                              <section
                                className="alpha-comparison-matrix-ship-section"
                                aria-label="Flight stats"
                              >
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
                                <p className="alpha-comparison-matrix-ship-section-label">
                                  Durability
                                </p>
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
                            </div>
                            </div>
                          </>
                        )}
                      </article>

                      {orderedWeapons.map((selection) => {
                        const columnIndex = orderedWeapons.findIndex(
                          (entry) => entry.slotId === selection.slotId
                        )
                        const placeholderWeapon = isPlaceholderWeapon(selection)
                        const placeholderCell = placeholderShip || placeholderWeapon
                        const isDestinationColumnForCells =
                          selectionMode === 'weapon' &&
                          columnIndex === activeWeaponDestinationIndex &&
                          !placeholderWeapon
                        const columnToneClass =
                          isDestinationColumnForCells
                            ? `alpha-comparison-matrix-destination-${activeWeaponTone}`
                            : ''
                        const model = cellModels.get(
                          `${ship.id}:${selection.slotId}`
                        ) as MatrixCellModel
                        const activeResult: MatrixEstimateView =
                          shieldMode === 'up' ? model.shieldsOn : model.shieldsOff
                        const rowSegmentActive =
                          activeRowId === ship.id &&
                          !placeholderShip &&
                          !selectionMode &&
                          !placeholderCell &&
                          (hoverAnchorColumnIndex === null ||
                            columnIndex <= hoverAnchorColumnIndex)
                        const columnSegmentActive =
                          activeColumnId === selection.slotId &&
                          !placeholderCell &&
                          !selectionMode &&
                          hoverAnchorRowIndex !== null &&
                          rowIndex <= hoverAnchorRowIndex
                        const shieldBlocked =
                          shieldMode === 'up' && selection.weapon.damageType === 'energy'
                        const isPrimaryShieldBlockedPanel =
                          shieldBlocked && firstEnergyColumnIndex !== -1 && columnIndex === firstEnergyColumnIndex && rowIndex === 0
                        const isHoverAnchorCell = rowSegmentActive && columnSegmentActive

                        return (
                          <article
                            key={`${ship.id}:${selection.slotId}`}
                            className={[
                              'alpha-comparison-matrix-cell',
                              rowIndex === 0 && columnIndex === 0 ? 'alpha-matrix-first-cell-anchor' : '',
                              `alpha-comparison-matrix-cell-${activeResult.tone}`,
                              placeholderCell ? 'alpha-comparison-matrix-panel-placeholder' : '',
                              rowSegmentActive ? 'alpha-comparison-matrix-cell-row-active' : '',
                              columnSegmentActive ? 'alpha-comparison-matrix-cell-column-active' : '',
                              isHoverAnchorCell ? 'alpha-comparison-matrix-cell-hover-anchor' : '',
                              selectionMode &&
                              !placeholderCell &&
                              isDestinationColumnForCells
                                ? 'alpha-comparison-matrix-cell-destination-active'
                                : '',
                              shieldBlocked ? 'alpha-comparison-matrix-cell-shield-blocked' : '',
                              shieldBlocked && !isPrimaryShieldBlockedPanel
                                ? 'alpha-comparison-matrix-cell-shield-blocked-muted'
                                : '',
                              !placeholderCell && isDestinationColumnForCells
                                ? 'alpha-comparison-matrix-destination-column-cell'
                                : '',
                              columnToneClass,
                            ].filter(Boolean).join(' ')}
                            style={
                              isHoverAnchorCell
                                ? ({
                                    '--alpha-matrix-effectiveness-accent':
                                      getEffectivePenetrationSummaryColor(
                                        activeResult.penetrationEffectivePercent
                                      ),
                                  } as CSSProperties)
                                : undefined
                            }
                            onPointerEnter={() => {
                              if (selectionMode || placeholderCell) {
                                setActiveColumnId(null)
                                setHoverAnchorRowIndex(null)
                                setHoverAnchorColumnIndex(null)
                                return
                              }
                              setActiveRowId(ship.id)
                              setActiveColumnId(selection.slotId)
                              setHoverAnchorRowIndex(rowIndex)
                              setHoverAnchorColumnIndex(columnIndex)
                            }}
                            onPointerLeave={() => {
                              setActiveColumnId((current) =>
                                current === selection.slotId ? null : current
                              )
                              setHoverAnchorRowIndex(null)
                              setHoverAnchorColumnIndex(null)
                            }}
                            onFocusCapture={() => {
                              if (selectionMode || placeholderCell) return
                              setActiveRowId(ship.id)
                              setActiveColumnId(selection.slotId)
                              setHoverAnchorRowIndex(rowIndex)
                              setHoverAnchorColumnIndex(columnIndex)
                            }}
                            onBlurCapture={() => {
                              setActiveColumnId((current) =>
                                current === selection.slotId ? null : current
                              )
                              setHoverAnchorRowIndex(null)
                              setHoverAnchorColumnIndex(null)
                            }}
                            tabIndex={isPlaceholderPreview ? -1 : 0}
                            onClick={() => {
                              if (selectionMode === 'ship' && onOpenShipsAt) {
                                onOpenShipsAt(rowIndex)
                                return
                              }
                              if (selectionMode === 'weapon' && onOpenWeaponsAt) {
                                onOpenWeaponsAt(columnIndex)
                              }
                            }}
                          >
                            <div className="alpha-comparison-matrix-cell-content" aria-hidden={shieldBlocked}>
                              {placeholderCell ? (
                                <>
                                  <div className="alpha-comparison-matrix-cell-meta-row">
                                    <p className="alpha-comparison-matrix-cell-state alpha-comparison-matrix-cell-detail-blur">Armor</p>
                                  </div>
                                  <div className="alpha-comparison-matrix-cell-title-row">
                                    <p
                                      className="alpha-comparison-matrix-cell-summary alpha-comparison-matrix-cell-detail-blur"
                                      style={{
                                        color: getEffectivePenetrationSummaryColor(0),
                                      }}
                                    >
                                      E0
                                    </p>
                                    <div className="alpha-comparison-matrix-cell-inline-metrics alpha-comparison-matrix-cell-detail-blur">
                                      <span>
                                        <strong>T</strong>0
                                      </span>
                                      <span>
                                        <strong>A</strong>0
                                      </span>
                                    </div>
                                  </div>
                                  <div className="alpha-comparison-matrix-cell-chart">
                                    <div className="alpha-comparison-matrix-cell-track-scale alpha-comparison-matrix-cell-detail-blur">
                                      <span>100% armor</span>
                                      <span>0% armor</span>
                                    </div>
                                    <div
                                      className="alpha-comparison-matrix-cell-track alpha-comparison-matrix-cell-detail-blur"
                                      aria-label="Armor placeholder threshold marker"
                                    >
                                      <div className="alpha-comparison-matrix-cell-track-fill alpha-comparison-matrix-cell-detail-blur" />
                                      <span
                                        className="alpha-comparison-matrix-cell-marker"
                                        style={{ left: '100%' }}
                                      />
                                    </div>
                                    <div className="alpha-comparison-matrix-cell-track-caption-row">
                                      <span
                                        className="alpha-comparison-matrix-cell-track-caption alpha-comparison-matrix-cell-track-caption-end alpha-comparison-matrix-cell-detail-blur"
                                        style={{ left: '100%' }}
                                      >
                                        Damage start
                                      </span>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="alpha-comparison-matrix-cell-meta-row">
                                    <p className="alpha-comparison-matrix-cell-state alpha-comparison-matrix-cell-detail-blur">
                                      {activeResult.stateLabel}
                                    </p>
                                    <p className="alpha-comparison-matrix-cell-shield-chip">
                                      {activeResult.shieldChipLabel}
                                    </p>
                                  </div>
                                  <div className="alpha-comparison-matrix-cell-title-row">
                                    <p
                                      className="alpha-comparison-matrix-cell-summary alpha-comparison-matrix-cell-detail-blur"
                                      style={{
                                        color: getEffectivePenetrationSummaryColor(
                                          activeResult.penetrationEffectivePercent
                                        ),
                                      }}
                                    >
                                      {activeResult.penetrationLabel}
                                    </p>
                                    <div className="alpha-comparison-matrix-cell-inline-metrics alpha-comparison-matrix-cell-detail-blur">
                                      <span>
                                        <strong>T</strong>
                                        {formatMetric(activeResult.estimate.deflectionThreshold)}
                                      </span>
                                      <span>
                                        <strong>A</strong>
                                        {formatMetric(activeResult.estimate.effectiveArmorAlpha)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="alpha-comparison-matrix-cell-chart">
                                    <div className="alpha-comparison-matrix-cell-track-scale alpha-comparison-matrix-cell-detail-blur">
                                      <span>100% armor</span>
                                      <span>0% armor</span>
                                    </div>
                                    <div
                                      className="alpha-comparison-matrix-cell-track alpha-comparison-matrix-cell-detail-blur"
                                      aria-label={`${activeResult.penetrationLabel} threshold marker`}
                                    >
                                      <div className="alpha-comparison-matrix-cell-track-fill alpha-comparison-matrix-cell-detail-blur" />
                                      <span
                                        className="alpha-comparison-matrix-cell-marker"
                                        style={{ left: `${activeResult.markerPercent}%` }}
                                      />
                                    </div>
                                    <div className="alpha-comparison-matrix-cell-track-caption-row">
                                      <span
                                        className={`alpha-comparison-matrix-cell-track-caption alpha-comparison-matrix-cell-track-caption-${activeResult.markerAlign} alpha-comparison-matrix-cell-detail-blur`}
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


