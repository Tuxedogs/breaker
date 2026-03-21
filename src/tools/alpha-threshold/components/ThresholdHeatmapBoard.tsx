import { useState } from 'react'
import { ArmorInteractionTestbed } from './ArmorInteractionTestbed'
import { RecommendationsBoard } from './RecommendationsBoard'
import { TopControlStrip } from './TopControlStrip'
import type { ReactNode } from 'react'
import type { SelectedWeaponComparison, Ship, ThresholdDataSourceKey, WeaponRecord } from '../types'

type BoardTab = 'analysis' | 'recommendations'

type Props = {
  ships: Ship[]
  selectedWeapons: SelectedWeaponComparison[]
  allShips: Ship[]
  allWeapons: WeaponRecord[]
  activeSource: ThresholdDataSourceKey
  onSourceChange: (source: ThresholdDataSourceKey) => void
  selectedWeaponCount: number
  selectedShipCount: number
  onOpenWeapons: () => void
  onOpenShips: () => void
  onClearAllWeapons: () => void
  onClearAllShips: () => void
  changelogControl?: ReactNode
}

export function ThresholdHeatmapBoard({
  ships,
  selectedWeapons,
  allShips,
  allWeapons,
  activeSource,
  onSourceChange,
  selectedWeaponCount,
  selectedShipCount,
  onOpenWeapons,
  onOpenShips,
  onClearAllWeapons,
  onClearAllShips,
  changelogControl,
}: Props) {
  const [activeTab, setActiveTab] = useState<BoardTab>('analysis')

  return (
    <section className="alpha-threshold-board" aria-label="Armor Thresholds board">
      <header className="alpha-threshold-board-head">
        <div className="alpha-threshold-board-title-block">
          <div>
            <p className="page-kicker">Armor Interaction Review</p>
            <h2 className="surface-title mt-3">Shield-Aware Armor Validation</h2>
          </div>
          <p className="alpha-threshold-board-copy">
            Live ship and weapon matchups for reading shield state, armor onset, and confidence through the shield-aware model.
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
            <TopControlStrip
              activeSource={activeSource}
              onSourceChange={onSourceChange}
              selectedWeaponCount={selectedWeaponCount}
              selectedShipCount={selectedShipCount}
              onOpenWeapons={onOpenWeapons}
              onOpenShips={onOpenShips}
              onClearAllWeapons={onClearAllWeapons}
              onClearAllShips={onClearAllShips}
              changelogControl={changelogControl}
            />
          }
          ships={ships}
          selectedWeapons={selectedWeapons}
        />
      ) : null}
    </section>
  )
}
