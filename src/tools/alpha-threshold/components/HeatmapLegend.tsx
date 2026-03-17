export function HeatmapLegend() {
  return (
    <section className="alpha-heatmap-legend" aria-label="Heatmap legend">
      <span className="alpha-heatmap-legend-item">
        <span className="alpha-heatmap-legend-swatch alpha-heatmap-legend-swatch-deflect" aria-hidden="true" />
        Deflection
      </span>
      <span className="alpha-heatmap-legend-item">
        <span className="alpha-heatmap-legend-swatch alpha-heatmap-legend-swatch-transition" aria-hidden="true" />
        Crossover band
      </span>
      <span className="alpha-heatmap-legend-item">
        <span className="alpha-heatmap-legend-swatch alpha-heatmap-legend-swatch-damage" aria-hidden="true" />
        Damage region
      </span>
      <span className="alpha-heatmap-legend-item">
        <span className="alpha-heatmap-legend-marker" aria-hidden="true" />
        True penetration point
      </span>
    </section>
  )
}
