import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FocusEvent, PointerEvent } from 'react'

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
import { ShipFlipCard } from './ShipFlipCard'
import { TargetAnalysisSurface } from './TargetAnalysisSurface'

type Props = {
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
  analysisColumnCount?: number
  onAnalysisColumnCountChange?: (count: number) => void
  targetColumnCount?: number
  onTargetColumnCountChange?: (count: number) => void
  rowCount?: number
  onRowCountChange?: (count: number) => void
  onOpenWeapons: () => void
  onOpenShips: () => void
  onOpenWeaponsAt?: (slotIndex: number, autoAdvance?: boolean) => void
  onOpenShipsAt?: (slotIndex: number, autoAdvance?: boolean) => void
  onClearShipAt?: (slotIndex: number) => void
  onClearWeaponAt?: (slotIndex: number) => void
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
const ROW_COUNT_MIN = 3
const ROW_COUNT_MAX = 7
const ANALYSIS_COLUMN_MIN = 3
const ANALYSIS_COLUMN_MAX = 7
const TARGET_RECOMMENDATION_COLUMN_MIN = 3
const TARGET_RECOMMENDATION_COLUMN_MAX = 7
const WEAPON_SIZE_OPTIONS = [2, 3, 4, 5, 7, 8] as const

function buildVisibleShips(ships: Ship[], rowCount: number) {
  return ships.slice(0, rowCount)
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
      value: 'T = Threshold\nA = Alpha',
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

function buildMatrixCellTooltipLinesForWeapon(
  estimate: ArmorInteractionEstimate,
  damageType?: WeaponRecord['damageType']
): MatrixTooltipLine[] {
  const lines = buildMatrixCellTooltipLines(estimate)

  if (damageType !== 'ballistic') {
    return lines.filter((line) => line.label !== 'Shields')
  }

  return lines
}

function isPlaceholderShip(ship: Ship) {
  return ship.name === '' && ship.manufacturer === ''
}

function isPlaceholderWeapon(selection: SelectedWeaponComparison) {
  return selection.weapon.name === '' && selection.weapon.weaponClass === ''
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

function MatrixShipThumbnail({ ship }: { ship: Ship }) {
  const candidates = useMemo(() => getShipThumbnailCandidates(ship), [ship])
  const shipIdentity = `${ship.id}:${ship.imageSrc ?? ''}:${ship.name}`
  const [candidateState, setCandidateState] = useState({
    shipIdentity,
    candidateIndex: 0,
  })
  const candidateIndex =
    candidateState.shipIdentity === shipIdentity ? candidateState.candidateIndex : 0

  const current = candidates[Math.min(candidateIndex, candidates.length - 1)]
  const canAdvance = candidateIndex < candidates.length - 1

  return (
    <img
      className="acm-ship-image acm-ship-image--fill"
      src={current.src}
      alt=""
      loading="lazy"
      onError={() => {
        if (!canAdvance) return
        setCandidateState((currentState) => ({
          shipIdentity,
          candidateIndex:
            currentState.shipIdentity === shipIdentity
              ? Math.min(currentState.candidateIndex + 1, candidates.length - 1)
              : 1,
        }))
      }}
    />
  )
}

export function ThresholdComparisonMatrix({
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
  analysisColumnCount = ANALYSIS_COLUMN_MAX,
  onAnalysisColumnCountChange,
  targetColumnCount = TARGET_RECOMMENDATION_COLUMN_MIN,
  onTargetColumnCountChange,
  rowCount = 4,
  onRowCountChange,
  onOpenWeapons,
  onOpenShips,
  onOpenWeaponsAt,
  onOpenShipsAt,
  onClearShipAt,
  onClearWeaponAt,
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
      leftValueColor?: string
      rightLabel: string
      rightValue: string
      rightValueColor?: string
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
  const [sourceMode] = useState<'ptu' | 'live'>('live')
  const [isMobileLayout, setIsMobileLayout] = useState(false)
  const normalizedRowCount = Math.max(ROW_COUNT_MIN, Math.min(ROW_COUNT_MAX, rowCount, ships.length || ROW_COUNT_MAX))
  const visibleShips = buildVisibleShips(ships, normalizedRowCount)
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
  const normalizedAnalysisColumnCount = Math.max(
    ANALYSIS_COLUMN_MIN,
    Math.min(ANALYSIS_COLUMN_MAX, analysisColumnCount, orderedWeapons.length || ANALYSIS_COLUMN_MAX)
  )
  const normalizedTargetColumnCount = Math.max(
    TARGET_RECOMMENDATION_COLUMN_MIN,
    Math.min(TARGET_RECOMMENDATION_COLUMN_MAX, targetColumnCount)
  )
  const isTargetView = matrixMode === 'target'
  const filteredAnalysisWeapons = useMemo(() => {
    if (targetWeaponSizeFilter == null) return orderedWeapons

    const matchingWeapons = orderedWeapons.filter(
      (selection) => selection.weapon.size === targetWeaponSizeFilter
    )
    const remainingWeapons = orderedWeapons.filter(
      (selection) => selection.weapon.size !== targetWeaponSizeFilter
    )

    return [...matchingWeapons, ...remainingWeapons]
  }, [orderedWeapons, targetWeaponSizeFilter])
  const headerWeapons =
    isTargetView
      ? orderedWeapons
      : filteredAnalysisWeapons.slice(0, normalizedAnalysisColumnCount)
  const bodyWeapons = headerWeapons
  const firstEnergyColumnIndex = bodyWeapons.findIndex(
    (selection) => isTargetView ? false : selection.weapon.damageType === 'energy'
  )
  const targetColumnIndexes = useMemo(
    () => Array.from({ length: normalizedTargetColumnCount }, (_, index) => index),
    [normalizedTargetColumnCount]
  )
  const headerColumns = useMemo<MatrixColumnModel[]>(
    () =>
      isTargetView
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
    [headerWeapons, isTargetView, targetColumnIndexes]
  )
  const bodyColumns = useMemo<MatrixColumnModel[]>(
    () =>
      isTargetView
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
    [bodyWeapons, isTargetView, targetColumnIndexes]
  )
  const gridStyle = getMatrixGridStyle(
    isTargetView ? normalizedTargetColumnCount : bodyWeapons.length
  )
  const effectiveActiveRowId = selectionMode ? null : activeRowId
  const effectiveActiveColumnId = selectionMode ? null : activeColumnId
  const effectiveHoverAnchorRowIndex = selectionMode ? null : hoverAnchorRowIndex
  const effectiveHoverAnchorColumnIndex = selectionMode ? null : hoverAnchorColumnIndex
  const targetRecommendationsByShip = useMemo(() => {
    if (!isTargetView) return new Map<string, WeaponRecommendation[]>()

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

        return [ship.id, filledRecommendations.slice(0, normalizedTargetColumnCount)] as const
      })
    )
  }, [allWeapons, isTargetView, normalizedTargetColumnCount, targetWeaponFilterPreset, targetWeaponSizeFilter, visibleShips])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const sync = () => setIsMobileLayout(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const cellModels = useMemo(() => {
    if (isTargetView) {
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
  }, [isTargetView, visibleShips, bodyWeapons])

  const selectedTargetShip = useMemo(
    () => visibleShips.find((ship) => !isPlaceholderShip(ship)) ?? null,
    [visibleShips]
  )
  if (isMobileLayout) {
    if (isTargetView) {
      return (
        <TargetAnalysisSurface
          ship={selectedTargetShip}
          allWeapons={allWeapons}
          shieldMode={shieldMode}
          onShieldModeChange={onShieldModeChange}
          matrixMode={matrixMode}
          onMatrixModeChange={onMatrixModeChange}
          targetWeaponFilterPreset={targetWeaponFilterPreset}
          onTargetWeaponFilterPresetChange={onTargetWeaponFilterPresetChange}
          targetWeaponSizeFilter={targetWeaponSizeFilter}
          onTargetWeaponSizeFilterChange={onTargetWeaponSizeFilterChange}
          onboardingHighlight={onboardingHighlight}
        />
      )
    }

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
        onClearShipAt={onClearShipAt}
      />
    )
  }

  if (isTargetView) {
    return (
      <TargetAnalysisSurface
        ship={selectedTargetShip}
        allWeapons={allWeapons}
        shieldMode={shieldMode}
        onShieldModeChange={onShieldModeChange}
        matrixMode={matrixMode}
        onMatrixModeChange={onMatrixModeChange}
        targetWeaponFilterPreset={targetWeaponFilterPreset}
        onTargetWeaponFilterPresetChange={onTargetWeaponFilterPresetChange}
        targetWeaponSizeFilter={targetWeaponSizeFilter}
        onTargetWeaponSizeFilterChange={onTargetWeaponSizeFilterChange}
        sourceMode={sourceMode}
        onboardingHighlight={onboardingHighlight}
      />
    )
  }

  return (
    <section
      className={[
        'alpha-threshold-tab-panel',
        'acm-panel',
        isTargetView ? 'acm-panel-target' : '',
        isPlaceholderPreview ? 'acm-placeholder-preview' : '',
        selectionMode ? 'acm-selection-active' : '',
        selectionMode === 'ship' ? 'acm-selection-ship' : '',
        selectionMode === 'weapon' ? 'acm-selection-weapon' : '',
      ].filter(Boolean).join(' ')}
      aria-label="Weapons Analysis board"
    >
      <div className="acm-shell">
        <div className="acm-scroll">
            <div
              className="acm-table"
              style={gridStyle}
              data-weapon-count={isTargetView ? normalizedTargetColumnCount : bodyWeapons.length}
            >
              {hideHeaderRow ? null : (
                <div className="acm-header-row">
                  <div
                    className={[
                      'acm-corner',
                      'acm-corner-spacer',
                      onboardingHighlight === 'shield' ? 'alpha-onboarding-target-highlight' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="acm-corner-body">
                      <div className="acm-corner-row">
                        <span className="acm-corner-label">Data</span>
                        <div className="acm-corner-segments" role="radiogroup" aria-label="Source">
                          {(
                            [
                              ['live', 'LIVE'],
                              ['ptu', 'PTU'],
                            ] as const
                          ).map(([id, label], index) => (
                            <span key={id} className="acm-corner-seg-wrap">
                              {index > 0 ? <span className="acm-corner-seg-sep" aria-hidden>|</span> : null}
                              <button
                                type="button"
                                className={[
                                  'acm-corner-seg',
                                  sourceMode === id ? 'acm-corner-seg--active' : '',
                                  id === 'ptu' ? 'acm-corner-seg--disabled' : '',
                                ].filter(Boolean).join(' ')}
                                role="radio"
                                aria-checked={sourceMode === id}
                                disabled={id === 'ptu'}
                              >
                                {label}
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="acm-corner-row">
                        <span className="acm-corner-label">Mode</span>
                        <div className="acm-corner-segments" role="radiogroup" aria-label="Mode">
                          {(
                            [
                              ['analysis', 'Analysis'],
                              ['target', 'Target'],
                            ] as const
                          ).map(([id, label], index) => (
                            <span key={id} className="acm-corner-seg-wrap">
                              {index > 0 ? <span className="acm-corner-seg-sep" aria-hidden>|</span> : null}
                              <button
                                type="button"
                                className={[
                                  'acm-corner-seg',
                                  matrixMode === id ? 'acm-corner-seg--active' : '',
                                ].filter(Boolean).join(' ')}
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
                      <div className="acm-corner-row">
                        <span className="acm-corner-label">Cols</span>
                        <div
                          className="acm-corner-stepper"
                          aria-label={`${isTargetView ? 'Target recommendation' : 'Analysis'} columns`}
                        >
                          <button
                            type="button"
                            className="acm-corner-stepper-button"
                            aria-label={`Decrease ${isTargetView ? 'target recommendation' : 'analysis'} columns`}
                            onClick={() =>
                              isTargetView
                                ? onTargetColumnCountChange?.(
                                    Math.max(TARGET_RECOMMENDATION_COLUMN_MIN, normalizedTargetColumnCount - 1)
                                  )
                                : onAnalysisColumnCountChange?.(
                                    Math.max(ANALYSIS_COLUMN_MIN, normalizedAnalysisColumnCount - 1)
                                  )
                            }
                          >
                            -
                          </button>
                          <span className="acm-corner-stepper-value" aria-live="polite">
                            {isTargetView ? normalizedTargetColumnCount : normalizedAnalysisColumnCount}
                          </span>
                          <button
                            type="button"
                            className="acm-corner-stepper-button"
                            aria-label={`Increase ${isTargetView ? 'target recommendation' : 'analysis'} columns`}
                            onClick={() =>
                              isTargetView
                                ? onTargetColumnCountChange?.(
                                    Math.min(TARGET_RECOMMENDATION_COLUMN_MAX, normalizedTargetColumnCount + 1)
                                  )
                                : onAnalysisColumnCountChange?.(
                                    Math.min(ANALYSIS_COLUMN_MAX, normalizedAnalysisColumnCount + 1)
                                  )
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="acm-corner-row">
                        <span className="acm-corner-label">Rows</span>
                        <div className="acm-corner-stepper" aria-label="Analysis rows">
                          <button
                            type="button"
                            className="acm-corner-stepper-button"
                            aria-label="Decrease analysis rows"
                            onClick={() => onRowCountChange?.(Math.max(ROW_COUNT_MIN, normalizedRowCount - 1))}
                          >
                            -
                          </button>
                          <span className="acm-corner-stepper-value" aria-live="polite">
                            {normalizedRowCount}
                          </span>
                          <button
                            type="button"
                            className="acm-corner-stepper-button"
                            aria-label="Increase analysis rows"
                            onClick={() => onRowCountChange?.(Math.min(ROW_COUNT_MAX, normalizedRowCount + 1))}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      {isTargetView ? (
                        <div className="acm-corner-row">
                          <span className="acm-corner-label">Type</span>
                          <div className="acm-corner-segments" role="radiogroup" aria-label="Weapon type filter">
                            {(['ballistic', 'energy'] as const).map((value, index) => (
                              <span key={value} className="acm-corner-seg-wrap">
                                {index > 0 ? <span className="acm-corner-seg-sep" aria-hidden>|</span> : null}
                                <button
                                  type="button"
                                  className={[
                                    'acm-corner-seg',
                                    targetWeaponFilterPreset?.kind === 'damageType' && targetWeaponFilterPreset.value === value
                                      ? 'acm-corner-seg--active'
                                      : '',
                                  ].filter(Boolean).join(' ')}
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
                        </div>
                      ) : null}
                      {isTargetView ? (
                        <div className="acm-corner-row">
                          <span className="acm-corner-label">Size</span>
                          <div className="acm-corner-select-wrap">
                            <select
                              className="acm-corner-select"
                              aria-label="Weapon size filter"
                              value={targetWeaponSizeFilter == null ? 'all' : String(targetWeaponSizeFilter)}
                              onChange={(event) =>
                                onTargetWeaponSizeFilterChange?.(
                                  event.target.value === 'all' ? null : Number(event.target.value)
                                )
                              }
                            >
                              <option value="all">All</option>
                              {WEAPON_SIZE_OPTIONS.map((size) => (
                                <option key={size} value={size}>
                                  S{size}
                                </option>
                              ))}
                            </select>
                            <span className="acm-corner-select-caret" aria-hidden="true">
                              v
                            </span>
                          </div>
                        </div>
                      ) : null}
                      <div className="acm-corner-row">
                        <span className="acm-corner-label">Shields</span>
                        <div className="acm-corner-segments" role="group" aria-label="Shields">
                          <button
                            type="button"
                            className={[
                              'acm-corner-seg',
                              shieldMode === 'up' ? 'acm-corner-seg--active-shield-on' : '',
                            ].filter(Boolean).join(' ')}
                            aria-pressed={shieldMode === 'up'}
                            onClick={() => onShieldModeChange('up')}
                          >
                            ON
                          </button>
                          <span className="acm-corner-seg-sep" aria-hidden>/</span>
                          <button
                            type="button"
                            className={[
                              'acm-corner-seg',
                              shieldMode === 'down' ? 'acm-corner-seg--active-shield-off' : '',
                            ].filter(Boolean).join(' ')}
                            aria-pressed={shieldMode === 'down'}
                            onClick={() => onShieldModeChange('down')}
                          >
                            OFF
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {headerColumns.map(({ columnIndex, key, slotLabel: weaponSlotLabel, selection, placeholderWeapon }) => {
                    const isDestinationColumn =
                      selectionMode === 'weapon' && columnIndex === activeWeaponDestinationIndex
                    const panelToneClass =
                      `acm-panel-tone-${DESTINATION_TONES[columnIndex % DESTINATION_TONES.length]}`
                    const destinationToneClass = isDestinationColumn
                      ? `acm-destination-${activeWeaponTone}`
                      : ''

                    return (
                      <header
                        key={key}
                        className={[
                          'acm-weapon-header',
                          placeholderWeapon ? 'acm-weapon-header-empty' : '',
                          panelToneClass,
                          placeholderWeapon ? 'acm-panel-placeholder' : '',
                          isDestinationColumn ? 'acm-destination-column' : '',
                          destinationToneClass,
                          !selectionMode &&
                          selection &&
                          effectiveActiveColumnId === selection.slotId
                            ? 'acm-weapon-header-matrix-axis-active'
                            : '',
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
                          if (!selection) return
                          setActiveColumnId(selection.slotId)
                        }}
                        onPointerLeave={() =>
                          setActiveColumnId((current) =>
                            current === selection?.slotId ? null : current
                          )
                        }
                        onFocusCapture={() => {
                          if (selectionMode || placeholderWeapon || !selection) return
                          setActiveColumnId(selection.slotId)
                        }}
                        onBlurCapture={() =>
                          setActiveColumnId((current) =>
                            current === selection?.slotId ? null : current
                          )
                        }
                        onClick={() => {
                          if (onOpenWeaponsAt) {
                            onOpenWeaponsAt(columnIndex, placeholderWeapon)
                            return
                          }
                          onOpenWeapons()
                        }}
                      >
                        {placeholderWeapon ? (
                          <div className="acm-weapon-empty">
                            <p className="acm-weapon-empty-label">{weaponSlotLabel}</p>
                            <p className="acm-weapon-empty-hint">Select weapon</p>
                          </div>
                        ) : selection ? (
                          <div className="acm-weapon-header-body">
                            <h3 className="acm-weapon-name">
                              {formatEntityLabel(selection.weapon.name)}
                            </h3>
                            <p className="acm-weapon-meta">
                              {`${formatWeaponClassLabel(selection.weapon.weaponClass)} - ${getVelocityLabel(selection)}`}
                            </p>
                            {onClearWeaponAt ? (
                              <button
                                type="button"
                                className="acm-weapon-header-clear"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onClearWeaponAt(columnIndex)
                                }}
                                aria-label={`Clear ${formatEntityLabel(selection.weapon.name)} from this weapon slot`}
                              >
                                Clear
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </header>
                    )
                  })}
                </div>
              )}

              <div className="acm-body">
                {visibleShips.map((ship) => {
                  const rowIndex = visibleShips.findIndex((entry) => entry.id === ship.id)
                  const placeholderShip = isPlaceholderShip(ship)
                  const isDestinationRow =
                    selectionMode === 'ship' && rowIndex === activeShipDestinationIndex
                  const rowPanelToneClass =
                    `acm-panel-tone-${DESTINATION_TONES[rowIndex % DESTINATION_TONES.length]}`
                  const destinationToneClass = isDestinationRow
                    ? `acm-destination-${activeShipTone}`
                    : ''
                  const shipSlotLabel = `Ship ${rowIndex + 1}`
                  const isTargetMode = isTargetView
                  /** Mirrors matrix `rowSegmentActive`: only while a cell anchor exists — no full-row wash when the pointer is only on the row chrome. */
                  const shipRowMatrixAxisActive =
                    !selectionMode &&
                    !placeholderShip &&
                    effectiveActiveRowId === ship.id &&
                    effectiveHoverAnchorColumnIndex !== null &&
                    bodyColumns.some(({ columnIndex, placeholderWeapon }) => {
                      if (columnIndex > effectiveHoverAnchorColumnIndex) return false
                      const placeholderCell =
                        placeholderShip || (!isTargetMode && placeholderWeapon)
                      return !placeholderCell
                    })
                  return (
                    <div
                      key={ship.id}
                      className="acm-row"
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
                          'acm-ship-card',
                          placeholderShip ? 'acm-ship-card-empty' : '',
                          !placeholderShip ? 'acm-ship-card--fill' : '',
                          rowPanelToneClass,
                          placeholderShip ? 'acm-panel-placeholder' : '',
                          destinationToneClass,
                          selectionMode && isDestinationRow
                            ? 'acm-ship-card-destination-active'
                            : '',
                          shipRowMatrixAxisActive
                            ? 'acm-ship-card-matrix-axis-active'
                            : '',
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
                          <div className="acm-ship-empty">
                            <p className="acm-ship-empty-label">{shipSlotLabel}</p>
                            <p className="acm-ship-empty-hint">Select ship</p>
                          </div>
                        ) : (
                          <div className="acm-ship-card-body">
                            <ShipFlipCard
                              key={ship.id}
                              ship={ship}
                              eyebrow={formatEntityLabel(ship.manufacturer)}
                              name={formatEntityLabel(ship.name)}
                              roleLabel={getShipRoleLabel(ship)}
                              onClear={() => onClearShipAt?.(rowIndex)}
                              thumbnail={
                                ship.name ? (
                                  <MatrixShipThumbnail ship={ship} />
                                ) : (
                                  <div
                                    className="acm-ship-image-fallback acm-ship-image-fallback--fill"
                                    aria-hidden="true"
                                  >
                                    {formatEntityLabel(ship.manufacturer).slice(0, 2)}
                                  </div>
                                )
                              }
                            />
                          </div>
                        )}
                      </article>

                      {bodyColumns.map(({ columnIndex, key, selection, placeholderWeapon }) => {
                        const isTargetMode = isTargetView
                        const placeholderCell = placeholderShip || (!isTargetMode && placeholderWeapon)
                        const isDestinationColumnForCells =
                          selectionMode === 'weapon' &&
                          columnIndex === activeWeaponDestinationIndex &&
                          !placeholderWeapon
                        const columnToneClass =
                          isDestinationColumnForCells
                            ? `acm-destination-${activeWeaponTone}`
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
                          effectiveActiveRowId === ship.id &&
                          !placeholderShip &&
                          !selectionMode &&
                          !placeholderCell &&
                          effectiveHoverAnchorColumnIndex !== null &&
                          columnIndex <= effectiveHoverAnchorColumnIndex
                        const columnSegmentActive =
                          !!selection &&
                          effectiveActiveColumnId === selection.slotId &&
                          !placeholderCell &&
                          !selectionMode &&
                          effectiveHoverAnchorRowIndex !== null &&
                          rowIndex <= effectiveHoverAnchorRowIndex
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
                          const cell = event.currentTarget.closest('.acm-cell')
                          if (!(cell instanceof HTMLElement)) return
                          const rect = cell.getBoundingClientRect()
                          setMatrixTooltip({
                            open: true,
                            x: rect.right - MATRIX_TOOLTIP_WIDTH_PX - MATRIX_TOOLTIP_VIEWPORT_GUTTER,
                            y: rect.top + MATRIX_TOOLTIP_VIEWPORT_GUTTER,
                            title: `${formatEntityLabel(ship.name)} vs ${selection?.weapon.name ?? targetRecommendation?.weapon.name ?? `Weapon ${columnIndex + 1}`}`,
                            sectionTitle:
                              selection?.weapon.name ??
                              targetRecommendation?.weapon.name ??
                              `Weapon ${columnIndex + 1}`,
                                hero: activeResult
                              ? {
                                  leftLabel: 'Rating',
                                  leftValue: `E${getPenetrationEffectivePercent(activeResult.estimate)}`,
                                  leftValueColor: getEffectivePenetrationSummaryColor(
                                    getPenetrationEffectivePercent(activeResult.estimate)
                                  ),
                                  rightLabel: 'Effective',
                                  rightValue: `${getPenetrationEffectivePercent(activeResult.estimate)}%`,
                                  rightValueColor: getEffectivePenetrationSummaryColor(
                                    getPenetrationEffectivePercent(activeResult.estimate)
                                  ),
                                  description:
                                    'You only apply damage when the enemy ship armor is below this number in %.',
                                }
                              : undefined,
                            lines: activeResult
                              ? buildMatrixCellTooltipLinesForWeapon(
                                  activeResult.estimate,
                                  selection?.weapon.damageType
                                )
                              : [],
                          })
                        }

                        return (
                          <article
                            key={`${ship.id}:${key}`}
                            className={[
                              'acm-cell',
                              activeResult ? `acm-cell-${activeResult.tone}` : '',
                              placeholderCell ? 'acm-panel-placeholder' : '',
                              rowSegmentActive ? 'acm-cell-row-active' : '',
                              columnSegmentActive ? 'acm-cell-column-active' : '',
                              isHoverAnchorCell ? 'acm-cell-hover-anchor' : '',
                              selectionMode &&
                              !placeholderCell &&
                              isDestinationColumnForCells
                                ? 'acm-cell-destination-active'
                                : '',
                              shieldBlocked ? 'acm-cell-shield-blocked' : '',
                              shieldBlocked && !isPrimaryShieldBlockedPanel
                                ? 'acm-cell-shield-blocked-muted'
                                : '',
                              !placeholderCell && isDestinationColumnForCells
                                ? 'acm-destination-column-cell'
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
                            <div className="acm-cell-content" aria-hidden={shieldBlocked || undefined}>
                              {isTargetView ? (
                                targetRecommendation ? (
                                  <>
                                    <div className="acm-cell-meta-row">
                                      <p className="acm-cell-state">
                                        {formatWeaponTypeLabel({
                                          damageType: targetRecommendation.weapon.damageType,
                                          weaponClass: targetRecommendation.weapon.weaponClass,
                                        })}
                                      </p>
                                      <p className="acm-cell-shield-chip">
                                        {targetRecommendation.weapon.projectileSpeed != null
                                          ? `${formatMetric(targetRecommendation.weapon.projectileSpeed)} m/s`
                                          : 'Velocity Unknown'}
                                      </p>
                                    </div>
                                    <div className="acm-cell-title-row acm-cell-title-row--target">
                                      <p
                                        className="acm-cell-summary acm-target-rating"
                                        style={{
                                          color: getEffectivePenetrationSummaryColor(
                                            targetRecommendation.firstPenetrationArmorPercent ?? 0
                                          ),
                                        }}
                                      >
                                        {getTargetRecommendationRating(targetRecommendation)}
                                      </p>
                                      <p className="acm-target-weapon-name">
                                        {targetRecommendation.weapon.name}
                                      </p>
                                    </div>
                                    <div className="acm-target-stats acm-cell-inline-metrics">
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
                                  <div className="acm-weapon-empty">
                                    <p className="acm-weapon-empty-label">
                                      No match
                                    </p>
                                  </div>
                                )
                              ) : placeholderCell ? (
                                <>
                                  <div className="acm-cell-meta-row">
                                    <p className="acm-cell-state acm-cell-detail-blur">Armor</p>
                                  </div>
                                  <div className="acm-cell-title-row">
                                    <p
                                      className="acm-cell-summary acm-cell-detail-blur"
                                      style={{
                                        color: getEffectivePenetrationSummaryColor(0),
                                      }}
                                    >
                                      E0
                                    </p>
                                    <div className="acm-cell-inline-metrics acm-cell-detail-blur">
                                      <span>
                                        <strong>T</strong>0
                                      </span>
                                      <span>
                                        <strong>A</strong>0
                                      </span>
                                    </div>
                                  </div>
                                  <div className="acm-cell-chart">
                                    <div className="acm-cell-track-scale acm-cell-detail-blur">
                                      <span>100% armor</span>
                                      <span>0% armor</span>
                                    </div>
                                    <div
                                      className="acm-cell-track acm-cell-detail-blur"
                                      aria-label="Armor placeholder threshold marker"
                                    >
                                      <div
                                        className="acm-cell-track-fill acm-cell-track-fill--full acm-cell-detail-blur"
                                        style={{ width: '100%' }}
                                      />
                                      <span
                                        className="acm-cell-marker"
                                        style={{ left: '100%' }}
                                      />
                                    </div>
                                    <div className="acm-cell-track-caption-row">
                                      <span
                                        className="acm-cell-track-caption acm-cell-track-caption-end acm-cell-detail-blur"
                                        style={{ left: '100%' }}
                                      >
                                        Damage start
                                      </span>
                                    </div>
                                  </div>
                                </>
                              ) : activeResult ? (
                                <>
                                  <div className="acm-cell-meta-row">
                                    <p className="acm-cell-state acm-cell-detail-blur">
                                      {activeResult.stateLabel}
                                    </p>
                                  </div>
                                  <div className="acm-cell-title-row">
                                    <p
                                      className="acm-cell-summary acm-cell-detail-blur"
                                      style={{
                                        color: getEffectivePenetrationSummaryColor(
                                          activeResult.penetrationEffectivePercent
                                        ),
                                      }}
                                    >
                                      {activeResult.penetrationLabel}
                                    </p>
                                    <div className="acm-cell-inline-metrics acm-cell-detail-blur">
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

                                  <div className="acm-cell-chart">
                                    <div className="acm-cell-track-scale acm-cell-detail-blur">
                                      <span>100% armor</span>
                                      <span>0% armor</span>
                                    </div>
                                    <div
                                      className={[
                                        'acm-cell-track',
                                        'acm-cell-detail-blur',
                                        isE100Penetration ? 'acm-cell-track--e100' : '',
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
                                            'acm-cell-track-fill',
                                            'acm-cell-detail-blur',
                                            activeResult.markerPercent >= 100
                                              ? 'acm-cell-track-fill--full'
                                              : '',
                                          ]
                                            .filter(Boolean)
                                            .join(' ')}
                                          style={{ width: `${activeResult.markerPercent}%` }}
                                        />
                                      ) : null}
                                      {!isE100Penetration ? (
                                        <span
                                          className="acm-cell-marker"
                                          style={{ left: `${activeResult.markerPercent}%` }}
                                        />
                                      ) : null}
                                    </div>
                                    <div className="acm-cell-track-caption-row">
                                      <span
                                        className={
                                          isE100Penetration
                                            ? 'acm-cell-track-caption acm-cell-track-caption-center acm-cell-track-caption-e100 acm-cell-detail-blur'
                                            : `acm-cell-track-caption acm-cell-track-caption-${activeResult.markerAlign} acm-cell-detail-blur`
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
                                className="acm-cell-overlay acm-cell-overlay-interactive"
                                aria-label="Turn Shields Off for Armor vs Energy"
                              >
                                <p className="acm-cell-overlay-copy">
                                  Turn Shields{' '}
                                  <button
                                    type="button"
                                    className="acm-cell-overlay-action"
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
                                className="alpha-armor-tooltip-trigger acm-cell-tooltip-trigger"
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
            {isTargetView ? (
              <aside className="acm-target-exclusions">
                <p className="acm-target-exclusions-head">Excluded from recommendations</p>
                <p className="acm-target-exclusions-body">
                  These weapon families always penetrate all armor states from 100%&nbsp;— no
                  per-ship evaluation is needed. They are omitted from the recommendation grid.
                </p>
                <div className="acm-target-exclusions-groups">
                  <div className="acm-target-exclusions-group">
                    <p className="acm-target-exclusions-label">Always E100 — Energy</p>
                    <ul className="acm-target-exclusions-list">
                      <li>Attrition cannons (size 4+)</li>
                      <li>RSI Medusa</li>
                      <li>Omnisky cannons</li>
                      <li>M#A cannons — M4A, M5A, M6A, M7A</li>
                    </ul>
                  </div>
                  <div className="acm-target-exclusions-group">
                    <p className="acm-target-exclusions-label">Always E100 — Ballistic</p>
                    <ul className="acm-target-exclusions-list">
                      <li>Deadbolt cannons (size 4+)</li>
                    </ul>
                  </div>
                  <div className="acm-target-exclusions-group">
                    <p className="acm-target-exclusions-label">Edge cases / bespoke</p>
                    <p className="acm-target-exclusions-note">
                      Singe, Sledge, and other ship-specific or non-standard weapons are excluded
                      due to insufficient data or non-standard armor interaction behavior.
                      Evaluate these separately.
                    </p>
                  </div>
                </div>
              </aside>
            ) : null}
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
