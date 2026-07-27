const METERS_PER_KILOMETER = 1_000;

/**
 * Extracted quantum-drive travel values use meters as their distance unit.
 * Product-facing drive stats use kilometers so they match the expected scale.
 */
export function quantumMetersToKilometers(value: number): number {
  return value / METERS_PER_KILOMETER;
}
