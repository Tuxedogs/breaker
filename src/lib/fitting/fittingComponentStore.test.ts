import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { ComponentCardIndexRecord } from "../componentCardIndex.ts";
import type { FittingComponentDetail } from "./fittingApi.ts";
import {
  cacheFpsComponentFromCard,
  getCachedFittingComponent,
  getCachedFpsComponentFromCard,
  getFittingComponentCacheEntry,
  loadVehicleFittingComponent,
  normalizeFittingComponentIdentity,
  prefetchFittingComponents,
  resetFittingComponentStoreForTests,
  serializeFittingComponentCacheKey,
  setVehicleFittingComponentLoaderForTests,
} from "./fittingComponentStore.ts";
import {
  captureFittingApiMeta,
  getFittingBuildContext,
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
