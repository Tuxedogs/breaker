import { resolveRecommenderStantonLagrangeChildren } from "../../../features/locations/stantonLagrangeChildren";
import type { PublicLocationEntry } from "../../../features/mining/types";

export function isStantonLagrangeGroup(entry: PublicLocationEntry): boolean {
  return entry.systemName.trim().toLowerCase() === "stanton"
    && /^lagrange\s+[a-z]$/i.test(entry.locationName.trim());
}

export function hasStantonLagrangeChildren(entry: PublicLocationEntry): boolean {
  if (entry.systemName.toLowerCase() !== "stanton") return false;
  return resolveRecommenderStantonLagrangeChildren(
    entry.locationName,
    entry.matchedLocationCodes,
  ).children.length > 0;
}
