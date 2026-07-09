import type { FittingComponentSummary, FittingCompatibleComponentsResult } from "./fittingApi";
import { canonicalFittingId } from "./fittingItemIdentity";
import {
  buildSlotCompatibilityIndex,
  isItemCompatibleWithSlot,
  portCompatibleApiComponents,
  resolveCompatibleItemsForSlot,
  type SlotCompatibilityIndex,
} from "./fittingSlotCompatibility";
import type { PortBreakdownRow, SummarizedRow } from "./fittingPortGrouping";
import { portCompatibilitySignature } from "./fittingPortGrouping";
import { mockupSlotDisplayLabel, mockupTurretGroupLabel } from "./fittingMockupSlotLabels";

export type MockupWeaponSelection = {
  summary: SummarizedRow;
  groupKey: string;
  isTurretGroup: boolean;
  /** Port id used for drawer compatibility fetch and selection highlight. */
  selectionPortId: string;
  childPortIds: string[];
  childRows: PortBreakdownRow[];
};

export function isTurretSummarizedRow(summary: SummarizedRow): boolean {
  return Boolean(summary.turretLabel);
}

export function usesGroupedPortCompatibility(selection: MockupWeaponSelection | null): boolean {
  return Boolean(
    selection
    && (selection.isTurretGroup || selection.childPortIds.length > 1),
  );
}

export function buildMockupWeaponSelection(
  summary: SummarizedRow,
  groupKey: string,
): MockupWeaponSelection {
  const isTurretGroup = isTurretSummarizedRow(summary);
  return {
    summary,
    groupKey,
    isTurretGroup,
    selectionPortId: summary.key,
    childPortIds: summary.portIds,
    childRows: summary.rows,
  };
}

export function mockupDrawerTitle(selection: MockupWeaponSelection): string {
  if (selection.isTurretGroup) {
    const label = mockupTurretGroupLabel(selection.summary);
    return `Select Weapon for ${label}`;
  }
  const row = selection.summary.rows[0];
  return `Select Weapon for ${row ? mockupSlotDisplayLabel(row) : selection.selectionPortId}`;
}

export function mockupDrawerSlotLabel(selection: MockupWeaponSelection): string {
  if (selection.isTurretGroup) {
    return mockupTurretGroupLabel(selection.summary);
  }
  const row = selection.summary.rows[0];
  return row ? mockupSlotDisplayLabel(row) : selection.selectionPortId;
}

export type TurretGroupCompatibilityBundle = {
  childPortId: string;
  slot: PortBreakdownRow;
  result: FittingCompatibleComponentsResult | null;
  index: SlotCompatibilityIndex | null;
  error: boolean;
};

export function buildTurretGroupCompatibilityBundles(
  childRows: PortBreakdownRow[],
  resultsByPortId: Map<string, { result: FittingCompatibleComponentsResult | null; error: boolean }>,
): TurretGroupCompatibilityBundle[] {
  return childRows.map((slot) => {
    const payload = resultsByPortId.get(slot.portId) ?? { result: null, error: true };
    const index = buildSlotCompatibilityIndex(slot, payload.result, payload.error);
    return {
      childPortId: slot.portId,
      slot,
      result: payload.result,
      index,
      error: payload.error,
    };
  });
}

export function turretGroupHasUniformChildPorts(childRows: PortBreakdownRow[]): boolean {
  if (childRows.length <= 1) return true;
  const reference = portCompatibilitySignature(childRows[0]);
  return childRows.every((row) => portCompatibilitySignature(row) === reference);
}

export function resolveTurretGroupCompatibleItems(
  bundles: TurretGroupCompatibilityBundle[],
): FittingComponentSummary[] {
  if (bundles.length === 0) return [];

  const perPortLists = bundles.map((bundle) => {
    if (!bundle.index || bundle.index.status !== "known") return [] as FittingComponentSummary[];
    const apiComponents = bundle.result ? portCompatibleApiComponents(bundle.result, bundle.childPortId) : [];
    return resolveCompatibleItemsForSlot({
      slot: bundle.slot,
      candidateItems: apiComponents,
      compatibilityIndex: bundle.index,
    });
  });

  if (perPortLists.some((items) => items.length === 0) && bundles.some((bundle) => bundle.index?.status === "known")) {
    return [];
  }

  const [first, ...rest] = perPortLists;
  if (!first || first.length === 0) return [];

  return first.filter((candidate) => rest.every((items) => (
    items.some((item) => canonicalFittingId(item.id) === canonicalFittingId(candidate.id))
    && bundles.every((bundle) => bundle.index && isItemCompatibleWithSlot({
      slot: bundle.slot,
      item: candidate,
      compatibilityIndex: bundle.index,
    }).compatible)
  )));
}

export function isTurretGroupCompatibilityEditable(bundles: TurretGroupCompatibilityBundle[]): boolean {
  return bundles.length > 0
    && bundles.every((bundle) => bundle.index?.status === "known")
    && bundles.every((bundle) => bundle.slot.editable && !bundle.slot.locked && !bundle.slot.bespoke);
}

export function turretGroupCompatibilityMessage(
  selection: MockupWeaponSelection,
  bundles: TurretGroupCompatibilityBundle[],
  loading: boolean,
  matchedCount: number,
): string | null {
  if (loading) return "Loading compatible weapons…";
  if (!selection.isTurretGroup) return null;
  if (!turretGroupHasUniformChildPorts(selection.childRows)) {
    return "Mixed turret hardpoints — configure each gun separately.";
  }
  if (!isTurretGroupCompatibilityEditable(bundles)) {
    return "This turret group cannot be edited.";
  }
  if (matchedCount === 0) {
    return "No weapons are compatible with every gun port in this turret.";
  }
  return null;
}
