// Display taxonomy approved in V31b; it does not assert location conditions.
export const MINING_EQUIPMENT_SLOTS = [{ code: "Cold", label: "Cold equipment" }, { code: "Hot", label: "Hot equipment" }] as const;
export const MINING_HAZARD_SLOTS = [
  { code: "RAD", label: "Radiation" }, { code: "BIO", label: "Biological hazard" },
  { code: "WIDLF", label: "Wildlife" }, { code: "PIR", label: "Piracy" },
] as const;

// Missing source fields remain unknown; explicit false is a confirmed absence.
export function miningConditionState(value: boolean | null | undefined): "on" | "off" | "unknown" {
  return value === true ? "on" : value === false ? "off" : "unknown";
}
