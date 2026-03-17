import { HeatmapWeaponTrace } from './HeatmapWeaponTrace'
import type { ShipHeatmapLaneModel } from '../types'

type Props = {
  shipName: string
  lane: ShipHeatmapLaneModel
}

export function HeatmapLane({ shipName, lane }: Props) {
  return (
    <section
      className={`alpha-heatmap-lane alpha-heatmap-lane-${lane.lane}`}
      aria-label={`${shipName} ${lane.label}`}
    >
      <header className="alpha-heatmap-lane-head">
        <p className="alpha-heatmap-lane-kicker">{lane.label}</p>
        <span className="alpha-heatmap-lane-threshold">Threshold {Math.round(lane.threshold)}</span>
      </header>

      {lane.traces.length > 0 ? (
        <div className="alpha-heatmap-lane-traces">
          {lane.traces.map((trace) => (
            <HeatmapWeaponTrace
              key={`${shipName}-${trace.weapon.slotId}`}
              shipName={shipName}
              trace={trace}
            />
          ))}
        </div>
      ) : (
        <div className="alpha-heatmap-lane-empty">
          No {lane.lane} weapons selected
        </div>
      )}
    </section>
  )
}
