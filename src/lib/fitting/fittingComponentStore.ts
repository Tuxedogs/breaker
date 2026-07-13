import type { ComponentCardIndexRecord } from "../componentCardIndex";
import { buildFittingDetailFromFpsComponentCard } from "../crafting/fpsComponentCardDetail";
import {
  ensureFittingBuildContext,
  getFittingComponent,
  type FittingComponentDetail,
} from "./fittingApi";
import {
  getFittingBuildContext,
  type FittingChannel,
} from "./fittingBuildContext";
import {
  createMemoryFittingComponentPersistentStorage,
  getDefaultFittingComponentPersistentStorage,
  type FittingComponentPersistentStorage,
} from "./fittingComponentPersistentStorage";

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

let persistentStorage: FittingComponentPersistentStorage =
  getDefaultFittingComponentPersistentStorage();

export type FittingComponentSourceType = "vehicle_fitting_detail" | "fps_component_card";

export type FittingComponentCacheKey = {
  channel: FittingChannel;
  buildId: string;
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
  const buildId = key.buildId.trim();
  if (!buildId) {
    throw new Error("Fitting cache keys require a resolved buildId");
  }
  return [
    key.channel,
    buildId,
    key.sourceType,
    normalizeFittingComponentIdentity(key.componentIdentity),
  ].join("::");
}

function tryBuildCacheKey(
  componentIdentity: string,
  sourceType: FittingComponentSourceType,
): string | null {
  const { channel, buildId } = getFittingBuildContext();
  if (!buildId) return null;
  return serializeFittingComponentCacheKey({
    channel,
    buildId,
    sourceType,
    componentIdentity,
  });
}

function requireBuildCacheKey(
  componentIdentity: string,
  sourceType: FittingComponentSourceType,
): string {
  const key = tryBuildCacheKey(componentIdentity, sourceType);
  if (!key) {
    throw new Error("Fitting build context unresolved");
  }
  return key;
}

function shouldPersistPatchStatic(): boolean {
  return getFittingBuildContext().buildId != null;
}

function persistEntry(key: string, entry: FittingComponentCacheEntry): void {
  if (!shouldPersistPatchStatic()) return;
  void persistentStorage.put(key, entry);
}

function rememberEntry(key: string, entry: FittingComponentCacheEntry): void {
  resolvedEntries.set(key, entry);
  persistEntry(key, entry);
}

async function readPersistentEntry(key: string): Promise<FittingComponentCacheEntry | null> {
  if (!shouldPersistPatchStatic()) return null;
  try {
    const entry = await persistentStorage.get(key);
    if (!entry) return null;
    if (entry.status !== "resolved" && entry.status !== "missing") return null;
    resolvedEntries.set(key, entry);
    return entry;
  } catch {
    return null;
  }
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
  const key = tryBuildCacheKey(normalized, sourceType);
  if (!key) return null;
  return resolvedEntries.get(key) ?? null;
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
  void persistentStorage.deleteNamespace(prefix);
}

