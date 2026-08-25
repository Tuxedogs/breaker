import { resolveRecommenderStantonLagrangeChildren } from "../../../features/locations/stantonLagrangeChildren";
import type { PublicLocationEntry } from "../../../features/mining/types";

export function hasStantonLagrangeChildren(entry: PublicLocationEntry): boolean {
  if (entry.systemName.toLowerCase() !== "stanton") return false;
  return resolveRecommenderStantonLagrangeChildren(
    entry.locationName,
    entry.matchedLocationCodes,
  ).children.length > 0;
}
