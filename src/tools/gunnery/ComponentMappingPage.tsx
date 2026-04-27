import './gunnery.css'
import { useGunneryState } from './hooks/useGunneryState'
import { SubTargetSection } from './components/subtarget/SubTargetSection'

export function ComponentMappingPage() {
  const state = useGunneryState()

  return (
    <div className="gun-tool">
      <div className="gun-layout">
        <div className="gun-content gun-content--viewport">
          <SubTargetSection
            ships={state.ships}
            selectedShipId={state.selectedShipId}
            selectedShip={state.selectedShip}
            activeView={state.activeView}
            setActiveView={state.setActiveView}
            activeZoneId={state.activeZoneId}
            setActiveZoneId={state.setActiveZoneId}
            activeZone={state.activeZone}
            selectShip={state.selectShip}
          />
        </div>
      </div>
    </div>
  )
}
