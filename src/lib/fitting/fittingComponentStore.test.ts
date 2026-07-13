import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { ComponentCardIndexRecord } from "../componentCardIndex.ts";
import {
  resetFittingBuildContextBootstrapForTests,
  setFittingBuildContextBootstrapperForTests,
  type FittingComponentDetail,
} from "./fittingApi.ts";
import { createMemoryFittingComponentPersistentStorage } from "./fittingComponentPersistentStorage.ts";
import {
  cacheFpsComponentFromCard,
  clearFittingComponentMemoryForTests,
  getCachedFittingComponent,
  getCachedFpsComponentFromCard,
  getFittingComponentCacheEntry,
  loadFpsComponentFromCard,
  loadVehicleFittingComponent,
  normalizeFittingComponentIdentity,
  prefetchFittingComponents,
  resetFittingComponentStoreForTests,
  serializeFittingComponentCacheKey,
  setFittingComponentPersistentStorageForTests,
  setVehicleFittingComponentLoaderForTests,
} from "./fittingComponentStore.ts";
import {
  captureFittingApiMeta,
  getFittingBuildContext,
  getFittingBuildId,
  resetFittingBuildContextForTests,
  setFittingChannel,
} from "./fittingBuildContext.ts";

const SAMPLE_DETAIL: FittingComponentDetail = {
  id: "comp-1",
  name: "Comp",
  displayName: "Comp",
  manufacturer: null,
  type: "Shield",
  subtype: null,
  size: 1,
  grade: null,
  class: "entity-class-a",
  confidence: "high",
  stats: { shieldHp: 1000 },
  mitigation: null,
};

function loadCard(blueprintId: string): ComponentCardIndexRecord {
  const filePath = path.join(
    process.cwd(),
    "server-data",
    "crafting",
    "component-cards",
    "by-id",
    `${blueprintId}.json`,
  );
  return JSON.parse(readFileSync(filePath, "utf8")) as ComponentCardIndexRecord;
}

function resetStores(): void {
  resetFittingBuildContextForTests();
  resetFittingBuildContextBootstrapForTests();
  resetFittingComponentStoreForTests();
}

test.beforeEach(() => {
  resetStores();
});

test("cache key includes channel, buildId, sourceType, and normalized identity", () => {
  const key = serializeFittingComponentCacheKey({
    channel: "LIVE",
    buildId: "build-1",
    sourceType: "vehicle_fitting_detail",
    componentIdentity: " Entity_Class_A ",
  });
  assert.equal(key, "LIVE::build-1::vehicle_fitting_detail::entity_class_a");
  assert.equal(normalizeFittingComponentIdentity("Entity_Class_A"), "entity_class_a");
  assert.throws(
    () => serializeFittingComponentCacheKey({
      channel: "LIVE",
      buildId: "  ",
      sourceType: "vehicle_fitting_detail",
      componentIdentity: "entity-class-a",
    }),
    /buildId/,
  );
});

test("concurrent vehicle loads share one in-flight promise", async () => {
  captureFittingApiMeta({ channel: "LIVE", buildId: "live-build" });

  let fetchCount = 0;
  setVehicleFittingComponentLoaderForTests(async () => {
    fetchCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return SAMPLE_DETAIL;
  });

  const [first, second] = await Promise.all([
    loadVehicleFittingComponent("entity-class-a"),
    loadVehicleFittingComponent("entity-class-a"),
  ]);
  assert.equal(fetchCount, 1);
  assert.equal(first.id, SAMPLE_DETAIL.id);
  assert.equal(second.id, SAMPLE_DETAIL.id);
});

test("resolved vehicle entries survive remount reads from shared store", async () => {
  captureFittingApiMeta({ channel: "LIVE", buildId: "live-build" });
  setVehicleFittingComponentLoaderForTests(async () => SAMPLE_DETAIL);

  await loadVehicleFittingComponent("entity-class-a");
  assert.deepEqual(getCachedFittingComponent("entity-class-a"), SAMPLE_DETAIL);
  assert.equal(getFittingComponentCacheEntry("entity-class-a")?.status, "resolved");
});

