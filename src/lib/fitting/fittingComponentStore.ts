import type { ComponentCardIndexRecord } from "../componentCardIndex";
import { buildFittingDetailFromFpsComponentCard } from "../crafting/fpsComponentCardDetail";
import { getFittingComponent, type FittingComponentDetail } from "./fittingApi";
import {
  getFittingBuildContext,
  type FittingChannel,
} from "./fittingBuildContext";

export type VehicleFittingComponentLoader = (
  componentId: string,
  signal?: AbortSignal,
  resolveDetailCached?: () => FittingComponentDetail | null | undefined,
) => Promise<FittingComponentDetail>;

let vehicleComponentLoader: VehicleFittingComponentLoader = (
  componentId,
  signal,
  resolveDetailCached,
) => getFittingComponent(componentId, signal, resolveDetailCached);

export type FittingComponentSourceType = "vehicle_fitting_detail" | "fps_component_card";

export type FittingComponentCacheKey = {
  channel: FittingChannel;
  buildId: string | null;
  sourceType: FittingComponentSourceType;
  componentIdentity: string;
};

export type FittingComponentCacheEntry =
  | { status: "resolved"; detail: FittingComponentDetail }
  | { status: "missing" };

const resolvedEntries = new Map<string, FittingComponentCacheEntry>();
const inflightRequests = new Map<string, Promise<FittingComponentDetail>>();

export function normalizeFittingComponentIdentity(identity: string): string {
  return identity.trim().toLowerCase();
}

export function serializeFittingComponentCacheKey(key: FittingComponentCacheKey): string {
  return [
    key.channel,
    key.buildId ?? "",
    key.sourceType,
    normalizeFittingComponentIdentity(key.componentIdentity),
  ].join("::");
}

function buildCacheKey(
  componentIdentity: string,
  sourceType: FittingComponentSourceType,
): string {
  const { channel, buildId } = getFittingBuildContext();
  return serializeFittingComponentCacheKey({
    channel,
    buildId,
    sourceType,
    componentIdentity,
  });
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  if (error instanceof Error && /NS_BINDING_ABORTED|aborted/i.test(error.message)) return true;
  return false;
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("404");
}

export function getFittingComponentCacheEntry(
  componentIdentity: string,
  sourceType: FittingComponentSourceType = "vehicle_fitting_detail",
): FittingComponentCacheEntry | null {
  const normalized = componentIdentity.trim();
  if (!normalized) return null;
  return resolvedEntries.get(buildCacheKey(normalized, sourceType)) ?? null;
}

export function getCachedFittingComponent(
  entityClass: string | null | undefined,
): FittingComponentDetail | null {
  const normalized = entityClass?.trim();
  if (!normalized) return null;
  const entry = getFittingComponentCacheEntry(normalized, "vehicle_fitting_detail");
  return entry?.status === "resolved" ? entry.detail : null;
}

export function getCachedFpsComponentFromCard(
  componentIdentity: string | null | undefined,
): FittingComponentDetail | null {
  const normalized = componentIdentity?.trim();
  if (!normalized) return null;
  const entry = getFittingComponentCacheEntry(normalized, "fps_component_card");
  return entry?.status === "resolved" ? entry.detail : null;
}

function readResolvedDetail(
  componentIdentity: string,
  sourceType: FittingComponentSourceType,
): FittingComponentDetail | null {
  const entry = getFittingComponentCacheEntry(componentIdentity, sourceType);
  return entry?.status === "resolved" ? entry.detail : null;
}

export function purgeFittingComponentCacheNamespace(
  channel: FittingChannel,
  buildId: string | null,
): void {
  const prefix = `${channel}::${buildId ?? ""}::`;
  for (const key of resolvedEntries.keys()) {
    if (key.startsWith(prefix)) resolvedEntries.delete(key);
  }
  for (const key of inflightRequests.keys()) {
    if (key.startsWith(prefix)) inflightRequests.delete(key);
  }
}

export function resetFittingComponentStoreForTests(): void {
  resolvedEntries.clear();
  inflightRequests.clear();
  vehicleComponentLoader = (
    componentId,
    signal,
    resolveDetailCached,
  ) => getFittingComponent(componentId, signal, resolveDetailCached);
}

