import type { FittingValidationResult } from "./fittingApi";

export function validationFailureForPort(
  validation: FittingValidationResult,
  portId: string,
): string | null {
  const incompatible = validation.incompatibleItems.find((entry) => entry.portId === portId);
  if (incompatible) return incompatible.reason;

  const mismatch = validation.mismatchReasons.find((entry) => entry.portId === portId);
  if (mismatch) return mismatch.message;

  const unknown = validation.unknownItemIds.find((entry) => entry.portId === portId);
  if (unknown) return `Unknown component identifier for this slot.`;

  if (validation.lockedBespokePorts.includes(portId)) {
    return "This port is locked or bespoke and cannot be changed.";
  }

  if (validation.missingRequiredPorts.includes(portId)) {
    return "This port requires a component.";
  }

  return null;
}