test("missing and failed vehicle loads remain distinct and failed stays retryable", async () => {
  captureFittingApiMeta({ channel: "LIVE", buildId: "live-build" });

  setVehicleFittingComponentLoaderForTests(async () => {
    throw new Error("Fitting API request failed: 404");
  });
  await assert.rejects(() => loadVehicleFittingComponent("missing-comp"), /404/);
  assert.equal(getFittingComponentCacheEntry("missing-comp")?.status, "missing");
  assert.equal(getCachedFittingComponent("missing-comp"), null);

  let attempts = 0;
  setVehicleFittingComponentLoaderForTests(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("Fitting API request failed: 500");
    return SAMPLE_DETAIL;
  });

  await assert.rejects(() => loadVehicleFittingComponent("retry-comp"), /500/);
  assert.equal(getFittingComponentCacheEntry("retry-comp"), null);

  const resolved = await loadVehicleFittingComponent("retry-comp");
  assert.equal(resolved.id, SAMPLE_DETAIL.id);
  assert.equal(attempts, 2);
});

test("buildId change purges the previous namespace for that channel", async () => {
  captureFittingApiMeta({ channel: "LIVE", buildId: "build-a" });
  setVehicleFittingComponentLoaderForTests(async () => SAMPLE_DETAIL);

  await loadVehicleFittingComponent("entity-class-a");
  assert.ok(getCachedFittingComponent("entity-class-a"));

  captureFittingApiMeta({ channel: "LIVE", buildId: "build-b" });
  assert.equal(getCachedFittingComponent("entity-class-a"), null);
});

test("LIVE and PTU vehicle cache entries stay isolated", async () => {
  captureFittingApiMeta({ channel: "LIVE", buildId: "live-build" });
  captureFittingApiMeta({ channel: "PTU", buildId: "ptu-build" });

  setVehicleFittingComponentLoaderForTests(async () => ({
    ...SAMPLE_DETAIL,
    id: getFittingBuildContext().channel === "PTU" ? "ptu-comp" : "live-comp",
  }));

  await loadVehicleFittingComponent("entity-class-a");
  assert.equal(getCachedFittingComponent("entity-class-a")?.id, "live-comp");

  setFittingChannel("PTU");
  assert.equal(getCachedFittingComponent("entity-class-a"), null);

  await loadVehicleFittingComponent("entity-class-a");
  assert.equal(getCachedFittingComponent("entity-class-a")?.id, "ptu-comp");

  setFittingChannel("LIVE");
  assert.equal(getCachedFittingComponent("entity-class-a")?.id, "live-comp");
});

test("vehicle and fps card source types do not share cache entries", async () => {
  captureFittingApiMeta({ channel: "LIVE", buildId: "live-build" });

  const card = loadCard("bd636d35-43fd-4782-a223-40ce0a727f39");
  cacheFpsComponentFromCard(card.entityClass, card);

  setVehicleFittingComponentLoaderForTests(async () => ({
    ...SAMPLE_DETAIL,
    id: "vehicle-comp",
    class: card.entityClass,
  }));

  await loadVehicleFittingComponent(card.entityClass);
  const fpsDetail = getCachedFpsComponentFromCard(card.entityClass);
  const vehicleDetail = getCachedFittingComponent(card.entityClass);
  assert.ok(fpsDetail);
  assert.ok(vehicleDetail);
  assert.notEqual(fpsDetail.id, vehicleDetail.id);
  assert.equal(getFittingComponentCacheEntry(card.entityClass, "fps_component_card")?.status, "resolved");
  assert.equal(getFittingComponentCacheEntry(card.entityClass, "vehicle_fitting_detail")?.status, "resolved");
});

test("prefetch skips resolved and in-flight vehicle entries", async () => {
  captureFittingApiMeta({ channel: "LIVE", buildId: "live-build" });

  let fetchCount = 0;
  setVehicleFittingComponentLoaderForTests(async () => {
    fetchCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return SAMPLE_DETAIL;
  });

  prefetchFittingComponents(["entity-class-a"]);
  prefetchFittingComponents(["entity-class-a"]);
  await loadVehicleFittingComponent("entity-class-a");
  assert.equal(fetchCount, 1);
});

test("persisted resolved and missing vehicle entries hydrate after memory clear", async () => {
  const persistence = createMemoryFittingComponentPersistentStorage();
  setFittingComponentPersistentStorageForTests(persistence);
  captureFittingApiMeta({ channel: "LIVE", buildId: "live-build" });

  let fetchCount = 0;
  setVehicleFittingComponentLoaderForTests(async (id) => {
    fetchCount += 1;
    if (id === "missing-comp") throw new Error("Fitting API request failed: 404");
    return SAMPLE_DETAIL;
  });

  await loadVehicleFittingComponent("entity-class-a");
  await assert.rejects(() => loadVehicleFittingComponent("missing-comp"), /404/);
  assert.equal(fetchCount, 2);

  clearFittingComponentMemoryForTests();
  assert.equal(getCachedFittingComponent("entity-class-a"), null);

  const hydrated = await loadVehicleFittingComponent("entity-class-a");
  assert.equal(hydrated.id, SAMPLE_DETAIL.id);
  await assert.rejects(() => loadVehicleFittingComponent("missing-comp"), /404/);
  assert.equal(fetchCount, 2);
});

