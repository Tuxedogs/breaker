import { useState } from 'react'
import { ArmorInteractionTestbed } from './ArmorInteractionTestbed'
import type { ArmorInteractionFilterChip } from './ArmorInteractionSummaryPanel'
import { RecommendationsBoard } from './RecommendationsBoard'
import { TopControlStrip } from './TopControlStrip'
import type { SelectedWeaponComparison, Ship, WeaponRecord } from '../types'
import { getWeaponKey } from '../lib/calculations'
import { formatWeaponClassLabel } from '../lib/weapons/normalize'

type BoardTab = 'analysis' | 'recommendations'

type Props = {
  ships: Ship[]
  selectedWeapons: SelectedWeaponComparison[]
  allShips: Ship[]
  allWeapons: WeaponRecord[]
  selectedWeaponCount: number
  selectedShipCount: number
  onOpenWeapons: () => void
  onOpenShips: () => void
  onClearAllWeapons: () => void
  onClearAllShips: () => void
  onAssignWeapon: (slotId: string, weaponKey: string | null) => void
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
  allShips,
  allWeapons,
  selectedWeaponCount,
  selectedShipCount,
  onOpenWeapons,
  onOpenShips,
  onClearAllWeapons,
  onClearAllShips,
  onAssignWeapon,
}: Props) {
  const [activeTab, setActiveTab] = useState<BoardTab>('analysis')
  const [analysisFilter, setAnalysisFilter] = useState<AnalysisFilterState | null>(null)

  const filteredWeapons =
    activeTab === 'analysis' && analysisFilter
      ? selectedWeapons.filter((selection) => matchesAnalysisFilter(selection, analysisFilter))
      : selectedWeapons

  const relatedWeapons =
    analysisFilter == null
      ? []
      : allWeapons
          .filter((weapon) => matchesAnalysisFilter({
            slotId: analysisFilter.chip.slotId,
            slotLabel: '',
            tone: 'cyan',
            weapon,
          }, analysisFilter))
          .filter((weapon) => getWeaponKey(weapon) !== getWeaponKey(analysisFilter.sourceWeapon))
          .filter((weapon, index, array) => array.findIndex((entry) => getWeaponKey(entry) === getWeaponKey(weapon)) === index)
          .sort((left, right) => getSimilarityScore(left, analysisFilter.sourceWeapon) - getSimilarityScore(right, analysisFilter.sourceWeapon))
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
    <section className="alpha-threshold-board" aria-label="Armor Thresholds board">
      <header className="alpha-threshold-board-head">
        <div className="alpha-threshold-board-title-block">
          <div>
            <p className="page-kicker">Armor Interaction Review</p>
            <h2 className="surface-title mt-3">Shield-Aware Armor Validation</h2>
          </div>
          <p className="alpha-threshold-board-copy">
            PTU ship and weapon matchups for validating armor thresholds, damage multipliers, shield stats, and observed breakpoint behavior through the shield-aware model.
          </p>
        </div>
        <div className="alpha-threshold-board-tabs" role="tablist" aria-label="Threshold analysis views">
          {(['analysis', 'recommendations'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className="alpha-threshold-board-tab"
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'analysis' ? 'Analysis' : 'Weapons Loadout'}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'recommendations' ? (
        <RecommendationsBoard
          ships={allShips}
          weapons={allWeapons}
          selectedShips={ships}
        />
      ) : null}

      {activeTab === 'analysis' ? (
        <ArmorInteractionTestbed
          controlStrip={
            <>
              <TopControlStrip
                selectedWeaponCount={selectedWeaponCount}
                selectedShipCount={selectedShipCount}
                onOpenWeapons={onOpenWeapons}
                onOpenShips={onOpenShips}
                onClearAllWeapons={onClearAllWeapons}
                onClearAllShips={onClearAllShips}
              />
              {analysisFilter ? (
                <section className="alpha-analysis-filter-strip" aria-label="Analysis filter">
                  <div className="alpha-analysis-filter-copy">
                    <p className="alpha-analysis-filter-label">{getFilterLabel(analysisFilter)}</p>
                    <p className="alpha-analysis-filter-meta">
                      {filteredWeapons.length} of {selectedWeapons.length} selected weapons visible
                    </p>
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
                          {weapon.projectileSpeed != null ? ` · ${weapon.projectileSpeed} m/s` : ''}
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
              ) : null}
            </>
          }
          ships={ships}
          selectedWeapons={filteredWeapons}
          onFilterChipClick={handleFilterChipClick}
        />
      ) : null}
    </section>
  )
}
