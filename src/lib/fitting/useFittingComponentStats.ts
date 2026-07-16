import { useEffect, useMemo, useState } from "react";
import type { ComponentCardIndexRecord } from "../componentCardIndex";
import type { FittingComponentDetail } from "./fittingApi";
import { ensureFittingBuildContext } from "./fittingApi";
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
    if (!buildId) return true;
    const entry = getFittingComponentCacheEntry(normalizedEntityClass, "vehicle_fitting_detail");
    return !entry;
  });
  const [error, setError] = useState<string | null>(null);
  const [, setBuildEpoch] = useState(0);

  useEffect(() => {
    if (!normalizedEntityClass) {
      queueMicrotask(() => {
        setLoading(false);
        setError(null);
      });
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        await ensureFittingBuildContext();
      } catch (bootstrapError) {
        if (cancelled || isAbortError(bootstrapError)) return;
        setError(
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "Fitting build context unavailable",
        );
        setLoading(false);
        return;
      }

      if (cancelled) return;
      setBuildEpoch((value) => value + 1);

      const cachedEntry = getFittingComponentCacheEntry(normalizedEntityClass, "vehicle_fitting_detail");
      if (cachedEntry) {
        setLoading(false);
        setError(null);
        return;
      }

      try {
        await loadVehicleFittingComponent(normalizedEntityClass);
        if (cancelled) return;
        setLoading(false);
        setError(null);
      } catch (fetchError: unknown) {
        if (cancelled || isAbortError(fetchError)) return;

        const resolvedEntry = getFittingComponentCacheEntry(normalizedEntityClass, "vehicle_fitting_detail");
        if (resolvedEntry || isNotFoundError(fetchError)) {
          setLoading(false);
          setError(null);
          return;
        }

        setError(fetchError instanceof Error ? fetchError.message : "Fitting stats unavailable");
        setLoading(false);
      }
    };

    void run();

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
  // While buildId is unresolved, keep the fitting-dependent region in loading only.
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
  const [buildReady, setBuildReady] = useState(() => Boolean(buildId));

  useEffect(() => {
    if (buildId) {
      queueMicrotask(() => setBuildReady(true));
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setBuildReady(false);
    });
    void ensureFittingBuildContext()
      .then(() => {
        if (!cancelled) setBuildReady(true);
      })
      .catch(() => {
        if (!cancelled) setBuildReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [channel, buildId]);

  const detail = useMemo(() => {
    const currentContext = getFittingBuildContext();
    const contextIsCurrent = currentContext.channel === channel && currentContext.buildId === buildId;
    if (!card || !identity || !buildReady || !buildId || !contextIsCurrent) return null;
    return cacheFpsComponentFromCard(identity, card) ?? getCachedFpsComponentFromCard(identity);
  }, [card, identity, channel, buildId, buildReady]);

  const waitingOnBuild = Boolean(card) && Boolean(identity) && !buildReady;
  const missing = !cardLoading && !waitingOnBuild && Boolean(card) && !detail;

  return {
    detail,
    loading: cardLoading || waitingOnBuild,
    error: null,
    missing,
  };
}
