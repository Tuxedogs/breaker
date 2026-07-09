import { useEffect, useState } from "react";
import {
  listCompatibleComponents,
  type FittingComponentSummary,
  type FittingCompatibleComponentsResult,
} from "./fittingApi";
import {
  buildSlotCompatibilityIndex,
  type SlotCompatibilityIndex,
} from "./fittingSlotCompatibility";
import type { PortBreakdownRow } from "./fittingPortGrouping";

export type CompatibleDrawerState = {
  loading: boolean;
  error: boolean;
  result: FittingCompatibleComponentsResult | null;
  compatibilityIndex: SlotCompatibilityIndex | null;
  requestPortId: string | null;
};

export function useCompatibleComponents(
  shipId: string | null,
  slot: PortBreakdownRow | null,
  enabled: boolean,
): CompatibleDrawerState {
  const portId = slot?.portId ?? null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [result, setResult] = useState<FittingCompatibleComponentsResult | null>(null);
  const [requestPortId, setRequestPortId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !shipId || !portId || !slot) {
      queueMicrotask(() => {
        setResult(null);
        setRequestPortId(null);
        setLoading(false);
        setError(false);
      });
      return;
    }

    const activePortId = portId;
    const controller = new AbortController();
    queueMicrotask(() => {
      setResult(null);
      setRequestPortId(activePortId);
      setLoading(true);
      setError(false);
    });

    listCompatibleComponents(shipId, activePortId, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        if (response.portId !== activePortId) {
          setLoading(false);
          return;
        }
        setResult(response);
        setRequestPortId(activePortId);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setResult(null);
        setRequestPortId(activePortId);
        setError(true);
        setLoading(false);
      });

    return () => controller.abort();
  }, [enabled, portId, shipId, slot]);

  const compatibilityIndex = slot && requestPortId === portId
    ? buildSlotCompatibilityIndex(slot, result, error)
    : slot
      ? buildSlotCompatibilityIndex(slot, null, true)
      : null;

  return {
    loading,
    error,
    result,
    compatibilityIndex,
    requestPortId,
  };
}

export function componentStatSummary(component: FittingComponentSummary): string {
  const parts = [
    component.type ? component.type.replace(/_/g, " ") : null,
    component.size != null ? `S${component.size}` : null,
    component.grade ?? null,
    component.class ?? null,
  ].filter(Boolean);
  return parts.join(" · ") || "Component";
}
