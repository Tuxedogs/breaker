import { useEffect, useMemo, useState } from "react";
import type { ComponentCardIndexRecord } from "../componentCardIndex";
import type { FittingComponentDetail } from "./fittingApi";
import { getFittingBuildContext } from "./fittingBuildContext";
import {
  cacheFpsComponentFromCard,
  getCachedFpsComponentFromCard,
  getFittingComponentCacheEntry,
  isAbortError,
  isNotFoundError,
  loadVehicleFittingComponent,
} from "./fittingComponentStore";

export {
  cacheFpsComponentFromCard,
  getCachedFittingComponent,
  getCachedFpsComponentFromCard,
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

  const [loading, setLoading] = useState(() => {
    if (!normalizedEntityClass) return false;
    const entry = getFittingComponentCacheEntry(normalizedEntityClass, "vehicle_fitting_detail");
    return !entry;
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!normalizedEntityClass) {
      queueMicrotask(() => {
        setLoading(false);
        setError(null);
      });
      return;
    }

    let cancelled = false;

    const cachedEntry = getFittingComponentCacheEntry(normalizedEntityClass, "vehicle_fitting_detail");
    if (cachedEntry) {
      queueMicrotask(() => {
        if (cancelled) return;
        setLoading(false);
        setError(null);
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });

    loadVehicleFittingComponent(normalizedEntityClass)
      .then(() => {
        if (cancelled) return;
        setLoading(false);
        setError(null);
      })
      .catch((fetchError: unknown) => {
        if (cancelled || isAbortError(fetchError)) return;

        const resolvedEntry = getFittingComponentCacheEntry(normalizedEntityClass, "vehicle_fitting_detail");
        if (resolvedEntry || isNotFoundError(fetchError)) {
          setLoading(false);
          setError(null);
          return;
        }

        setError(fetchError instanceof Error ? fetchError.message : "Fitting stats unavailable");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedEntityClass, channel, buildId]);

  const cacheEntry = normalizedEntityClass
    ? getFittingComponentCacheEntry(normalizedEntityClass, "vehicle_fitting_detail")
    : null;
  if (cacheEntry?.status === "resolved") {
    return { detail: cacheEntry.detail, loading: false, error: null, missing: false };
  }
  if (cacheEntry?.status === "missing") {
    return { detail: null, loading: false, error: null, missing: true };
  }

  // Unsettled identities must not leak a prior identity's detail into stats regions.
  return {
    detail: null,
    loading: Boolean(normalizedEntityClass) && (loading || !error),
    error,
    missing: false,
  };
}

export function useFpsFittingComponentFromCard(
  card: ComponentCardIndexRecord | null | undefined,
  cardLoading = false,
): FittingComponentStatsState {
  const identity = card?.entityClass?.trim() ?? "";
  const { channel, buildId } = getFittingBuildContext();

  const detail = useMemo(() => {
    if (!card || !identity) return null;
    return cacheFpsComponentFromCard(identity, card) ?? getCachedFpsComponentFromCard(identity);
  }, [card, identity, channel, buildId]);

  const missing = !cardLoading && Boolean(card) && !detail;

  return {
    detail,
    loading: cardLoading,
    error: null,
    missing,
  };
}
