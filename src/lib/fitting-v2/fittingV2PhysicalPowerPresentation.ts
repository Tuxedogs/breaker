import type { PipAssignment } from "../fitting/fittingTerminalTypes";

/** Quantum disables displayed shield allocation without discarding its saved per-port setting. */
export function displayedPhysicalPowerAllocation(category: string | null, allocation: number, assignment: PipAssignment): number {
  return category === "shields" && assignment.quantum > 0 ? 0 : allocation;
}
