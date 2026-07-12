import type { FittingComponentDetail } from "../../lib/fitting/fittingApi";
import { buildCraftStatViewModel, type CraftStatGroupView } from "../../lib/crafting/craftStatViewModel";

export type BuildQueueStatGroup = CraftStatGroupView;

export function buildBuildQueueFittingStatGroups(
  detail: FittingComponentDetail | null | undefined,
): BuildQueueStatGroup[] {
  return buildCraftStatViewModel({ detail }).groups;
}
