import { useEffect, useState } from 'react'

import { ArmorInteractionTestbed } from './ArmorInteractionTestbed'
import type { ArmorInteractionFilterChip } from './ArmorInteractionSummaryPanel'
import type {
  DefenseShieldState,
  SelectedWeaponComparison,
  Ship,
  WeaponRecord,
} from '../types'
import { getWeaponKey } from '../lib/calculations'
import { formatWeaponClassLabel } from '../lib/weapons/normalize'

type Props = {
  ships: Ship[]
  selectedWeapons: SelectedWeaponComparison[]
  allWeapons: WeaponRecord[]
  shieldMode: DefenseShieldState
  selectionMode: 'ship' | 'weapon' | null
  nextShipSlotIndex: number
  nextWeaponSlotIndex: number
  onShieldModeChange: (mode: DefenseShieldState) => void
  onOpenWeapons: () => void
  onOpenShips: () => void
  onOpenWeaponsAt?: (slotIndex: number) => void
  onOpenShipsAt?: (slotIndex: number) => void
  onAssignWeapon: (slotId: string, weaponKey: string | null) => void
  selectionNotice: string | null
}

type AnalysisFilterState = {
  chip: ArmorInteractionFilterChip
  sourceWeapon: WeaponRecord
}

function getVelocityBand(speed: number | null) {
  if (speed == null || speed <= 0) return null
  const bandSize = 250
  const bandFloor = Math.floor(speed / bandSize) * bandSize

  return {
    min: bandFloor,
    max: bandFloor + bandSize - 1,
    label: `${bandFloor}-${bandFloor + bandSize - 1} m/s`,
  }
}

function matchesAnalysisFilter(
  selection: SelectedWeaponComparison,
  filter: AnalysisFilterState
) {
  switch (filter.chip.kind) {
    case 'damageType':
      return selection.weapon.damageType === filter.chip.value
    case 'weaponClass':
      return selection.weapon.weaponClass === filter.chip.value
    case 'velocity': {
      const sourceBand = getVelocityBand(filter.chip.value)
      const candidateBand = getVelocityBand(selection.weapon.projectileSpeed)

      return Boolean(
        sourceBand &&
        candidateBand &&
        sourceBand.min === candidateBand.min &&
        sourceBand.max === candidateBand.max
      )
    }
  }
}

function getFilterLabel(filter: AnalysisFilterState) {
  switch (filter.chip.kind) {
    case 'damageType':
      return `Showing ${filter.chip.label.toLowerCase()} weapons`
    case 'weaponClass':
      return `Showing ${filter.chip.label.toLowerCase()} weapons`
    case 'velocity':
      return `Showing weapons near ${filter.chip.label}`
  }
}

function getSimilarityScore(candidate: WeaponRecord, source: WeaponRecord) {
  const alphaDelta = Math.abs((candidate.alpha ?? 0) - (source.alpha ?? 0))
  const speedDelta = Math.abs((candidate.projectileSpeed ?? 0) - (source.projectileSpeed ?? 0))
  const sizeDelta = Math.abs(candidate.size - source.size)
  const classPenalty = candidate.weaponClass === source.weaponClass ? 0 : 150

  return alphaDelta + speedDelta / 10 + sizeDelta * 75 + classPenalty
}

