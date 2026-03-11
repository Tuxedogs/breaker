import { ShipTable } from './ShipTable'
import type {
  SelectedShipResult,
  ShipOverride,
} from '../types'

type Props = {
  selectedShipResults: SelectedShipResult[]
  axisMaxByType: {
    ballistic: number
    energy: number
  }
  shipOverrides: Record<string, ShipOverride>
  onSaveShipOverride: (shipName: string, patch: ShipOverride) => void
  onResetShipOverride: (shipName: string) => void
}

export function AlphaThresholdPage({
  selectedShipResults,
  axisMaxByType,
  shipOverrides,
  onSaveShipOverride,
  onResetShipOverride,
}: Props) {
  return (
    <div className="alpha-results-column">
      <ShipTable
        shipResults={selectedShipResults}
        axisMaxByType={axisMaxByType}
        shipOverrides={shipOverrides}
        onSaveOverride={onSaveShipOverride}
        onResetOverride={onResetShipOverride}
      />
    </div>
  )
}
