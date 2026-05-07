export type ApiUnitType = "unit" | "SCU" | "scu" | "cscu";

export function normalizeUnitType(unitType: ApiUnitType | undefined): "unit" | "scu" {
  return unitType === "SCU" || unitType === "scu" || unitType === "cscu" ? "scu" : "unit";
}

export function formatRequirementQuantity(quantity: number, unitType: ApiUnitType | undefined): string {
  return normalizeUnitType(unitType) === "scu"
    ? `${Number.isInteger(quantity) ? quantity : quantity.toFixed(2)} SCU`
    : `x${quantity}`;
}
