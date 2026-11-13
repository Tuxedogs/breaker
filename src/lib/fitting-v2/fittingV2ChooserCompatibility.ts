import { useEffect, useMemo, useState } from "react";
import {
  listCompatibleComponents,
  type FittingCompatibleComponentsResult,
} from "../fitting/fittingApi";
import {
  buildSlotCompatibilityIndex,
  canonicalFittingId,
  isItemCompatibleWithSlot,
  type SlotCompatibilityIndex,
} from "../fitting/fittingSlotCompatibility";
import type { PortBreakdownRow } from "../fitting/fittingPortGrouping";
import type { FittingV2Target } from "./fittingV2SlotTopology";

export type FittingV2ChooserCompatibility = {
  loading: boolean;
  error: string | null;
  result: FittingCompatibleComponentsResult | null;
  indexes: Record<string, SlotCompatibilityIndex>;
};

const EMPTY: FittingV2ChooserCompatibility = { loading: false, error: null, result: null, indexes: {} };

export function isFittingV2TargetPotentiallyActionable(target: FittingV2Target): boolean {
  return target.replacement !== "informational"
    && target.structural.editable
    && !target.structural.locked
    && !target.structural.bespoke;
}

function intersectRackCandidates(results: FittingCompatibleComponentsResult[]): FittingCompatibleComponentsResult | null {
  const first = results[0];
  if (!first) return null;
  const eligible = results.slice(1).reduce((ids, result) => {
    const next = new Set(result.components.map((component) => canonicalFittingId(component.id)));
    return new Set([...ids].filter((id) => next.has(id)));
  }, new Set(first.components.map((component) => canonicalFittingId(component.id))));
  const allKnown = results.every((result) => result.status === "known");
  return {
    ...first,
    status: allKnown ? (eligible.size ? "known" : "none") : "unknown",
    components: first.components.filter((component) => eligible.has(canonicalFittingId(component.id))),
  };
}

export function useFittingV2ChooserCompatibility(
  shipId: string | null,
  target: FittingV2Target | null,
  rows: readonly PortBreakdownRow[],
): FittingV2ChooserCompatibility {
  const portIds = useMemo(() => {
    if (!target || !isFittingV2TargetPotentiallyActionable(target)) return [];
    return target.replacement === "rack-payload" ? target.payloadPortIds ?? [] : [target.compatibilityPortId];
  }, [target]);
  const portKey = portIds.join("|");
  const [state, setState] = useState<FittingV2ChooserCompatibility>(EMPTY);

  useEffect(() => {
    if (!shipId || !target || portIds.length === 0) {
      queueMicrotask(() => setState(EMPTY));
      return;
    }
    const slots = portIds.map((id) => rows.find((row) => row.portId === id) ?? null);
    if (slots.some((slot) => !slot)) {
      queueMicrotask(() => setState({ ...EMPTY, error: "Selected fitting port was not found." }));
      return;
    }
    const controller = new AbortController();
    queueMicrotask(() => setState({ loading: true, error: null, result: null, indexes: {} }));
    Promise.all(portIds.map((portId) => listCompatibleComponents(shipId, portId, controller.signal)))
      .then((results) => {
        if (controller.signal.aborted || results.some((result, index) => result.portId !== portIds[index])) return;
        const indexes = Object.fromEntries(results.map((result, index) => [
          portIds[index], buildSlotCompatibilityIndex(slots[index]!, result),
        ]));
        const rawResult = target.replacement === "rack-payload" ? intersectRackCandidates(results) : results[0] ?? null;
        const result = rawResult && {
          ...rawResult,
          components: rawResult.components.filter((item) => portIds.every((portId, index) =>
            isItemCompatibleWithSlot({ slot: slots[index]!, item, compatibilityIndex: indexes[portId] }).compatible,
          )),
        };
        setState({ loading: false, error: null, result, indexes });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ ...EMPTY, error: "Compatible items could not be loaded." });
      });
    return () => controller.abort();
  }, [portKey, portIds, rows, shipId, target]);

  return state;
}

export function canOpenFittingV2Chooser(
  target: FittingV2Target,
  compatibility: FittingV2ChooserCompatibility,
): boolean {
  if (!isFittingV2TargetPotentiallyActionable(target) || !compatibility.result) return false;
  const index = compatibility.indexes[target.compatibilityPortId];
  return Boolean(index && index.status === "known" && compatibility.result.components.length > 0);
}