export function resetFittingComponentStoreForTests(): void {
  resolvedEntries.clear();
  inflightRequests.clear();
  vehicleComponentLoader = (
    componentId,
    signal,
    resolveDetailCached,
  ) => getFittingComponent(componentId, signal, resolveDetailCached);
  persistentStorage = createMemoryFittingComponentPersistentStorage();
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

export function setFittingComponentPersistentStorageForTests(
  storage: FittingComponentPersistentStorage | null,
): void {
  persistentStorage = storage ?? createMemoryFittingComponentPersistentStorage();
}

export function getFittingComponentPersistentStorageForTests(): FittingComponentPersistentStorage {
  return persistentStorage;
}

export function clearFittingComponentMemoryForTests(): void {
  resolvedEntries.clear();
  inflightRequests.clear();
}

export async function loadVehicleFittingComponent(entityClass: string): Promise<FittingComponentDetail> {
  const normalized = entityClass.trim();
  if (!normalized) {
    throw new Error("Fitting component identity is required");
  }

  await ensureFittingBuildContext();

  const key = requireBuildCacheKey(normalized, "vehicle_fitting_detail");
  const cached = resolvedEntries.get(key);
  if (cached?.status === "resolved") return cached.detail;
  if (cached?.status === "missing") {
    throw new Error("Fitting API request failed: 404");
  }

  const inflight = inflightRequests.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const persisted = await readPersistentEntry(key);
    if (persisted?.status === "resolved") return persisted.detail;
    if (persisted?.status === "missing") {
      throw new Error("Fitting API request failed: 404");
    }

    try {
      const detail = await vehicleComponentLoader(
        normalized,
        undefined,
        () => readResolvedDetail(normalized, "vehicle_fitting_detail"),
      );
      rememberEntry(key, { status: "resolved", detail });
      return detail;
    } catch (error) {
      const resolved = readResolvedDetail(normalized, "vehicle_fitting_detail");
      if (resolved) return resolved;

      if (isNotFoundError(error)) {
        rememberEntry(key, { status: "missing" });
      }
      throw error;
    } finally {
      inflightRequests.delete(key);
    }
  })();

  inflightRequests.set(key, promise);
  return promise;
}

export function prefetchFittingComponents(entityClasses: readonly string[]): void {
  void (async () => {
    try {
      await ensureFittingBuildContext();
    } catch {
      return;
    }

    for (const entityClass of entityClasses) {
      const normalized = entityClass.trim();
      if (!normalized) continue;

      const key = tryBuildCacheKey(normalized, "vehicle_fitting_detail");
      if (!key) continue;
      const cached = resolvedEntries.get(key);
      if (cached || inflightRequests.has(key)) continue;

      loadVehicleFittingComponent(normalized).catch((error) => {
        if (isAbortError(error)) return;
      });
    }
  })();
}

export function cacheFpsComponentFromCard(
  componentIdentity: string,
  card: ComponentCardIndexRecord,
): FittingComponentDetail | null {
  const normalized = componentIdentity.trim();
  if (!normalized) return null;

  const detail = buildFittingDetailFromFpsComponentCard(card);
  if (!detail) return null;

  const key = tryBuildCacheKey(normalized, "fps_component_card");
  if (!key) return detail;

  rememberEntry(key, { status: "resolved", detail });
  return detail;
}

export async function loadFpsComponentFromCard(
  componentIdentity: string,
  cardLoader: () => Promise<ComponentCardIndexRecord | null>,
): Promise<FittingComponentDetail> {
  const normalized = componentIdentity.trim();
  if (!normalized) {
    throw new Error("Fitting component identity is required");
  }

  await ensureFittingBuildContext();

  const key = requireBuildCacheKey(normalized, "fps_component_card");
  const cached = resolvedEntries.get(key);
  if (cached?.status === "resolved") return cached.detail;
  if (cached?.status === "missing") {
    throw new Error("FPS component card not found");
  }

  const inflight = inflightRequests.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const persisted = await readPersistentEntry(key);
    if (persisted?.status === "resolved") return persisted.detail;
    if (persisted?.status === "missing") {
      throw new Error("FPS component card not found");
    }

    try {
      const card = await cardLoader();
      if (!card) {
        rememberEntry(key, { status: "missing" });
        throw new Error("FPS component card not found");
      }

      const detail = buildFittingDetailFromFpsComponentCard(card);
      if (!detail) {
        rememberEntry(key, { status: "missing" });
        throw new Error("FPS component card not found");
      }

      rememberEntry(key, { status: "resolved", detail });
      return detail;
    } catch (error) {
      const resolved = readResolvedDetail(normalized, "fps_component_card");
      if (resolved) return resolved;
      throw error;
    } finally {
      inflightRequests.delete(key);
    }
  })();

  inflightRequests.set(key, promise);
  return promise;
}
