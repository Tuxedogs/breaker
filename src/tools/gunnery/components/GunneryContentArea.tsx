import type { GunneryState } from '../hooks/useGunneryState'
import { DiagnosisSection } from './diagnosis/DiagnosisSection'
import { ModeRecommender } from './mode/ModeRecommender'
import { SubTargetSection } from './subtarget/SubTargetSection'

type Props = { state: GunneryState }

export function GunneryContentArea({ state }: Props) {
  const isModeRecommender = state.activeSection === 'mode-recommender'

  return (
    <div className={`gun-content${state.activeSection === 'sub-targeting' ? ' gun-content--viewport' : ''}`}>
      {isModeRecommender && (
        <ModeRecommender />
      )}

      {state.activeSection === 'sub-targeting' && (
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
      )}

      {state.activeSection === 'diagnosis' && (
        <DiagnosisSection
          diagnosis={state.diagnosis}
          activeSymptomId={state.activeSymptomId}
          setActiveSymptomId={state.setActiveSymptomId}
          diagnosisResult={state.diagnosisResult}
        />
      )}
    </div>
  )
}
