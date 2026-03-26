import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FocusEvent, PointerEvent, ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

import {
  estimateArmorInteraction,
  formatEntityLabel,
  formatMetric,
} from '../lib/calculations'
import {
  buildWeaponRecommendations,
  evaluateWeaponRecommendation,
  isThresholdRecommendationWeapon,
  sortWeaponRecommendations,
  type WeaponRecommendation,
} from '../lib/recommendations'
import { getShipThumbnailCandidates } from '../lib/ships/thumbnail'
import { formatWeaponClassLabel, formatWeaponTypeLabel } from '../lib/weapons/normalize'
import type {
  ArmorInteractionEstimate,
  DefenseShieldState,
  SelectedWeaponComparison,
  Ship,
  WeaponRecord,
} from '../types'
import type { ArmorInteractionFilterChip } from './ArmorInteractionSummaryPanel'
import { HeatmapTooltip } from './HeatmapTooltip'
import { MobileThresholdComparisonLayout } from './MobileThresholdComparisonLayout'

type Props = {
  controlStrip?: ReactNode
  ships: Ship[]
  selectedWeapons: SelectedWeaponComparison[]
  allWeapons: WeaponRecord[]
  shieldMode: DefenseShieldState
  matrixMode: 'analysis' | 'target'
  hideHeaderRow?: boolean
  selectionMode: 'ship' | 'weapon' | null
  nextShipSlotIndex: number
  nextWeaponSlotIndex: number
  onShieldModeChange: (mode: DefenseShieldState) => void
  onMatrixModeChange: (mode: 'analysis' | 'target') => void
  targetWeaponFilterPreset?: ArmorInteractionFilterChip | null
  onTargetWeaponFilterPresetChange?: (chip: ArmorInteractionFilterChip | null) => void
  targetWeaponSizeFilter?: number | null
  onTargetWeaponSizeFilterChange?: (size: number | null) => void
  onOpenWeapons: () => void
  onOpenShips: () => void
  onOpenWeaponsAt?: (slotIndex: number, autoAdvance?: boolean) => void
  onOpenShipsAt?: (slotIndex: number, autoAdvance?: boolean) => void
  /** First-visit tour: spotlight matrix controls */
  onboardingHighlight?: 'ship-weapon' | 'shield' | null
}

type MatrixCellModel = ReturnType<typeof buildMatrixCellModel>
type MatrixEstimateView = ReturnType<typeof buildEstimateViewModel>
type MatrixColumnModel = {
  columnIndex: number
  key: string
  slotLabel: string
  selection: SelectedWeaponComparison | null
  placeholderWeapon: boolean
}

const DESTINATION_TONES = ['cyan', 'violet', 'amber', 'emerald'] as const
const TARGET_RECOMMENDATION_COLUMN_COUNT = 6

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

/** 0-100 effective armor damage start % (same basis as E label). */
function getPenetrationEffectivePercent(estimate: ArmorInteractionEstimate): number {
  if (!estimate.damagesFreshArmor && estimate.armorDamageStartsAtPercent == null) return 0
  if (estimate.damagesFreshArmor || estimate.armorDamageStartsAtPercent === 100) return 100
  return Math.round(estimate.armorDamageStartsAtPercent ?? 0)
}

