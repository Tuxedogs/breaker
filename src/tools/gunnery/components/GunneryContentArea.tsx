import type { GunneryState } from '../hooks/useGunneryState'
import { DiagnosisSection } from './diagnosis/DiagnosisSection'
import { GroundSchoolSection } from './GroundSchoolSection'
import { ModeRecommender } from './mode/ModeRecommender'
import { SubTargetSection } from './subtarget/SubTargetSection'

type Props = { state: GunneryState }

export function GunneryContentArea({ state }: Props) {
  const isModeRecommender = state.activeSection === 'mode-recommender'

  let contentClass = 'gun-content'
  if (state.activeSection === 'sub-targeting') contentClass += ' gun-content--viewport'
  else if (state.activeSection === 'ground-school') contentClass += ' gun-content--scroll'

  return (
    <div className={contentClass}>
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

      {state.activeSection === 'ground-school' && (
        <GroundSchoolSection />
      )}
    </div>
  )
}
