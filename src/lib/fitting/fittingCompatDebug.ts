import type { FittingComponentSummary } from "./fittingApi";
import { getFittingItemSize, getFittingPortSizeConstraint } from "./fittingItemConstraints";
import { summarizeIdentityKeys } from "./fittingItemIdentity";
import { mockupSlotDisplayLabel } from "./fittingMockupSlotLabels";
import type { PortBreakdownRow } from "./fittingPortGrouping";
import type { SlotCompatibilityIndex, SlotCompatibilityRejection } from "./fittingSlotCompatibility";
import { resolveCompatibleItemsForSlot } from "./fittingSlotCompatibility";

export function isFittingCompatDebugEnabled(searchParams: URLSearchParams): boolean {
  return searchParams.get("debugFittingCompatibility") === "1"
    || searchParams.get("fittingCompatDebug") === "1";
}

export type FittingCompatDebugSnapshot = {
  slotLabel: string;
  portId: string;
  portType: string | null;
  compatibilityStatus: string | null;
  editable: boolean;
  apiStatus: string | null;
  apiResultCount: number;
  apiSample: Array<Record<string, string | null>>;
  candidateCount: number;
  candidateSample: Array<Record<string, string | null>>;
  matchedCount: number;
  indexKeyCount: number;
  portSizeConstraint: ReturnType<typeof getFittingPortSizeConstraint>;
  rejected: SlotCompatibilityRejection[];
  installItem: Record<string, string | null> | null;
  installItemSize: number | null;
  validatePayload: { shipId: string | null; portId: string; componentId: string } | null;
};

export function buildFittingCompatDebugSnapshot(input: {
  slot: PortBreakdownRow;
  apiComponents: FittingComponentSummary[];
  compatibilityIndex: SlotCompatibilityIndex | null;
  apiStatus: string | null;
  matchedItems: FittingComponentSummary[];
  rejected?: SlotCompatibilityRejection[];
  installItem?: FittingComponentSummary | null;
  validatePayload?: { shipId: string | null; portId: string; componentId: string } | null;
}): FittingCompatDebugSnapshot {
  return {
    slotLabel: mockupSlotDisplayLabel(input.slot),
    portId: input.slot.portId,
    portType: input.slot.portType,
    compatibilityStatus: input.slot.compatibilityStatus,
    editable: input.slot.editable,
    apiStatus: input.apiStatus,
    apiResultCount: input.apiComponents.length,
    apiSample: input.apiComponents.slice(0, 5).map((item) => summarizeIdentityKeys(item)),
    candidateCount: input.apiComponents.length,
    candidateSample: input.apiComponents.slice(0, 5).map((item) => ({
      ...summarizeIdentityKeys(item),
      size: item.size != null ? String(item.size) : null,
      type: item.type ?? null,
      name: item.name ?? null,
    })),
    matchedCount: input.matchedItems.length,
    indexKeyCount: input.compatibilityIndex?.compatibleComponentIds.size ?? 0,
    portSizeConstraint: getFittingPortSizeConstraint(input.slot, input.compatibilityIndex?.constraint),
    rejected: input.rejected ?? [],
    installItem: input.installItem ? summarizeIdentityKeys(input.installItem) : null,
    installItemSize: input.installItem ? getFittingItemSize(input.installItem) : null,
    validatePayload: input.validatePayload ?? null,
  };
}

export function countMatchedCompatibleItems(
  slot: PortBreakdownRow,
  apiComponents: FittingComponentSummary[],
  compatibilityIndex: SlotCompatibilityIndex | null,
): number {
  if (!compatibilityIndex) return 0;
  return resolveCompatibleItemsForSlot({
    slot,
    candidateItems: apiComponents,
    compatibilityIndex,
  }).length;
}