/**
 * E100 = green; E75-E99 = yellow; E50-E74 = yellow->orange; E1-E49 = orange->dark red; E0 = dark red.
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

function getDamageTypeLabel(value: string) {
  return value === 'energy' ? 'Energy' : 'Ballistic'
}

function shouldKeepTargetRecommendation(
  recommendation: WeaponRecommendation,
  targetWeaponFilterPreset?: ArmorInteractionFilterChip | null,
  targetWeaponSizeFilter?: number | null
) {
  if (
    targetWeaponFilterPreset?.kind === 'damageType' &&
    targetWeaponFilterPreset.value === 'energy' &&
    targetWeaponSizeFilter === 2
  ) {
    const normalizedName = recommendation.weapon.name.trim().toLowerCase()
    return normalizedName.includes('ardor') || normalizedName.includes('attrition')
  }

  return true
}

function matchesTargetRecommendationAllowlist(weaponName: string) {
  const normalizedName = weaponName.trim().toLowerCase()

  return (
    normalizedName.includes('nn-') ||
    normalizedName.includes('ardor') ||
    normalizedName.includes('attrition') ||
    /\bm[2-7]a\b/.test(normalizedName) ||
    normalizedName.includes('whip') ||
    normalizedName.includes('warlord') ||
    normalizedName.includes('absolution') ||
    normalizedName.includes('sf7b')
  )
}

function shouldIncludeTargetAllowlistWeapon(weapon: WeaponRecord) {
  if (!matchesTargetRecommendationAllowlist(weapon.name)) return false

  if (weapon.size !== 2) return true

  const normalizedName = weapon.name.trim().toLowerCase()
  return normalizedName.includes('ardor') || normalizedName.includes('attrition')
}

function buildTargetRecommendationPool(ship: Ship, allWeapons: WeaponRecord[]) {
  const baseRecommendations = buildWeaponRecommendations(ship, allWeapons)
  const thresholdWeapons = allWeapons.filter(isThresholdRecommendationWeapon)
  const maxAlpha = Math.max(...thresholdWeapons.map((weapon) => weapon.alpha ?? 0), 0)
  const maxSpeed = Math.max(...thresholdWeapons.map((weapon) => weapon.projectileSpeed ?? 0), 0)
  const allowlistedRecommendations = thresholdWeapons
    .filter(shouldIncludeTargetAllowlistWeapon)
    .map((weapon) =>
      evaluateWeaponRecommendation(ship, weapon, maxAlpha, maxSpeed, {
        ignoreExclusions: true,
      })
    )
    .filter((recommendation): recommendation is WeaponRecommendation => Boolean(recommendation))

  return [...baseRecommendations, ...allowlistedRecommendations]
    .filter(
      (recommendation, index, recommendations) =>
        recommendations.findIndex((entry) => entry.weapon.id === recommendation.weapon.id) === index
    )
    .sort(sortWeaponRecommendations)
}

function getTargetRecommendationRating(recommendation: WeaponRecommendation) {
  return `E${recommendation.firstPenetrationArmorPercent ?? 0}`
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

type MatrixTooltipLine = {
  label: string
  value: string
  tone?: 'immediate' | 'cyan' | 'danger' | 'amber'
  kind?: 'section'
  pills?: string[]
}

function capitalizeConfidence(c: ArmorInteractionEstimate['confidence']): string {
  return `${c.charAt(0).toUpperCase()}${c.slice(1)}`
}

function buildMatrixCellTooltipLines(estimate: ArmorInteractionEstimate): MatrixTooltipLine[] {
  const notes = estimate.notes ?? []

  return [
    {
      label: 'Pills',
      value: '',
      pills: ['T', 'A'],
    },
    {
      label: 'Shields',
      value: 'Ballistic threshold is affected\nby shields, lowering the E rating.',
    },
    {
      label: 'Confidence',
      value: capitalizeConfidence(estimate.confidence),
    },
    {
      label: 'Notes',
      value: notes.length > 0 ? `\n${notes.join('\n')}` : '—',
    },
  ]
}

const MATRIX_TOOLTIP_WIDTH_PX = 304
const MATRIX_TOOLTIP_VIEWPORT_GUTTER = 8

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
  if (!raw) return '-'
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
  allWeapons,
  shieldMode,
  matrixMode,
  hideHeaderRow = false,
  selectionMode,
  nextShipSlotIndex,
  nextWeaponSlotIndex,
  onShieldModeChange,
  onMatrixModeChange,
  targetWeaponFilterPreset = null,
  onTargetWeaponFilterPresetChange,
  targetWeaponSizeFilter = null,
  onTargetWeaponSizeFilterChange,
  onOpenWeapons,
  onOpenShips,
  onOpenWeaponsAt,
  onOpenShipsAt,
  onboardingHighlight = null,
}: Props) {
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null)
  /** Hover/focus anchor: row highlight runs only through this column; column highlight only through this row. */
  const [hoverAnchorRowIndex, setHoverAnchorRowIndex] = useState<number | null>(null)
  const [hoverAnchorColumnIndex, setHoverAnchorColumnIndex] = useState<number | null>(null)
  const [matrixTooltip, setMatrixTooltip] = useState<{
    open: boolean
    x: number
    y: number
    title: string
    sectionTitle?: string
    hero?: {
      leftLabel: string
      leftValue: string
      rightLabel: string
      rightValue: string
      description: string
    }
    lines: MatrixTooltipLine[]
  }>({
    open: false,
    x: 0,
    y: 0,
    title: '',
    lines: [],
  })
  const [sourceMode, setSourceMode] = useState<'ptu' | 'live'>('ptu')
  const [isMobileLayout, setIsMobileLayout] = useState(false)
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
  const headerWeapons = orderedWeapons
  const bodyWeapons = orderedWeapons
  const firstEnergyColumnIndex = bodyWeapons.findIndex(
    (selection) => matrixMode === 'target' ? false : selection.weapon.damageType === 'energy'
  )
  const targetColumnIndexes = useMemo(
    () => Array.from({ length: TARGET_RECOMMENDATION_COLUMN_COUNT }, (_, index) => index),
    []
  )
  const headerColumns = useMemo<MatrixColumnModel[]>(
    () =>
      matrixMode === 'target'
        ? targetColumnIndexes.map((columnIndex) => ({
            columnIndex,
            key: `target-header-${columnIndex}`,
            slotLabel: `Weapon ${columnIndex + 1}`,
            selection: null,
            placeholderWeapon: false,
          }))
        : headerWeapons.map((selection, columnIndex) => ({
            columnIndex,
            key: selection.slotId,
            slotLabel: selection.slotLabel || `Weapon ${columnIndex + 1}`,
            selection,
            placeholderWeapon: isPlaceholderWeapon(selection),
          })),
    [headerWeapons, matrixMode, targetColumnIndexes]
  )
  const bodyColumns = useMemo<MatrixColumnModel[]>(
    () =>
      matrixMode === 'target'
        ? targetColumnIndexes.map((columnIndex) => ({
            columnIndex,
            key: `target-column-${columnIndex}`,
            slotLabel: `Weapon ${columnIndex + 1}`,
            selection: null,
            placeholderWeapon: false,
          }))
        : bodyWeapons.map((selection, columnIndex) => ({
            columnIndex,
            key: selection.slotId,
            slotLabel: selection.slotLabel || `Weapon ${columnIndex + 1}`,
            selection,
            placeholderWeapon: isPlaceholderWeapon(selection),
          })),
    [bodyWeapons, matrixMode, targetColumnIndexes]
  )
  const gridStyle = getMatrixGridStyle(
    matrixMode === 'target' ? TARGET_RECOMMENDATION_COLUMN_COUNT : bodyWeapons.length
  )
  const targetRecommendationsByShip = useMemo(() => {
    if (matrixMode !== 'target') return new Map<string, WeaponRecommendation[]>()

    return new Map(
      visibleShips.map((ship) => {
        const allRecommendations = buildTargetRecommendationPool(ship, allWeapons)
        const filteredRecommendations = allRecommendations.filter((recommendation) => {
          if (targetWeaponFilterPreset?.kind === 'damageType') {
            if (recommendation.thresholdType !== targetWeaponFilterPreset.value) {
              return false
            }
          }
          if (targetWeaponSizeFilter != null) {
            if (recommendation.weapon.size !== targetWeaponSizeFilter) {
              return false
            }
          }
          return shouldKeepTargetRecommendation(
            recommendation,
            targetWeaponFilterPreset,
            targetWeaponSizeFilter
          )
        })

        const filledRecommendations = [
          ...filteredRecommendations,
          ...allRecommendations.filter(
            (recommendation) =>
              !filteredRecommendations.some(
                (filteredRecommendation) =>
                  filteredRecommendation.weapon.id === recommendation.weapon.id
              )
          ),
        ]

        while (
          filledRecommendations.length < TARGET_RECOMMENDATION_COLUMN_COUNT &&
          allRecommendations.length > 0
        ) {
          filledRecommendations.push(
            allRecommendations[filledRecommendations.length % allRecommendations.length]
          )
        }

        return [ship.id, filledRecommendations.slice(0, TARGET_RECOMMENDATION_COLUMN_COUNT)] as const
      })
    )
  }, [allWeapons, matrixMode, targetWeaponFilterPreset, targetWeaponSizeFilter, visibleShips])

  useEffect(() => {
    if (selectionMode) {
      setActiveRowId(null)
      setActiveColumnId(null)
      setHoverAnchorRowIndex(null)
      setHoverAnchorColumnIndex(null)
    }
  }, [selectionMode])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const sync = () => setIsMobileLayout(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const cellModels = useMemo(() => {
    if (matrixMode === 'target') {
      return new Map<string, MatrixCellModel>()
    }
    return new Map(
      visibleShips.flatMap((ship) =>
        bodyWeapons.map((selection) => [
          `${ship.id}:${selection.slotId}`,
          buildMatrixCellModel(ship, selection),
        ] as const)
      )
    )
  }, [matrixMode, visibleShips, bodyWeapons])

  if (isMobileLayout) {
    return (
      <MobileThresholdComparisonLayout
        ships={visibleShips}
        selectedWeapons={orderedWeapons}
        shieldMode={shieldMode}
        shipCount={visibleShips.filter((ship) => ship.name !== '' && ship.manufacturer !== '').length}
        weaponCount={orderedWeapons.filter(
          (selection) => selection.weapon.name !== '' && selection.weapon.weaponClass !== ''
        ).length}
        onShieldModeChange={onShieldModeChange}
        onOpenShips={onOpenShips}
        onOpenWeapons={onOpenWeapons}
      />
    )
  }

  return (
    <section
      className={[
        'alpha-threshold-tab-panel',
        'alpha-comparison-matrix-panel',
        matrixMode === 'target' ? 'alpha-comparison-matrix-panel-target' : '',
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
              data-weapon-count={matrixMode === 'target' ? TARGET_RECOMMENDATION_COLUMN_COUNT : bodyWeapons.length}
            >
              {hideHeaderRow ? null : (
                <div className="alpha-comparison-matrix-header-row">
                  <div className="alpha-comparison-matrix-corner" aria-label="Chart and shield controls">
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
                              ['target', 'Target'],
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
                                onClick={() => onMatrixModeChange(id)}
                              >
                                {label}
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>

                      <div
                        className={[
                          'alpha-comparison-matrix-corner-row',
                          onboardingHighlight === 'shield' ? 'alpha-onboarding-target-highlight' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
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

                      {matrixMode === 'target' ? (
                        <div className="alpha-comparison-matrix-corner-row alpha-comparison-matrix-corner-row--filter">
                          <span className="alpha-comparison-matrix-corner-label alpha-comparison-matrix-corner-label--spacer" aria-hidden="true">
                            Weapon
                          </span>
                          <div className="alpha-comparison-matrix-corner-filter-stack">
                            <div
                              className="alpha-comparison-matrix-corner-segments"
                              role="radiogroup"
                              aria-label="Weapon type filter"
                            >
                              {(['ballistic', 'energy'] as const).map((value, index) => (
                                <span key={value} className="alpha-comparison-matrix-corner-seg-wrap">
                                  {index > 0 ? (
                                    <span className="alpha-comparison-matrix-corner-seg-sep" aria-hidden>
                                      |
                                    </span>
                                  ) : null}
                                  <button
                                    type="button"
                                    className={[
                                      'alpha-comparison-matrix-corner-seg',
                                      targetWeaponFilterPreset?.kind === 'damageType'
                                        ? targetWeaponFilterPreset.value === value
                                          ? 'alpha-comparison-matrix-corner-seg--active'
                                          : ''
                                        : '',
                                    ]
                                      .filter(Boolean)
                                      .join(' ')}
                                    role="radio"
                                    aria-checked={
                                      targetWeaponFilterPreset?.kind === 'damageType'
                                        ? targetWeaponFilterPreset.value === value
                                        : false
                                    }
                                    onClick={() =>
                                      onTargetWeaponFilterPresetChange?.({
                                        kind: 'damageType',
                                        slotId: 'target',
                                        label: getDamageTypeLabel(value),
                                        value,
                                      })
                                    }
                                  >
                                    {getDamageTypeLabel(value)}
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div
                              className="alpha-comparison-matrix-corner-segments"
                              role="radiogroup"
                              aria-label="Weapon size filter"
                            >
                              {([2, 3, 4, 5, 7, 8] as const).map((size, index) => (
                                <span key={size} className="alpha-comparison-matrix-corner-seg-wrap">
                                  {index > 0 ? (
                                    <span className="alpha-comparison-matrix-corner-seg-sep" aria-hidden>
                                      |
                                    </span>
                                  ) : null}
                                  <button
                                    type="button"
                                    className={[
                                      'alpha-comparison-matrix-corner-seg',
                                      targetWeaponSizeFilter === size
                                        ? 'alpha-comparison-matrix-corner-seg--active'
                                        : '',
                                    ]
                                      .filter(Boolean)
                                      .join(' ')}
                                    role="radio"
                                    aria-checked={targetWeaponSizeFilter === size}
                                    onClick={() => onTargetWeaponSizeFilterChange?.(size)}
                                  >
                                    S{size}
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {headerColumns.map(({ columnIndex, key, slotLabel: weaponSlotLabel, selection, placeholderWeapon }) => {
                    const isTargetMode = matrixMode === 'target'
                    const isDestinationColumn =
                      selectionMode === 'weapon' && columnIndex === activeWeaponDestinationIndex
                    const panelToneClass =
                      `alpha-comparison-matrix-panel-tone-${DESTINATION_TONES[columnIndex % DESTINATION_TONES.length]}`
                    const destinationToneClass = isDestinationColumn
                      ? `alpha-comparison-matrix-destination-${activeWeaponTone}`
                      : ''

                    return (
                      <header
                        key={key}
                        className={[
                          'alpha-comparison-matrix-weapon-header',
                          placeholderWeapon ? 'alpha-comparison-matrix-weapon-header-empty' : '',
                          isTargetMode ? 'alpha-comparison-matrix-weapon-header-target' : '',
                          panelToneClass,
                          placeholderWeapon ? 'alpha-comparison-matrix-panel-placeholder' : '',
                          isDestinationColumn ? 'alpha-comparison-matrix-destination-column' : '',
                          destinationToneClass,
                          onboardingHighlight === 'ship-weapon' && columnIndex === 0
                            ? 'alpha-onboarding-target-highlight'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        data-col-index={columnIndex}
                        aria-label={
                          placeholderWeapon
                            ? `${weaponSlotLabel}, no weapon selected`
                            : selection
                              ? formatEntityLabel(selection.weapon.name)
                              : `${weaponSlotLabel} recommendations`
                        }
                        onPointerEnter={() => {
                          if (selectionMode || placeholderWeapon) {
                            setActiveColumnId(null)
                            return
                          }
                          if (isTargetMode || !selection) return
                          setActiveColumnId(selection.slotId)
                        }}
                        onPointerLeave={() =>
                          setActiveColumnId((current) =>
                            current === selection?.slotId ? null : current
                          )
                        }
                        onFocusCapture={() => {
                          if (selectionMode || placeholderWeapon || isTargetMode || !selection) return
                          setActiveColumnId(selection.slotId)
                        }}
                        onBlurCapture={() =>
                          setActiveColumnId((current) =>
                            current === selection?.slotId ? null : current
                          )
                        }
                        onClick={() => {
                          if (isTargetMode) return
                          if (onOpenWeaponsAt) {
                            onOpenWeaponsAt(columnIndex, true)
                            return
                          }
                          onOpenWeapons()
                        }}
                      >
                        {isTargetMode ? (
                          <div className="alpha-comparison-matrix-weapon-empty alpha-comparison-matrix-weapon-empty-target">
                            {columnIndex === 0 ? (
                              <p className="alpha-comparison-matrix-weapon-empty-note">
                                * S3 NN, Attrition, Ardor, M series E100 always. Lightstrike v Idris E79.
                              </p>
                            ) : null}
                          </div>
                        ) : placeholderWeapon ? (
                          <div className="alpha-comparison-matrix-weapon-empty">
                            <p className="alpha-comparison-matrix-weapon-empty-label">{weaponSlotLabel}</p>
                            <p className="alpha-comparison-matrix-weapon-empty-hint">Select weapon</p>
                          </div>
                        ) : selection ? (
                          <div className="alpha-comparison-matrix-weapon-header-body">
                            <h3 className="alpha-comparison-matrix-weapon-name">
                              {formatEntityLabel(selection.weapon.name)}
                            </h3>
                            <p className="alpha-comparison-matrix-weapon-meta">
                              {`${formatWeaponClassLabel(selection.weapon.weaponClass)} - ${getVelocityLabel(selection)}`}
                            </p>
                          </div>
                        ) : null}
                      </header>
                    )
                  })}
                </div>
              )}

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
                          onboardingHighlight === 'ship-weapon' && rowIndex === 0
                            ? 'alpha-onboarding-target-highlight'
                            : '',
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
                                    {formatEntityLabel(ship.manufacturer).trim() || '-'}
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

                      {bodyColumns.map(({ columnIndex, key, selection, placeholderWeapon }) => {
                        const isTargetMode = matrixMode === 'target'
                        const placeholderCell = placeholderShip || (!isTargetMode && placeholderWeapon)
                        const isDestinationColumnForCells =
                          selectionMode === 'weapon' &&
                          columnIndex === activeWeaponDestinationIndex &&
                          !placeholderWeapon
                        const columnToneClass =
                          isDestinationColumnForCells
                            ? `alpha-comparison-matrix-destination-${activeWeaponTone}`
                            : ''
                        const model = selection
                          ? (cellModels.get(`${ship.id}:${selection.slotId}`) as
                          | MatrixCellModel
                          | undefined)
                          : undefined
                        const targetRecommendations = targetRecommendationsByShip.get(ship.id) ?? []
                        const targetRecommendation = targetRecommendations[columnIndex] ?? null
                        const activeResult: MatrixEstimateView | null =
                          !isTargetMode && model
                            ? shieldMode === 'up'
                              ? model.shieldsOn
                              : model.shieldsOff
                            : null
                        const rowSegmentActive =
                          activeRowId === ship.id &&
                          !placeholderShip &&
                          !selectionMode &&
                          !placeholderCell &&
                          (hoverAnchorColumnIndex === null ||
                            columnIndex <= hoverAnchorColumnIndex)
                        const columnSegmentActive =
                          !!selection &&
                          activeColumnId === selection.slotId &&
                          !placeholderCell &&
                          !selectionMode &&
                          hoverAnchorRowIndex !== null &&
                          rowIndex <= hoverAnchorRowIndex
                        const shieldBlocked =
                          !isTargetMode &&
                          shieldMode === 'up' &&
                          selection &&
                          selection.weapon.damageType === 'energy'
                        const isPrimaryShieldBlockedPanel =
                          !isTargetMode &&
                          shieldBlocked &&
                          firstEnergyColumnIndex !== -1 &&
                          columnIndex === firstEnergyColumnIndex &&
                          rowIndex === 0
                        const isHoverAnchorCell = rowSegmentActive && columnSegmentActive
                        const isE100Penetration =
                          activeResult != null && activeResult.penetrationEffectivePercent >= 100

                        function openMatrixCellTooltip(
                          event: PointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>
                        ) {
                          const cell = event.currentTarget.closest('.alpha-comparison-matrix-cell')
                          if (!(cell instanceof HTMLElement)) return
                          const rect = cell.getBoundingClientRect()
                          setMatrixTooltip({
                            open: true,
                            x: rect.right - MATRIX_TOOLTIP_WIDTH_PX - MATRIX_TOOLTIP_VIEWPORT_GUTTER,
                            y: rect.top + MATRIX_TOOLTIP_VIEWPORT_GUTTER,
                            title: activeResult
                              ? `${getEstimatePenetrationLabel(activeResult.estimate)} - ${formatEntityLabel(ship.name)} vs ${selection?.weapon.name ?? targetRecommendation?.weapon.name ?? `Weapon ${columnIndex + 1}`}`
                              : `${formatEntityLabel(ship.name)} vs ${selection?.weapon.name ?? targetRecommendation?.weapon.name ?? `Weapon ${columnIndex + 1}`}`,
                            sectionTitle:
                              selection?.weapon.name ??
                              targetRecommendation?.weapon.name ??
                              `Weapon ${columnIndex + 1}`,
                            hero: activeResult
                              ? {
                                  leftLabel: 'Rating',
                                  leftValue: `E${getPenetrationEffectivePercent(activeResult.estimate)}`,
                                  rightLabel: 'Effective',
                                  rightValue: `${getPenetrationEffectivePercent(activeResult.estimate)}%`,
                                  description:
                                    'You only apply damage when the enemy ship armor is below this number in %.',
                                }
                              : undefined,
                            lines: activeResult ? buildMatrixCellTooltipLines(activeResult.estimate) : [],
                          })
                        }

                        return (
                          <article
                            key={`${ship.id}:${key}`}
                            className={[
                              'alpha-comparison-matrix-cell',
                              rowIndex === 0 && columnIndex === 0 ? 'alpha-matrix-first-cell-anchor' : '',
                              activeResult ? `alpha-comparison-matrix-cell-${activeResult.tone}` : '',
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
                              isHoverAnchorCell && activeResult
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
                              if (!selection) return
                              setActiveRowId(ship.id)
                              setActiveColumnId(selection.slotId)
                              setHoverAnchorRowIndex(rowIndex)
                              setHoverAnchorColumnIndex(columnIndex)
                            }}
                            onPointerLeave={() => {
                              setActiveColumnId((current) =>
                                current === selection?.slotId ? null : current
                              )
                              setHoverAnchorRowIndex(null)
                              setHoverAnchorColumnIndex(null)
                            }}
                            onFocusCapture={() => {
                              if (selectionMode || placeholderCell || !selection) return
                              setActiveRowId(ship.id)
                              setActiveColumnId(selection.slotId)
                              setHoverAnchorRowIndex(rowIndex)
                              setHoverAnchorColumnIndex(columnIndex)
                            }}
                            onBlurCapture={() => {
                              setActiveColumnId((current) =>
                                current === selection?.slotId ? null : current
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
                                if (isTargetMode) return
                                onOpenWeaponsAt(columnIndex)
                              }
                            }}
                          >
                            <div className="alpha-comparison-matrix-cell-content" aria-hidden={shieldBlocked || undefined}>
                              {matrixMode === 'target' ? (
                                targetRecommendation ? (
                                  <>
                                    <div className="alpha-comparison-matrix-cell-meta-row">
                                      <p className="alpha-comparison-matrix-cell-state">
                                        {formatWeaponTypeLabel({
                                          damageType: targetRecommendation.weapon.damageType,
                                          weaponClass: targetRecommendation.weapon.weaponClass,
                                        })}
                                      </p>
                                      <p className="alpha-comparison-matrix-cell-shield-chip">
                                        {targetRecommendation.weapon.projectileSpeed != null
                                          ? `${formatMetric(targetRecommendation.weapon.projectileSpeed)} m/s`
                                          : 'Velocity Unknown'}
                                      </p>
                                    </div>
                                    <div className="alpha-comparison-matrix-cell-title-row alpha-comparison-matrix-cell-title-row--target">
                                      <p
                                        className="alpha-comparison-matrix-cell-summary alpha-comparison-matrix-target-rating"
                                        style={{
                                          color: getEffectivePenetrationSummaryColor(
                                            targetRecommendation.firstPenetrationArmorPercent ?? 0
                                          ),
                                        }}
                                      >
                                        {getTargetRecommendationRating(targetRecommendation)}
                                      </p>
                                      <p className="alpha-comparison-matrix-target-weapon-name">
                                        {targetRecommendation.weapon.name}
                                      </p>
                                    </div>
                                    <div className="alpha-comparison-matrix-target-stats alpha-comparison-matrix-cell-inline-metrics">
                                      <span>
                                        <strong>Alpha</strong>
                                        {formatMetric(targetRecommendation.weapon.alpha ?? 0)}
                                      </span>
                                      <span>
                                        <strong>DPS</strong>
                                        {formatMetric(targetRecommendation.weapon.burstDps ?? 0)}
                                      </span>
                                      <span>
                                        <strong>M/S</strong>
                                        {formatMetric(targetRecommendation.weapon.projectileSpeed ?? 0)}
                                      </span>
                                    </div>
                                  </>
                              ) : (
                                  <div className="alpha-comparison-matrix-weapon-empty">
                                    <p className="alpha-comparison-matrix-weapon-empty-label">
                                      No match
                                    </p>
                                  </div>
                                )
                              ) : placeholderCell ? (
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
                                      <div
                                        className="alpha-comparison-matrix-cell-track-fill alpha-comparison-matrix-cell-track-fill--full alpha-comparison-matrix-cell-detail-blur"
                                        style={{ width: '100%' }}
                                      />
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
                              ) : activeResult ? (
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
                                      className={[
                                        'alpha-comparison-matrix-cell-track',
                                        'alpha-comparison-matrix-cell-detail-blur',
                                        isE100Penetration ? 'alpha-comparison-matrix-cell-track--e100' : '',
                                      ]
                                        .filter(Boolean)
                                        .join(' ')}
                                      aria-label={
                                        isE100Penetration
                                          ? `${activeResult.penetrationLabel} full armor effectiveness`
                                          : `${activeResult.penetrationLabel} threshold marker`
                                      }
                                    >
                                      {!isE100Penetration ? (
                                        <div
                                          className={[
                                            'alpha-comparison-matrix-cell-track-fill',
                                            'alpha-comparison-matrix-cell-detail-blur',
                                            activeResult.markerPercent >= 100
                                              ? 'alpha-comparison-matrix-cell-track-fill--full'
                                              : '',
                                          ]
                                            .filter(Boolean)
                                            .join(' ')}
                                          style={{ width: `${activeResult.markerPercent}%` }}
                                        />
                                      ) : null}
                                      {!isE100Penetration ? (
                                        <span
                                          className="alpha-comparison-matrix-cell-marker"
                                          style={{ left: `${activeResult.markerPercent}%` }}
                                        />
                                      ) : null}
                                    </div>
                                    <div className="alpha-comparison-matrix-cell-track-caption-row">
                                      <span
                                        className={
                                          isE100Penetration
                                            ? 'alpha-comparison-matrix-cell-track-caption alpha-comparison-matrix-cell-track-caption-center alpha-comparison-matrix-cell-track-caption-e100 alpha-comparison-matrix-cell-detail-blur'
                                            : `alpha-comparison-matrix-cell-track-caption alpha-comparison-matrix-cell-track-caption-${activeResult.markerAlign} alpha-comparison-matrix-cell-detail-blur`
                                        }
                                        style={{
                                          left: isE100Penetration ? '50%' : `${activeResult.markerPercent}%`,
                                        }}
                                      >
                                        {isE100Penetration
                                          ? 'Effective at full armor'
                                          : activeResult.markerLabel}
                                      </span>
                                    </div>
                                  </div>
                                </>
                              ) : null}
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
                            {!placeholderCell ? (
                              <button
                                type="button"
                                className="alpha-armor-tooltip-trigger alpha-comparison-matrix-cell-tooltip-trigger"
                                  aria-label={`Armor interaction details for ${formatEntityLabel(ship.name)} vs ${selection?.weapon.name ?? targetRecommendation?.weapon.name ?? `Weapon ${columnIndex + 1}`}`}
                                onPointerEnter={openMatrixCellTooltip}
                                onPointerLeave={() =>
                                  setMatrixTooltip((current) => ({ ...current, open: false }))
                                }
                                onFocus={openMatrixCellTooltip}
                                onBlur={() =>
                                  setMatrixTooltip((current) => ({ ...current, open: false }))
                                }
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <span aria-hidden="true">?</span>
                              </button>
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

      <HeatmapTooltip
        open={matrixTooltip.open}
        x={matrixTooltip.x}
        y={matrixTooltip.y}
        title={matrixTooltip.title}
        sectionTitle={matrixTooltip.sectionTitle}
        hero={matrixTooltip.hero}
        lines={matrixTooltip.lines}
      />
    </section>
  )
}




