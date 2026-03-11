import { ShipTable } from './ShipTable'
import type {
  AxisScaleMode,
  SelectedShipResult,
  ShipOverride,
} from '../types'

type Props = {
  selectedShipResults: SelectedShipResult[]
  axisScaleMode: AxisScaleMode
  globalAxisMaxByType: {
    ballistic: number
    energy: number
  }
  onAxisScaleModeChange: (value: AxisScaleMode) => void
  shipOverrides: Record<string, ShipOverride>
}

export function AlphaThresholdPage({
  selectedShipResults,
  axisScaleMode,
  globalAxisMaxByType,
  onAxisScaleModeChange,
  shipOverrides,
}: Props) {
  return (
    <div className="alpha-results-column">
      <ShipTable
        shipResults={selectedShipResults}
        axisScaleMode={axisScaleMode}
        globalAxisMaxByType={globalAxisMaxByType}
        onAxisScaleModeChange={onAxisScaleModeChange}
        shipOverrides={shipOverrides}
      />
    </div>
  )
}
