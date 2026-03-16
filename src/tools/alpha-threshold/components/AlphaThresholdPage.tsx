import { ArmorDegradationHeatmap } from './ArmorDegradationHeatmap'
import { CompareShipStrip } from './CompareShipStrip'
import { ShipTable } from './ShipTable'
import type {
  AxisScaleMode,
  SelectedShipResult,
  SelectedWeaponComparison,
  ShipOverride,
  Ship,
} from '../types'

type Props = {
  selectedShipResults: SelectedShipResult[]
  selectedWeapons: SelectedWeaponComparison[]
  allShips: Ship[]
  victimSlotShipNames: Array<string | null>
  axisScaleMode: AxisScaleMode
  globalAxisMaxByType: {
    ballistic: number
    energy: number
  }
  onAxisScaleModeChange: (value: AxisScaleMode) => void
  onVictimShipChange: (slotIndex: number, shipName: string | null) => void
  onClearAllShips: () => void
  shipOverrides: Record<string, ShipOverride>
}

export function AlphaThresholdPage({
  selectedShipResults,
  selectedWeapons,
  allShips,
  victimSlotShipNames,
  axisScaleMode,
  globalAxisMaxByType,
  onAxisScaleModeChange,
  onVictimShipChange,
  onClearAllShips,
  shipOverrides,
}: Props) {
  return (
    <section className="alpha-results-column" aria-label="Threshold matrix results">
      <CompareShipStrip
        allShips={allShips}
        victimSlotShipNames={victimSlotShipNames}
        onVictimShipChange={onVictimShipChange}
        onClearAllShips={onClearAllShips}
      />
      <ArmorDegradationHeatmap
        shipResults={selectedShipResults}
        selectedWeapons={selectedWeapons}
      />
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