export function ThresholdHeatmapBoard({
  ships,
  selectedWeapons,
  allWeapons,
  shieldMode,
  selectionMode,
  nextShipSlotIndex,
  nextWeaponSlotIndex,
  onShieldModeChange,
  onOpenWeapons,
  onOpenShips,
  onOpenWeaponsAt,
  onOpenShipsAt,
  onAssignWeapon,
  selectionNotice,
}: Props) {
  const [analysisFilter, setAnalysisFilter] = useState<AnalysisFilterState | null>(null)
  const filterSourceSelection =
    analysisFilter == null
      ? null
      : selectedWeapons.find((selection) => selection.slotId === analysisFilter.chip.slotId)
  const hasValidFilterSource =
    analysisFilter != null &&
    filterSourceSelection != null &&
    getWeaponKey(filterSourceSelection.weapon) === getWeaponKey(analysisFilter.sourceWeapon)

  useEffect(() => {
    if (analysisFilter && !hasValidFilterSource) {
      setAnalysisFilter(null)
    }
  }, [analysisFilter, hasValidFilterSource])

  const filteredWeapons = hasValidFilterSource
    ? selectedWeapons.filter((selection) => matchesAnalysisFilter(selection, analysisFilter))
    : selectedWeapons

  const relatedWeapons =
    !hasValidFilterSource
      ? []
      : allWeapons
          .filter((weapon) =>
            matchesAnalysisFilter(
              {
                slotId: analysisFilter.chip.slotId,
                slotLabel: '',
                tone: 'cyan',
                weapon,
              },
              analysisFilter
            )
          )
          .filter(
            (weapon) => getWeaponKey(weapon) !== getWeaponKey(analysisFilter.sourceWeapon)
          )
          .filter(
            (weapon, index, array) =>
              array.findIndex((entry) => getWeaponKey(entry) === getWeaponKey(weapon)) ===
              index
          )
          .sort(
            (left, right) =>
              getSimilarityScore(left, analysisFilter.sourceWeapon) -
              getSimilarityScore(right, analysisFilter.sourceWeapon)
          )
          .slice(0, 6)

  function handleFilterChipClick(chip: ArmorInteractionFilterChip) {
    const sourceSelection = selectedWeapons.find((selection) => selection.slotId === chip.slotId)
    if (!sourceSelection) return

    setAnalysisFilter((current) => {
      if (
        current &&
        current.chip.kind === chip.kind &&
        current.chip.slotId === chip.slotId &&
        current.chip.value === chip.value
      ) {
        return null
      }

      return {
        chip,
        sourceWeapon: sourceSelection.weapon,
      }
    })
  }

  return (
    <section className="alpha-threshold-board alpha-threshold-board-app" aria-label="Weapons Analysis board">
      {selectionNotice ? (
        <div className="alpha-analysis-filter-strip" role="status" aria-live="polite">
          <div className="alpha-analysis-filter-copy">
            <p className="alpha-analysis-filter-label">{selectionNotice}</p>
          </div>
        </div>
      ) : null}
      <ArmorInteractionTestbed
        controlStrip={
          analysisFilter ? (
            <section className="alpha-analysis-filter-strip" aria-label="Analysis filter">
              <div className="alpha-analysis-filter-copy">
                <p className="alpha-analysis-filter-label">{getFilterLabel(analysisFilter)}</p>
                <p className="alpha-analysis-filter-meta">{filteredWeapons.length} visible</p>
              </div>
              <div className="alpha-analysis-filter-actions">
                {relatedWeapons.map((weapon) => (
                  <button
                    key={getWeaponKey(weapon)}
                    type="button"
                    className="alpha-analysis-suggestion-chip"
                    onClick={() => onAssignWeapon(analysisFilter.chip.slotId, getWeaponKey(weapon))}
                  >
                    {weapon.name}
                    <span>
                      {formatWeaponClassLabel(weapon.weaponClass)}
                      {weapon.projectileSpeed != null ? ` - ${weapon.projectileSpeed} m/s` : ''}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  className="alpha-analysis-filter-clear"
                  onClick={() => setAnalysisFilter(null)}
                >
                  Clear Filter
                </button>
              </div>
            </section>
          ) : null
        }
        ships={ships}
        selectedWeapons={filteredWeapons}
        shieldMode={shieldMode}
        selectionMode={selectionMode}
        nextShipSlotIndex={nextShipSlotIndex}
        nextWeaponSlotIndex={nextWeaponSlotIndex}
        onShieldModeChange={onShieldModeChange}
        onFilterChipClick={handleFilterChipClick}
        onOpenWeapons={onOpenWeapons}
        onOpenShips={onOpenShips}
        onOpenWeaponsAt={onOpenWeaponsAt}
        onOpenShipsAt={onOpenShipsAt}
      />
    </section>
  )
}
