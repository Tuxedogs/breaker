import { useEffect, useState } from "react";
import { getFittingComponent, type FittingComponentDetail } from "./fittingApi";

const resolvedCache = new Map<string, FittingComponentDetail>();
const inflightCache = new Map<string, Promise<FittingComponentDetail>>();

function cacheKey(entityClass: string): string {
  return entityClass.trim().toLowerCase();
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  if (error instanceof Error && /NS_BINDING_ABORTED|aborted/i.test(error.message)) return true;
  return false;
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("404");
}

function readResolvedCache(entityClass: string): FittingComponentDetail | null {
  return resolvedCache.get(cacheKey(entityClass)) ?? null;
}

function loadFittingComponent(entityClass: string): Promise<FittingComponentDetail> {
  const key = cacheKey(entityClass);
  const cached = resolvedCache.get(key);
  if (cached) return Promise.resolve(cached);

  const inflight = inflightCache.get(key);
  if (inflight) return inflight;

  const promise = getFittingComponent(entityClass, undefined, () => readResolvedCache(entityClass))
    .then((detail) => {
      resolvedCache.set(key, detail);
      inflightCache.delete(key);
      return detail;
    })
    .catch((error) => {
      inflightCache.delete(key);
      const resolved = resolvedCache.get(key);
      if (resolved) return resolved;
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
    loadFittingComponent(normalized).catch((error) => {
      if (isAbortError(error)) return;
    });
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

    let cancelled = false;
    const key = cacheKey(normalizedEntityClass);

    const applyCached = (cached: FittingComponentDetail) => {
      setDetail(cached);
      setLoading(false);
      setError(null);
      setMissing(false);
    };

    const cached = resolvedCache.get(key);
    if (cached) {
      queueMicrotask(() => {
        if (cancelled) return;
        applyCached(cached);
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

    loadFittingComponent(normalizedEntityClass)
      .then((result) => {
        if (cancelled) return;
        applyCached(result);
      })
      .catch((fetchError: unknown) => {
        if (cancelled || isAbortError(fetchError)) return;

        const resolved = resolvedCache.get(key);
        if (resolved) {
          applyCached(resolved);
          return;
        }

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

    return () => {
      cancelled = true;
    };
  }, [normalizedEntityClass]);

  return { detail, loading, error, missing };
}
