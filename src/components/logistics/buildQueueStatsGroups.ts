import type { FittingComponentDetail } from "../../lib/fitting/fittingApi";
import { buildItemSummaryDetailStatRows } from "../../lib/fitting/fittingStatProjection";
import { buildDetailStatGroups, type DetailStatGroup } from "../../lib/crafting/detailStatGroups";
import type { DetailStatRow } from "../../lib/crafting/craftingDetailStats";

export type BuildQueueStatGroup = DetailStatGroup;

export function buildBuildQueueFittingStatGroups(
  detail: FittingComponentDetail | null | undefined,
): BuildQueueStatGroup[] {
  if (!detail) return [];
  return buildDetailStatGroups(detail, buildItemSummaryDetailStatRows(detail) as DetailStatRow[]);
}
