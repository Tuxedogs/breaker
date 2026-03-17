import type { HeatmapTraceModel } from '../types'

type Props = {
  trace: HeatmapTraceModel
}

export function PenetrationMarker({ trace }: Props) {
  if (trace.alwaysDeflects) return null

  return (
    <span
      className="alpha-penetration-marker"
      style={{ left: `${trace.penetrationStartX * 100}%` }}
      aria-hidden="true"
    >
      <span className="alpha-penetration-marker-halo" aria-hidden="true" />
      <span className="alpha-penetration-marker-stick" aria-hidden="true" />
      <span className="alpha-penetration-marker-dot" aria-hidden="true" />
    </span>
  )
}
