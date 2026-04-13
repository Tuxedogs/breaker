import type { GunneryState } from '../hooks/useGunneryState'
import { ModeRecommender } from './mode/ModeRecommender'
import { ScenarioSection } from './scenarios/ScenarioSection'
import { SubTargetSection } from './subtarget/SubTargetSection'
import { DiagnosisSection } from './diagnosis/DiagnosisSection'

const SECTION_META = {
  'mode-recommender': {
    title: 'Recommended Modes',
    sub: 'Select target parameters — get an immediate mode recommendation.',
  },
  'scenarios': {
    title: 'Scenarios',
    sub: 'Named engagements. Select one to see the recommended approach and key rules.',
  },
  'sub-targeting': {
    title: 'Sub-Target Trainer',
    sub: 'Select a ship and click component zones to review priority and effect.',
  },
  'diagnosis': {
    title: 'Failure Diagnosis',
    sub: 'Select a symptom to identify the likely cause and correction.',
  },
}

type Props = { state: GunneryState }

export function GunneryContentArea({ state }: Props) {
  const meta = SECTION_META[state.activeSection]

  return (
    <div className="gun-content">
      <div className="gun-section-header">
        <h1 className="gun-section-title">{meta.title}</h1>
        <p className="gun-section-sub">{meta.sub}</p>
      </div>

      {state.activeSection === 'mode-recommender' && (
        <ModeRecommender
          operatorType={state.operatorType}
          setOperatorType={state.setOperatorType}
          targetType={state.targetType}
          setTargetType={state.setTargetType}
          range={state.range}
          setRange={state.setRange}
          speed={state.speed}
          setSpeed={state.setSpeed}
          recommendation={state.recommendation}
          clearRecommender={state.clearRecommender}
        />
      )}

      {state.activeSection === 'scenarios' && (
        <ScenarioSection
          scenarios={state.scenarios}
          activeScenarioId={state.activeScenarioId}
          activeScenario={state.activeScenario}
          selectScenario={state.selectScenario}
        />
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
