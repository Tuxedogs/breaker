import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { listCompatibleComponents } from "./fittingApi";
import {
  buildTurretGroupCompatibilityBundles,
  type TurretGroupCompatibilityBundle,
} from "./fittingMockupTurretGroups";
import type { PortBreakdownRow } from "./fittingPortGrouping";

export type TurretGroupCompatibleState = {
  loading: boolean;
  error: boolean;
  bundles: TurretGroupCompatibilityBundle[];
  requestKey: string | null;
};

export function useTurretGroupCompatibleComponents(
  shipId: string | null,
  childRows: PortBreakdownRow[],
  enabled: boolean,
): TurretGroupCompatibleState {
  const requestKey = childRows.map((row) => row.portId).sort().join("|");
  const childRowsRef = useRef(childRows);
  useLayoutEffect(() => {
    childRowsRef.current = childRows;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [bundles, setBundles] = useState<TurretGroupCompatibilityBundle[]>([]);
  const [activeRequestKey, setActiveRequestKey] = useState<string | null>(null);

  const shouldFetch = enabled && Boolean(shipId) && requestKey.length > 0;

  useEffect(() => {
    if (!shouldFetch || !shipId) {
      return;
    }

    const activeKey = requestKey;
    const rows = childRowsRef.current;
    const controller = new AbortController();
    queueMicrotask(() => {
      setBundles([]);
      setActiveRequestKey(activeKey);
      setLoading(true);
      setError(false);
    });

    void (async () => {
      const resultsByPortId = new Map<string, { result: Awaited<ReturnType<typeof listCompatibleComponents>> | null; error: boolean }>();
      try {
        await Promise.all(rows.map(async (row) => {
          try {
            const result = await listCompatibleComponents(shipId, row.portId, controller.signal);
            if (controller.signal.aborted) return;
            resultsByPortId.set(row.portId, { result, error: false });
          } catch {
            if (controller.signal.aborted) return;
            resultsByPortId.set(row.portId, { result: null, error: true });
          }
        }));
        if (controller.signal.aborted) return;
        setBundles(buildTurretGroupCompatibilityBundles(childRowsRef.current, resultsByPortId));
        setActiveRequestKey(activeKey);
        setError(resultsByPortId.size !== rows.length || [...resultsByPortId.values()].some((entry) => entry.error));
        setLoading(false);
      } catch {
        if (controller.signal.aborted) return;
        setBundles([]);
        setActiveRequestKey(activeKey);
        setError(true);
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [requestKey, shipId, shouldFetch]);

  const isCurrentRequest = shouldFetch && activeRequestKey === requestKey;

  return {
    loading: isCurrentRequest && loading,
    error: isCurrentRequest && error,
    bundles: isCurrentRequest ? bundles : [],
    requestKey: isCurrentRequest ? activeRequestKey : null,
  };
}
