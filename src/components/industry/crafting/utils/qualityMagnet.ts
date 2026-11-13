/* Magnetic feel for the continuous material-quality slider.

   Pointer position maps to a raw quality on a linear track. Near a quantization
   marker the handle lags the pointer (it "settles into the groove") and then
   catches up as the pointer moves on, so there is no snap, no dead zone and no
   jump: the mapping is a continuous, strictly increasing function of the raw
   value and depends only on the current pointer position (fully reversible).

   Inside a marker's radius R, with d = raw - marker and t = |d| / R:
     output = marker + d * (grip + (1 - grip) * t)
   The slope is `grip` at the marker and rises to `2 - grip` at the radius edge,
   where the output meets the raw value again. Slider input resolution only:
   band calculation stays with the existing quality-band owners. */

export const DEFAULT_MAGNET_GRIP = 0.2;

/** Applies the magnetic easing for the nearest marker within `radius`.
    `bounds` shrinks a zone that would cross the slider's ends, so the track's
    minimum and maximum stay exactly reachable (e.g. 1000 beside marker 999). */
export function applyMarkerMagnet(
  raw: number,
  markers: readonly number[],
  radius: number,
  grip: number = DEFAULT_MAGNET_GRIP,
  bounds: { min: number; max: number } = { min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY },
): number {
  if (!Number.isFinite(raw) || !(radius > 0) || markers.length === 0) return raw;
  const safeGrip = Math.min(1, Math.max(0.05, grip));
  let nearest: number | null = null;
  for (const marker of markers) {
    if (!Number.isFinite(marker)) continue;
    if (nearest === null || Math.abs(raw - marker) < Math.abs(raw - nearest)) nearest = marker;
  }
  if (nearest === null) return raw;
  const distance = raw - nearest;
  const sideRadius = distance >= 0
    ? Math.min(radius, bounds.max - nearest)
    : Math.min(radius, nearest - bounds.min);
  if (!(sideRadius > 0)) return raw;
  const t = Math.abs(distance) / sideRadius;
  if (t >= 1) return raw;
  return nearest + distance * (safeGrip + (1 - safeGrip) * t);
}

/** Largest radius that keeps neighbouring marker zones from overlapping. */
export function maxMagnetRadius(markers: readonly number[]): number {
  const sorted = [...markers].filter(Number.isFinite).sort((a, b) => a - b);
  let gap = Number.POSITIVE_INFINITY;
  for (let i = 1; i < sorted.length; i += 1) {
    const step = sorted[i] - sorted[i - 1];
    if (step > 0) gap = Math.min(gap, step);
  }
  return Number.isFinite(gap) ? gap / 2 : Number.POSITIVE_INFINITY;
}

/** Fractional position (0–1) along the thumb's travel → quality in [min, max]. */
export function qualityAtTrackFraction(fraction: number, min: number, max: number): number {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  return min + clamped * (max - min);
}

/** Pointer quality for a continuous slider with magnetic markers, as an integer. */
export function magneticQualityAtFraction(
  fraction: number,
  min: number,
  max: number,
  markers: readonly number[],
  radius: number,
  grip?: number,
): number {
  const raw = qualityAtTrackFraction(fraction, min, max);
  const eased = applyMarkerMagnet(raw, markers, Math.min(radius, maxMagnetRadius(markers)), grip, { min, max });
  return Math.min(max, Math.max(min, Math.round(eased)));
}

/** Approximate rendered width of one 9px tabular digit, for label collision checks. */
const LABEL_DIGIT_PX = 5.2;
const LABEL_GAP_PX = 3;

export type MarkerLabelPlacement = { anchor: "center" | "end" | "start"; row: 0 | 1 };

/**
 * Places every marker label without overlap: centred under its tick, else to
 * the left or right of it, else on a second row. Labels are never dropped.
 */
export function placeMarkerLabels(positionsPx: number[], labels: string[], widthPx: number): MarkerLabelPlacement[] {
  // Placed from the right: quantization bands are densest near quality 1000,
  // and the last label is pinned by the track's end.
  const leftBound: [number, number] = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const placements: MarkerLabelPlacement[] = new Array(positionsPx.length);
  for (let index = positionsPx.length - 1; index >= 0; index -= 1) {
    const x = positionsPx[index];
    const w = labels[index].length * LABEL_DIGIT_PX;
    const spans: [MarkerLabelPlacement["anchor"], number, number][] = [
      ["center", x - w / 2, x + w / 2],
      ["end", x - w + 3, x + 3],
      ["start", x - 3, x + w - 3],
    ];
    let placed: MarkerLabelPlacement | null = null;
    for (const row of [0, 1] as const) {
      for (const [anchor, left, right] of spans) {
        if (left >= 0 && right <= widthPx && right <= leftBound[row] - LABEL_GAP_PX) {
          leftBound[row] = left;
          placed = { anchor, row };
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) {
      leftBound[1] = Math.min(leftBound[1], x - w / 2);
      placed = { anchor: "center", row: 1 };
    }
    placements[index] = placed;
  }
  return placements;
}
