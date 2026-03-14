import { ArmorDegradationHeatmap } from './ArmorDegradationHeatmap'
import { CompareShipStrip } from './CompareShipStrip'
import { ShipTable } from './ShipTable'
import type {
  AxisScaleMode,
  SelectedShipResult,
  ShipOverride,
  Ship,
} from '../types'

type Props = {
  selectedShipResults: SelectedShipResult[]
  allShips: Ship[]
  victimSlotShipNames: Array<string | null>
  axisScaleMode: AxisScaleMode
  globalAxisMaxByType: {
    ballistic: number
    energy: number
  }
  onAxisScaleModeChange: (value: AxisScaleMode) => void
  onVictimShipChange: (slotIndex: number, shipName: string | null) => void
  shipOverrides: Record<string, ShipOverride>
}

export function AlphaThresholdPage({
  selectedShipResults,
  allShips,
  victimSlotShipNames,
  axisScaleMode,
  globalAxisMaxByType,
  onAxisScaleModeChange,
  onVictimShipChange,
  shipOverrides,
}: Props) {
  return (
    <section className="alpha-results-column" aria-label="Threshold matrix results">
      <CompareShipStrip
        shipResults={selectedShipResults}
        allShips={allShips}
        victimSlotShipNames={victimSlotShipNames}
        onVictimShipChange={onVictimShipChange}
      />
      <ArmorDegradationHeatmap shipResults={selectedShipResults} />
      <ShipTable
        shipResults={selectedShipResults}
        axisScaleMode={axisScaleMode}
        globalAxisMaxByType={globalAxisMaxByType}
        onAxisScaleModeChange={onAxisScaleModeChange}
        shipOverrides={shipOverrides}
      />
    </section>
  )
}
