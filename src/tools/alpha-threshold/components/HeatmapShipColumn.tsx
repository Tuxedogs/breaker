import { formatEntityLabel, formatMetric } from '../lib/calculations'
import { HeatmapLane } from './HeatmapLane'
import { ShipHeaderPill } from './ShipHeaderPill'
import type { ShipHeatmapModel } from '../types'

type Props = {
  model: ShipHeatmapModel
}

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
          <ShipHeaderPill label="Hull" value={formatMetric(model.ship.vitalHp)} />
          <ShipHeaderPill label="B" value={formatMetric(model.ship.ballisticThreshold)} />
          <ShipHeaderPill label="E" value={formatMetric(model.ship.energyThreshold)} />
        </div>
      </header>

      <div className="alpha-heatmap-ship-axis" aria-hidden="true">
        <span className="alpha-heatmap-ship-axis-endpoint">
          <strong>100%</strong>
          <em>INTACT</em>
        </span>
        <span className="alpha-heatmap-ship-axis-marker">75%</span>
        <span className="alpha-heatmap-ship-axis-marker">50%</span>
        <span className="alpha-heatmap-ship-axis-marker">25%</span>
        <span className="alpha-heatmap-ship-axis-endpoint alpha-heatmap-ship-axis-endpoint-right">
          <strong>0%</strong>
          <em>BROKEN</em>
        </span>
      </div>

      <div className="alpha-heatmap-ship-lanes">
        <HeatmapLane shipName={shipName} lane={model.lanes.energy} />
        <HeatmapLane shipName={shipName} lane={model.lanes.ballistic} />
      </div>
    </article>
  )
}
