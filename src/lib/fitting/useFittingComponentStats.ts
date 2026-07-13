import { useEffect, useState } from "react";
import type { FittingComponentDetail } from "./fittingApi";
import { getFittingBuildContext } from "./fittingBuildContext";
import {
  getFittingComponentCacheEntry,
  isAbortError,
  isNotFoundError,
  loadVehicleFittingComponent,
} from "./fittingComponentStore";

export {
  getCachedFittingComponent,
  prefetchFittingComponents,
} from "./fittingComponentStore";

export { isAbortError } from "./fittingComponentStore";

export type FittingComponentStatsState = {
  detail: FittingComponentDetail | null;
  loading: boolean;
  error: string | null;
  missing: boolean;
};

export function useFittingComponentStats(entityClass: string | null | undefined): FittingComponentStatsState {
  const normalizedEntityClass = entityClass?.trim() ?? "";
  const { channel, buildId } = getFittingBuildContext();

  const [detail, setDetail] = useState<FittingComponentDetail | null>(() => {
    if (!normalizedEntityClass) return null;
    const entry = getFittingComponentCacheEntry(normalizedEntityClass, "vehicle_fitting_detail");
    return entry?.status === "resolved" ? entry.detail : null;
  });
  const [loading, setLoading] = useState(() => {
    if (!normalizedEntityClass) return false;
    const entry = getFittingComponentCacheEntry(normalizedEntityClass, "vehicle_fitting_detail");
    return !entry;
  });
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!normalizedEntityClass) {
      queueMicrotask(() => {
        setDetail(null);
        setLoading(false);
        setError(null);
        setMissing(false);
      });
      return;
    }

    let cancelled = false;

    const applyResolved = (cached: FittingComponentDetail) => {
      setDetail(cached);
      setLoading(false);
      setError(null);
      setMissing(false);
    };

    const applyMissing = () => {
      setDetail(null);
      setLoading(false);
      setError(null);
      setMissing(true);
    };

    const cachedEntry = getFittingComponentCacheEntry(normalizedEntityClass, "vehicle_fitting_detail");
    if (cachedEntry?.status === "resolved") {
      queueMicrotask(() => {
        if (cancelled) return;
        applyResolved(cachedEntry.detail);
      });
      return () => {
        cancelled = true;
      };
    }
    if (cachedEntry?.status === "missing") {
      queueMicrotask(() => {
        if (cancelled) return;
        applyMissing();
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      setMissing(false);
      setDetail(null);
    });

    loadVehicleFittingComponent(normalizedEntityClass)
      .then((result) => {
        if (cancelled) return;
        applyResolved(result);
      })
      .catch((fetchError: unknown) => {
        if (cancelled || isAbortError(fetchError)) return;

        const resolvedEntry = getFittingComponentCacheEntry(normalizedEntityClass, "vehicle_fitting_detail");
        if (resolvedEntry?.status === "resolved") {
          applyResolved(resolvedEntry.detail);
          return;
        }
        if (resolvedEntry?.status === "missing" || isNotFoundError(fetchError)) {
          applyMissing();
          return;
        }

        setError(fetchError instanceof Error ? fetchError.message : "Fitting stats unavailable");
        setDetail(null);
        setMissing(false);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedEntityClass, channel, buildId]);

  return { detail, loading, error, missing };
}
