export function HeatmapLegend() {
  return (
    <section className="alpha-heatmap-legend" aria-label="Heatmap legend">
      <span className="alpha-heatmap-legend-item">
        <span className="alpha-heatmap-legend-swatch alpha-heatmap-legend-swatch-deflect" aria-hidden="true" />
        Blocked
      </span>
      <span className="alpha-heatmap-legend-item">
        <span className="alpha-heatmap-legend-swatch alpha-heatmap-legend-swatch-transition" aria-hidden="true" />
        Destroyed armor required
      </span>
      <span className="alpha-heatmap-legend-item">
        <span className="alpha-heatmap-legend-swatch alpha-heatmap-legend-swatch-damage" aria-hidden="true" />
        Active penetration
      </span>
      <span className="alpha-heatmap-legend-item">
        <span className="alpha-heatmap-legend-marker" aria-hidden="true" />
        Penetration threshold
      </span>
    </section>
  )
}
