import type { FittingComponentSummary } from "./fittingApi";
import { resolveLoadoutComponentId } from "./fittingItemIdentity";
import { isItemCompatibleWithSlot, type SlotCompatibilityIndex } from "./fittingSlotCompatibility";
import type { PortBreakdownRow } from "./fittingPortGrouping";

export type RackPayloadPatch = { ok: true; componentId: string; patch: Record<string, string> } | { ok: false; reason: string };

/** Builds the all-child replacement patch before any loadout state is changed. */
export function buildRackPayloadPatch(input: {
  portIds: readonly string[];
  item: FittingComponentSummary;
  rows: readonly PortBreakdownRow[];
  compatibilityIndexes: Record<string, SlotCompatibilityIndex>;
}): RackPayloadPatch {
  const portIds = [...new Set(input.portIds)];
  if (!portIds.length) return { ok: false, reason: "No rack payload ports were provided." };
  const componentId = resolveLoadoutComponentId(input.item);
  if (!componentId) return { ok: false, reason: "Selected item has an invalid identifier." };
  const patch: Record<string, string> = {};
  for (const portId of portIds) {
    const slot = input.rows.find((row) => row.portId === portId);
    const compatibilityIndex = input.compatibilityIndexes[portId];
    if (!slot || !compatibilityIndex) return { ok: false, reason: "A rack payload port was not found." };
    const verdict = isItemCompatibleWithSlot({ slot, item: input.item, compatibilityIndex });
    if (!verdict.compatible) return { ok: false, reason: verdict.reason ?? "Item is not compatible with every rack payload port." };
    patch[portId] = componentId;
  }
  return { ok: true, componentId, patch };
}
