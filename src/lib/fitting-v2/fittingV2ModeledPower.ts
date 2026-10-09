/**
 * Client-side gameplay controls that are deliberately outside the current
 * source-backed simulation request.  They are retained with the fitting
 * assignment so the UI can model enablement without inventing server-side
 * performance effects.
 */
export type FittingV2ModeledPowerAllocation = {
  allocation: number;
  behavior: "binary_enable";
  provenance: "MODELED_GAMEPLAY";
};

export type FittingV2ModeledPowerAssignment = Record<string, FittingV2ModeledPowerAllocation>;

export function applyFittingV2ModeledPowerRequest(
  current: FittingV2ModeledPowerAssignment,
  key: string,
  requestedAllocation: number,
): FittingV2ModeledPowerAssignment {
  return {
    ...current,
    [key]: {
      allocation: requestedAllocation > 0 ? 1 : 0,
      behavior: "binary_enable",
      provenance: "MODELED_GAMEPLAY",
    },
  };
}