test("failed vehicle loads are not persisted and remain retryable across memory clear", async () => {
  const persistence = createMemoryFittingComponentPersistentStorage();
  setFittingComponentPersistentStorageForTests(persistence);
  captureFittingApiMeta({ channel: "LIVE", buildId: "live-build" });

  let attempts = 0;
  setVehicleFittingComponentLoaderForTests(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("Fitting API request failed: 500");
    return SAMPLE_DETAIL;
  });

  await assert.rejects(() => loadVehicleFittingComponent("retry-comp"), /500/);
  assert.equal(await persistence.get("LIVE::live-build::vehicle_fitting_detail::retry-comp"), null);

  clearFittingComponentMemoryForTests();
  const resolved = await loadVehicleFittingComponent("retry-comp");
  assert.equal(resolved.id, SAMPLE_DETAIL.id);
  assert.equal(attempts, 2);
});

test("buildId change purges persisted vehicle entries for that channel", async () => {
  const persistence = createMemoryFittingComponentPersistentStorage();
  setFittingComponentPersistentStorageForTests(persistence);
  captureFittingApiMeta({ channel: "LIVE", buildId: "build-a" });
  setVehicleFittingComponentLoaderForTests(async () => SAMPLE_DETAIL);

  await loadVehicleFittingComponent("entity-class-a");
  assert.ok(await persistence.get("LIVE::build-a::vehicle_fitting_detail::entity-class-a"));

  captureFittingApiMeta({ channel: "LIVE", buildId: "build-b" });
  await Promise.resolve();
  assert.equal(await persistence.get("LIVE::build-a::vehicle_fitting_detail::entity-class-a"), null);

  let fetchCount = 0;
  setVehicleFittingComponentLoaderForTests(async () => {
    fetchCount += 1;
    return SAMPLE_DETAIL;
  });
  await loadVehicleFittingComponent("entity-class-a");
  assert.equal(fetchCount, 1);
});

test("LIVE and PTU persisted vehicle entries stay isolated", async () => {
  const persistence = createMemoryFittingComponentPersistentStorage();
  setFittingComponentPersistentStorageForTests(persistence);
  captureFittingApiMeta({ channel: "LIVE", buildId: "live-build" });
  captureFittingApiMeta({ channel: "PTU", buildId: "ptu-build" });

  setVehicleFittingComponentLoaderForTests(async () => ({
    ...SAMPLE_DETAIL,
    id: getFittingBuildContext().channel === "PTU" ? "ptu-comp" : "live-comp",
  }));

  await loadVehicleFittingComponent("entity-class-a");
  setFittingChannel("PTU");
  await loadVehicleFittingComponent("entity-class-a");

  assert.equal(
    (await persistence.get("LIVE::live-build::vehicle_fitting_detail::entity-class-a"))?.status,
    "resolved",
  );
  assert.equal(
    (await persistence.get("PTU::ptu-build::vehicle_fitting_detail::entity-class-a"))?.status,
    "resolved",
  );

  clearFittingComponentMemoryForTests();
  setFittingChannel("LIVE");
  assert.equal((await loadVehicleFittingComponent("entity-class-a")).id, "live-comp");
  setFittingChannel("PTU");
  assert.equal((await loadVehicleFittingComponent("entity-class-a")).id, "ptu-comp");
});

