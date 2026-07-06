import { useEffect, useState } from "react";
import { getFittingComponent, type FittingComponentDetail } from "./fittingApi";

const resolvedCache = new Map<string, FittingComponentDetail>();
const inflightCache = new Map<string, Promise<FittingComponentDetail>>();

function cacheKey(entityClass: string): string {
  return entityClass.trim().toLowerCase();
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("404");
}

function loadFittingComponent(entityClass: string, signal?: AbortSignal): Promise<FittingComponentDetail> {
  const key = cacheKey(entityClass);
  const cached = resolvedCache.get(key);
  if (cached) return Promise.resolve(cached);

  const inflight = inflightCache.get(key);
  if (inflight) return inflight;

  const promise = getFittingComponent(entityClass, signal)
    .then((detail) => {
      resolvedCache.set(key, detail);
      inflightCache.delete(key);
      return detail;
    })
    .catch((error) => {
      inflightCache.delete(key);
      throw error;
    });

  inflightCache.set(key, promise);
  return promise;
}

export function prefetchFittingComponents(entityClasses: readonly string[]): void {
  for (const entityClass of entityClasses) {
    const normalized = entityClass.trim();
    if (!normalized) continue;
    const key = cacheKey(normalized);
    if (resolvedCache.has(key) || inflightCache.has(key)) continue;
    loadFittingComponent(normalized).catch(() => undefined);
  }
}

export function getCachedFittingComponent(
  entityClass: string | null | undefined,
): FittingComponentDetail | null {
  const normalized = entityClass?.trim();
  if (!normalized) return null;
  return resolvedCache.get(cacheKey(normalized)) ?? null;
}

export type FittingComponentStatsState = {
  detail: FittingComponentDetail | null;
  loading: boolean;
  error: string | null;
  missing: boolean;
};

export function useFittingComponentStats(entityClass: string | null | undefined): FittingComponentStatsState {
  const normalizedEntityClass = entityClass?.trim() ?? "";
  const [detail, setDetail] = useState<FittingComponentDetail | null>(() => {
    if (!normalizedEntityClass) return null;
    return resolvedCache.get(cacheKey(normalizedEntityClass)) ?? null;
  });
  const [loading, setLoading] = useState(() => {
    if (!normalizedEntityClass) return false;
    return !resolvedCache.has(cacheKey(normalizedEntityClass));
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

    const cached = resolvedCache.get(cacheKey(normalizedEntityClass));
    if (cached) {
      queueMicrotask(() => {
        setDetail(cached);
        setLoading(false);
        setError(null);
        setMissing(false);
      });
      return;
    }

    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      setMissing(false);
      setDetail(null);
    });

    loadFittingComponent(normalizedEntityClass, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setDetail(result);
          setLoading(false);
        }
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        if (isNotFoundError(fetchError)) {
          setMissing(true);
          setDetail(null);
          setError(null);
        } else {
          setError(fetchError instanceof Error ? fetchError.message : "Fitting stats unavailable");
          setDetail(null);
        }
        setLoading(false);
      });

    return () => controller.abort();
  }, [normalizedEntityClass]);

  return { detail, loading, error, missing };
}
