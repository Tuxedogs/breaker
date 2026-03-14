import { CompareShipStrip } from './CompareShipStrip'
import { ShipBalanceChangelogPanel } from './ShipBalanceChangelogPanel'
import { ShipTable } from './ShipTable'
import type {
  AxisScaleMode,
  SelectedShipResult,
  ShipBalanceChangeEntry,
  ShipOverride,
} from '../types'

type Props = {
  selectedShipResults: SelectedShipResult[]
  shipBalanceChanges: ShipBalanceChangeEntry[]
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
  shipBalanceChanges,
  axisScaleMode,
  globalAxisMaxByType,
  onAxisScaleModeChange,
  shipOverrides,
}: Props) {
  return (
    <section className="alpha-results-column" aria-label="Threshold matrix results">
      <ShipBalanceChangelogPanel entries={shipBalanceChanges} />
      <CompareShipStrip shipResults={selectedShipResults} />
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
