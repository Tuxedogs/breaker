import { PROPERTY_DIRECTION } from "./propertyMeta";

export type ModifierImpact = "good" | "bad" | "neutral";

export function getModifierImpact(
  property: string,
  value: number
): ModifierImpact {
  const direction = PROPERTY_DIRECTION[property] ?? "higher";

  if (value === 0) return "neutral";

  if (direction === "higher") {
    return value > 0 ? "good" : "bad";
  }

  return value < 0 ? "good" : "bad";
}

export function getDirectionLabel(property: string): string {
  const direction = PROPERTY_DIRECTION[property];

  if (direction === "lower") return "Lower is better";
  if (direction === "higher") return "Higher is better";

  return "";
}