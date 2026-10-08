import type { PipAssignment, PipCategory } from "../fitting/fittingTerminalTypes";

type Bounds = { minimum: number | null | undefined; maximum: number | null | undefined };

export function applyFittingV2PowerRequest(current: PipAssignment, category: PipCategory, requestedValue: number, bounds: Bounds): PipAssignment {
  if (bounds.maximum == null) return current;
  const requested = Math.max(0, Math.min(bounds.maximum, Math.round(requestedValue)));
  const nextValue = requested > 0 && bounds.minimum != null && requested < bounds.minimum
    ? bounds.minimum
    : requested;
  return {
    ...current,
    [category]: nextValue,
    ...(category === "quantum" && nextValue > 0 ? { shields: 0 } : {}),
  };
}
