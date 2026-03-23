import './threshold.css'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LoadoutDrawer } from './components/LoadoutDrawer'
import { MainHeatmapStage } from './components/MainHeatmapStage'
import { ThresholdHeatmapBoard } from './components/ThresholdHeatmapBoard'
import { ShipSelectorPanel } from './components/ShipSelectorPanel'
import WeaponSelectorPanel from './components/WeaponSelectorPanel'
import { useAlphaThresholdState } from './hooks/useAlphaThresholdState'
import { parseShieldMode } from './lib/shieldMode'

export default function AlphaThresholdToolPage() {
  const [drawerMode, setDrawerMode] = useState<'ships' | 'weapons' | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    slots,
    setSlotWeapon,
    allWeapons,
    allShips,
    selectedWeapons,
    selectedShips,
    selectedShipNames,
    maxVictimShips,
    toggleShipSelected,
  } = useAlphaThresholdState()
  const shieldMode = parseShieldMode(searchParams.get('shield'))

  function handleShieldModeChange(mode: 'up' | 'down') {
    const next = new URLSearchParams(searchParams)
    next.set('shield', mode)
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    document.body.classList.add('alpha-threshold-page')

    return () => {
      document.body.classList.remove('alpha-threshold-page')
    }
  }, [])

  return (
    <section className="alpha-tool-route" aria-label="Alpha threshold tool">
      <div className="alpha-app-edge-rail" aria-hidden="true" />
      <div className="alpha-command-shell">
        <MainHeatmapStage
          board={
            <ThresholdHeatmapBoard
              ships={selectedShips}
              selectedWeapons={selectedWeapons}
              allWeapons={allWeapons}
              shieldMode={shieldMode}
              onShieldModeChange={handleShieldModeChange}
              onOpenWeapons={() => setDrawerMode('weapons')}
              onOpenShips={() => setDrawerMode('ships')}
              onAssignWeapon={setSlotWeapon}
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
    </section>
  )
}

