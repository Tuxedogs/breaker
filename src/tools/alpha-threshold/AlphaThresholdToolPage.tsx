import './threshold.css'
import { useState } from 'react'
import { LoadoutDrawer } from './components/LoadoutDrawer'
import { MainHeatmapStage } from './components/MainHeatmapStage'
import { ShipBalanceChangelogPanel } from './components/ShipBalanceChangelogPanel'
import { ThresholdHeatmapBoard } from './components/ThresholdHeatmapBoard'
import { TopControlStrip } from './components/TopControlStrip'
import { ShipSelectorPanel } from './components/ShipSelectorPanel'
import WeaponSelectorPanel from './components/WeaponSelectorPanel'
import { useAlphaThresholdState } from './hooks/useAlphaThresholdState'

export default function AlphaThresholdToolPage() {
  const [drawerMode, setDrawerMode] = useState<'ships' | 'weapons' | null>(null)
  const {
    activeSource,
    setActiveSource,
    slots,
    setSlotWeapon,
    allWeapons,
    allShips,
    selectedWeapons,
    selectedShips,
    selectedShipNames,
    maxVictimShips,
    toggleShipSelected,
    shipBalanceChanges,
    clearAllShips,
  } = useAlphaThresholdState()

  function clearAllWeaponSlots() {
    slots.forEach((slot) => setSlotWeapon(slot.id, null))
  }

  return (
    <main className="alpha-tool-route" aria-label="Alpha threshold tool">
      <div className="alpha-command-shell">
        <TopControlStrip
          activeSource={activeSource}
          onSourceChange={setActiveSource}
          selectedWeaponCount={selectedWeapons.length}
          selectedShipCount={selectedShips.length}
          onOpenWeapons={() => setDrawerMode('weapons')}
          onOpenShips={() => setDrawerMode('ships')}
          onClearAllWeapons={clearAllWeaponSlots}
          onClearAllShips={clearAllShips}
          changelogControl={
            <ShipBalanceChangelogPanel entries={shipBalanceChanges} compact />
          }
        />

        <MainHeatmapStage
          board={
            <ThresholdHeatmapBoard
              ships={selectedShips}
              selectedWeapons={selectedWeapons}
              allShips={allShips}
              allWeapons={allWeapons}
            />
          }
          drawer={
            <LoadoutDrawer
              mode={drawerMode}
              onClose={() => setDrawerMode(null)}
              onOpenShips={() => setDrawerMode('ships')}
              onOpenWeapons={() => setDrawerMode('weapons')}
            >
              {drawerMode === 'ships' ? (
                <ShipSelectorPanel
                  allShips={allShips}
                  selectedShips={selectedShips}
                  selectedShipNames={selectedShipNames}
                  maxVictimShips={maxVictimShips}
                  onToggleShip={toggleShipSelected}
                />
              ) : drawerMode === 'weapons' ? (
                <WeaponSelectorPanel
                  slots={slots}
                  weapons={allWeapons}
                  onSlotChange={setSlotWeapon}
                />
              ) : null}
            </LoadoutDrawer>
          }
        />
      </div>
    </main>
  )
}