export function setVehicleFittingComponentLoaderForTests(
  loader: VehicleFittingComponentLoader | null,
): void {
  vehicleComponentLoader = loader ?? ((
    componentId,
    signal,
    resolveDetailCached,
  ) => getFittingComponent(componentId, signal, resolveDetailCached));
}

export function loadVehicleFittingComponent(entityClass: string): Promise<FittingComponentDetail> {
  const normalized = entityClass.trim();
  if (!normalized) {
    return Promise.reject(new Error("Fitting component identity is required"));
  }

  const key = buildCacheKey(normalized, "vehicle_fitting_detail");
  const cached = resolvedEntries.get(key);
  if (cached?.status === "resolved") return Promise.resolve(cached.detail);
  if (cached?.status === "missing") {
    return Promise.reject(new Error("Fitting API request failed: 404"));
  }

  const inflight = inflightRequests.get(key);
  if (inflight) return inflight;

  const promise = vehicleComponentLoader(normalized, undefined, () => readResolvedDetail(normalized, "vehicle_fitting_detail"))
    .then((detail) => {
      resolvedEntries.set(key, { status: "resolved", detail });
      inflightRequests.delete(key);
      return detail;
    })
    .catch((error) => {
      inflightRequests.delete(key);
      const resolved = readResolvedDetail(normalized, "vehicle_fitting_detail");
      if (resolved) return resolved;

      if (isNotFoundError(error)) {
        resolvedEntries.set(key, { status: "missing" });
      }
      throw error;
    });

  inflightRequests.set(key, promise);
  return promise;
}

export function prefetchFittingComponents(entityClasses: readonly string[]): void {
  for (const entityClass of entityClasses) {
    const normalized = entityClass.trim();
    if (!normalized) continue;

    const key = buildCacheKey(normalized, "vehicle_fitting_detail");
    const cached = resolvedEntries.get(key);
    if (cached || inflightRequests.has(key)) continue;

    loadVehicleFittingComponent(normalized).catch((error) => {
      if (isAbortError(error)) return;
    });
  }
}

export function cacheFpsComponentFromCard(
  componentIdentity: string,
  card: ComponentCardIndexRecord,
): FittingComponentDetail | null {
  const normalized = componentIdentity.trim();
  if (!normalized) return null;

  const detail = buildFittingDetailFromFpsComponentCard(card);
  if (!detail) return null;

  const key = buildCacheKey(normalized, "fps_component_card");
  resolvedEntries.set(key, { status: "resolved", detail });
  return detail;
}

export function loadFpsComponentFromCard(
  componentIdentity: string,
  cardLoader: () => Promise<ComponentCardIndexRecord | null>,
): Promise<FittingComponentDetail> {
  const normalized = componentIdentity.trim();
  if (!normalized) {
    return Promise.reject(new Error("Fitting component identity is required"));
  }

  const key = buildCacheKey(normalized, "fps_component_card");
  const cached = resolvedEntries.get(key);
  if (cached?.status === "resolved") return Promise.resolve(cached.detail);
  if (cached?.status === "missing") {
    return Promise.reject(new Error("FPS component card not found"));
  }

  const inflight = inflightRequests.get(key);
  if (inflight) return inflight;

  const promise = cardLoader()
    .then((card) => {
      if (!card) {
        resolvedEntries.set(key, { status: "missing" });
        throw new Error("FPS component card not found");
      }

      const detail = buildFittingDetailFromFpsComponentCard(card);
      if (!detail) {
        resolvedEntries.set(key, { status: "missing" });
        throw new Error("FPS component card not found");
      }

      resolvedEntries.set(key, { status: "resolved", detail });
      inflightRequests.delete(key);
      return detail;
    })
    .catch((error) => {
      inflightRequests.delete(key);
      const resolved = readResolvedDetail(normalized, "fps_component_card");
      if (resolved) return resolved;
      throw error;
    });

  inflightRequests.set(key, promise);
  return promise;
}
