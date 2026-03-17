import { formatEntityLabel, formatMetric } from '../lib/calculations'
import { HeatmapLane } from './HeatmapLane'
import { ShipHeaderPill } from './ShipHeaderPill'
import type { ShipHeatmapModel } from '../types'

type Props = {
  model: ShipHeatmapModel
}

const AXIS_MARKERS = ['100%', '75%', '50%', '25%', '0%']

export function HeatmapShipColumn({ model }: Props) {
  const shipName = formatEntityLabel(model.ship.name)
  const manufacturer = formatEntityLabel(model.ship.manufacturer)

  return (
    <article className="alpha-heatmap-ship-column">
      <header className="alpha-heatmap-ship-head">
        <div className="alpha-heatmap-ship-title-block">
          <h3 className="alpha-heatmap-ship-name">{shipName}</h3>
          <p className="alpha-heatmap-ship-make">{manufacturer}</p>
        </div>
        <div className="alpha-heatmap-ship-pills">
          <ShipHeaderPill label="Armor" value={formatMetric(model.ship.armorHp)} />
          <ShipHeaderPill label="Hull" value={formatMetric(model.ship.health)} />
          <ShipHeaderPill label="B" value={formatMetric(model.ship.ballisticThreshold)} />
          <ShipHeaderPill label="E" value={formatMetric(model.ship.energyThreshold)} />
        </div>
      </header>

      <div className="alpha-heatmap-ship-axis" aria-hidden="true">
        {AXIS_MARKERS.map((marker) => (
          <span key={`${shipName}-${marker}`}>{marker}</span>
        ))}
      </div>

      <div className="alpha-heatmap-ship-lanes">
        <HeatmapLane shipName={shipName} lane={model.lanes.energy} />
        <HeatmapLane shipName={shipName} lane={model.lanes.ballistic} />
      </div>
    </article>
  )
}