test("persisted fps component-card entries stay separate from vehicle fitting detail", async () => {
  const persistence = createMemoryFittingComponentPersistentStorage();
  setFittingComponentPersistentStorageForTests(persistence);
  captureFittingApiMeta({ channel: "LIVE", buildId: "live-build" });

  const card = loadCard("bd636d35-43fd-4782-a223-40ce0a727f39");
  cacheFpsComponentFromCard(card.entityClass, card);
  await Promise.resolve();

  setVehicleFittingComponentLoaderForTests(async () => ({
    ...SAMPLE_DETAIL,
    id: "vehicle-comp",
    class: card.entityClass,
  }));
  await loadVehicleFittingComponent(card.entityClass);

  const identity = normalizeFittingComponentIdentity(card.entityClass);
  assert.equal(
    (await persistence.get(`LIVE::live-build::fps_component_card::${identity}`))?.status,
    "resolved",
  );
  assert.equal(
    (await persistence.get(`LIVE::live-build::vehicle_fitting_detail::${identity}`))?.status,
    "resolved",
  );

  clearFittingComponentMemoryForTests();
  const fpsHydrated = await loadFpsComponentFromCard(card.entityClass, async () => {
    throw new Error("card loader should not run when persistence hits");
  });
  assert.ok(fpsHydrated);
  assert.notEqual(fpsHydrated.id, "vehicle-comp");
});

test("first-session cold Crafting Browser issues one detail GET per unique component after buildId resolves", async () => {
  assert.equal(getFittingBuildId(), null);

  let bootstrapCount = 0;
  let detailFetchCount = 0;
  const fetchedIds: string[] = [];

  setFittingBuildContextBootstrapperForTests(async () => {
    bootstrapCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 15));
    captureFittingApiMeta({ channel: "LIVE", buildId: "cold-build" });
  });

  setVehicleFittingComponentLoaderForTests(async (componentId) => {
    assert.equal(getFittingBuildId(), "cold-build");
    detailFetchCount += 1;
    fetchedIds.push(componentId);
    return { ...SAMPLE_DETAIL, id: componentId, class: componentId };
  });

  // Crafting Browser: prefetch visible vehicles, then cards also load the same ids.
  prefetchFittingComponents(["entity-class-a", "entity-class-b", "entity-class-a"]);
  const [a, b, aAgain] = await Promise.all([
    loadVehicleFittingComponent("entity-class-a"),
    loadVehicleFittingComponent("entity-class-b"),
    loadVehicleFittingComponent("entity-class-a"),
  ]);

  // Allow prefetch loop to settle after shared ensure.
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(bootstrapCount, 1);
  assert.equal(detailFetchCount, 2);
  assert.deepEqual([...fetchedIds].sort(), ["entity-class-a", "entity-class-b"]);
  assert.equal(a.id, "entity-class-a");
  assert.equal(b.id, "entity-class-b");
  assert.equal(aAgain.id, "entity-class-a");
  assert.equal(getFittingComponentCacheEntry("entity-class-a")?.status, "resolved");
});

test("first-session cold Build Queue issues one detail GET for the selected craft after buildId resolves", async () => {
  assert.equal(getFittingBuildId(), null);

  let bootstrapCount = 0;
  let detailFetchCount = 0;

  setFittingBuildContextBootstrapperForTests(async () => {
    bootstrapCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    captureFittingApiMeta({ channel: "LIVE", buildId: "bq-cold-build" });
  });

  setVehicleFittingComponentLoaderForTests(async (componentId) => {
    assert.equal(getFittingBuildId(), "bq-cold-build");
    detailFetchCount += 1;
    return { ...SAMPLE_DETAIL, id: componentId, class: componentId };
  });

  // Build Queue selected craft: single identity, may remount/reselect after meta resolves.
  const first = await loadVehicleFittingComponent("selected-craft");
  const second = await loadVehicleFittingComponent("selected-craft");

  assert.equal(bootstrapCount, 1);
  assert.equal(detailFetchCount, 1);
  assert.equal(first.id, "selected-craft");
  assert.equal(second.id, "selected-craft");
  assert.equal(
    getFittingComponentCacheEntry("selected-craft")?.status,
    "resolved",
  );
});

test("patch-static detail loader does not start before buildId is resolved", async () => {
  assert.equal(getFittingBuildId(), null);

  let detailFetchCount = 0;
  let releaseBootstrap: (() => void) | null = null;
  const bootstrapGate = new Promise<void>((resolve) => {
    releaseBootstrap = resolve;
  });

  setFittingBuildContextBootstrapperForTests(async () => {
    await bootstrapGate;
    captureFittingApiMeta({ channel: "LIVE", buildId: "gated-build" });
  });
  setVehicleFittingComponentLoaderForTests(async () => {
    detailFetchCount += 1;
    return SAMPLE_DETAIL;
  });

  const pending = loadVehicleFittingComponent("entity-class-a");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(detailFetchCount, 0);
  assert.equal(getFittingBuildId(), null);

  releaseBootstrap?.();
  await pending;
  assert.equal(detailFetchCount, 1);
  assert.equal(getFittingBuildId(), "gated-build");
});
