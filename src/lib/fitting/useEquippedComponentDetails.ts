import { useEffect, useMemo, useState } from "react";
import type { FittingComponentDetail, FittingComponentMitigation, FittingComponentStats } from "./fittingApi";
import {
  getCachedFittingComponent,
  getFittingComponentCacheEntry,
  loadVehicleFittingComponent,
} from "./fittingComponentStore";
import {
  adaptComponent,
  type FittingComponentRecord,
  type PortBreakdownRow,
} from "./fittingPortGrouping";

const IDS_KEY_SEPARATOR = "\0";

export function buildComponentIdsKey(componentIds: readonly string[]): string {
  if (componentIds.length === 0) return "";
  return [...new Set(componentIds)].sort().join(IDS_KEY_SEPARATOR);
}

export function collectEquippedComponentIds(portRows: readonly PortBreakdownRow[]): string[] {
  return [...new Set(portRows.map((row) => row.equippedComponentKey).filter(Boolean))] as string[];
}

export function equippedComponentIdsKey(portRows: readonly PortBreakdownRow[]): string {
  return buildComponentIdsKey(collectEquippedComponentIds(portRows));
}

export function collectMitigationComponentIds(portRows: readonly PortBreakdownRow[]): string[] {
  return collectEquippedComponentIds(
    portRows.filter((row) => {
      const text = `${row.ruleCategory ?? ""} ${row.portCategory ?? ""} ${row.componentCategory ?? ""} ${row.portName ?? ""}`.toLowerCase();
      return Boolean(row.equippedComponentKey) && (text.includes("shield") || text.includes("armor"));
    }),
  );
}

function splitComponentIdsKey(idsKey: string): string[] {
  return idsKey ? idsKey.split(IDS_KEY_SEPARATOR) : [];
}

function isComponentCacheSettled(componentId: string): boolean {
  return getFittingComponentCacheEntry(componentId) !== null;
}

function areComponentsSettled(componentIds: readonly string[]): boolean {
  return componentIds.length === 0 || componentIds.every(isComponentCacheSettled);
}

function hydrateDetailsFromStore(
  componentIds: readonly string[],
): Record<string, FittingComponentDetail | null> {
  const next: Record<string, FittingComponentDetail | null> = {};
  for (const componentId of componentIds) {
    next[componentId] = getCachedFittingComponent(componentId);
  }
  return next;
}

export type EquippedComponentDetailsState = {
  detailsById: Record<string, FittingComponentDetail | null>;
  statsById: Record<string, FittingComponentStats>;
  mitigationById: Record<string, FittingComponentMitigation | null>;
  loading: boolean;
  ready: boolean;
};

export function useEquippedComponentDetails(componentIds: readonly string[]): EquippedComponentDetailsState {
  const idsKey = buildComponentIdsKey(componentIds);
  const sortedIds = useMemo(() => splitComponentIdsKey(idsKey), [idsKey]);

  const [detailsById, setDetailsById] = useState<Record<string, FittingComponentDetail | null>>(() =>
    hydrateDetailsFromStore(sortedIds),
  );
  const [loading, setLoading] = useState(() => !areComponentsSettled(sortedIds));

  useEffect(() => {
    if (sortedIds.length === 0) {
      queueMicrotask(() => {
        setDetailsById({});
        setLoading(false);
      });
      return;
    }

    const hydrated = hydrateDetailsFromStore(sortedIds);
    const missing = sortedIds.filter((componentId) => !isComponentCacheSettled(componentId));

    if (missing.length === 0) {
      queueMicrotask(() => {
        setDetailsById(hydrated);
        setLoading(false);
      });
      return;
    }

    queueMicrotask(() => {
      // Clear published details until the full identity set settles so regions
      // never mix prior-loadout stats with a partial new set.
      setDetailsById({});
      setLoading(true);
    });

    let cancelled = false;
    void (async () => {
      await Promise.all(
        missing.map(async (componentId) => {
          try {
            await loadVehicleFittingComponent(componentId);
          } catch {
            // Missing/failed identities settle in the shared store; hydrate below.
          }
        }),
      );
      if (cancelled) return;
      setDetailsById(hydrateDetailsFromStore(sortedIds));
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [idsKey]);

  return useMemo(() => {
    const statsById: Record<string, FittingComponentStats> = {};
    const mitigationById: Record<string, FittingComponentMitigation | null> = {};
    for (const componentId of sortedIds) {
      const detail = detailsById[componentId];
      if (detail) {
        statsById[componentId] = detail.stats;
        mitigationById[componentId] = detail.mitigation;
      } else if (componentId in detailsById) {
        statsById[componentId] = {};
        mitigationById[componentId] = null;
      }
    }

    return {
      detailsById,
      statsById,
      mitigationById,
      loading,
      ready: !loading && areComponentsSettled(sortedIds),
    };
  }, [detailsById, loading, sortedIds]);
}

export function useEquippedComponentDetailsForPortRows(
  portRows: readonly PortBreakdownRow[],
): EquippedComponentDetailsState {
  const loadoutSignature = portRows
    .map((row) => `${row.portId}:${row.equippedComponentKey ?? ""}`)
    .join(IDS_KEY_SEPARATOR);
  const idsKey = useMemo(
    () => buildComponentIdsKey(collectEquippedComponentIds(portRows)),
    [loadoutSignature],
  );
  const componentIds = useMemo(() => splitComponentIdsKey(idsKey), [idsKey]);
  return useEquippedComponentDetails(componentIds);
}

export function buildComponentLookupFromDetails(
  detailsById: Record<string, FittingComponentDetail | null>,
): Map<string, FittingComponentRecord> {
  const lookup = new Map<string, FittingComponentRecord>();
  for (const [componentId, detail] of Object.entries(detailsById)) {
    if (detail) lookup.set(componentId, adaptComponent(detail));
  }
  return lookup;
}

export function useEquippedComponentLookup(portRows: readonly PortBreakdownRow[]): EquippedComponentDetailsState & {
  lookup: Map<string, FittingComponentRecord>;
} {
  const equipped = useEquippedComponentDetailsForPortRows(portRows);
  const lookup = useMemo(
    () => buildComponentLookupFromDetails(equipped.detailsById),
    [equipped.detailsById],
  );
  return { ...equipped, lookup };
}
