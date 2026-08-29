import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildReleaseStateMap,
  deriveBlueprintSourceRecords,
  deriveMissionBlueprintRewards,
  normalizeMissionBlueprintReward,
  type MissionContractsCatalog,
  type MissionRewardLookups,
} from "../server/crafting/blueprintSourcesNormalize.ts";
import { getCraftingBlueprintSourcesRoot } from "../server/config/craftingBlueprintSourcesRoot.ts";
import { getMissionDataRoot } from "../server/config/missionDataRoot.ts";
import { handleCraftingBlueprintSourcesRoute } from "../server/routes/craftingBlueprintSources.routes.ts";
import {
  parseMissionBlueprintOfferJoin,
  type MissionGenerationJoinMetadata,
} from "./missions/blueprint-offer-join.mts";

type JsonObject = Record<string, unknown>;

type BlueprintSourcesIndex = {
  sourceLatestModifiedAt?: string;
  missionGeneration?: MissionGenerationJoinMetadata;
  summary?: {
    blueprintSourceCount?: number;
    missionRewardCount?: number;
  };
  blueprintFiles?: Record<string, string>;
  missionFiles?: Record<string, string>;
};

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as JsonObject;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function withoutOfferKey(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutOfferKey);
  if (!value || typeof value !== "object") return value;
  const { offerKey: _offerKey, ...rest } = value as JsonObject;
  return Object.fromEntries(
    Object.entries(rest).map(([key, item]) => [key, withoutOfferKey(item)]),
  );
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} changed unexpectedly.`);
  }
}

function normalizedMissionInvariant(value: unknown): unknown {
  const mission = object(value, "normalized mission");
  const rewards = array(mission.rewards ?? [], "normalized mission rewards").map(
    (rewardValue) => {
      const reward = object(rewardValue, "normalized mission reward");
      return {
        rewardKey: reward.rewardKey ?? null,
        blueprintGuid: reward.blueprintGuid ?? null,
        poolGuid: reward.poolGuid ?? null,
        poolName: reward.poolName ?? null,
        poolChance: reward.poolChance ?? null,
        rewardChance: reward.rewardChance ?? null,
        chance: reward.chance ?? null,
        weight: reward.weight ?? null,
      };
    },
  ).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return {
    missionId: mission.missionId,
    conceptKey: mission.conceptKey ?? null,
    isDisabled: mission.isDisabled ?? null,
    isWorkInProgress: mission.isWorkInProgress ?? null,
    rewardPools: [...array(mission.rewardPools ?? [], "normalized mission reward pools")]
      .map(String)
      .sort(),
    rewards,
  };
}

function sortedMissionInvariants(values: unknown[]): unknown[] {
  return values.map(normalizedMissionInvariant).sort((left, right) => {
    const leftId = String((left as JsonObject).missionId ?? "");
    const rightId = String((right as JsonObject).missionId ?? "");
    return leftId.localeCompare(rightId);
  });
}

const root = getCraftingBlueprintSourcesRoot();
const missionSourceRoot = path.resolve("server-data", "missions", "source");
const missionGenerationRoot = process.env.MISSION_GENERATION_ROOT
  ? path.resolve(process.env.MISSION_GENERATION_ROOT)
  : getMissionDataRoot();
const [index, sourceCatalog, sourceLookups, missionIndex, missionManifest] = await Promise.all([
  readFile(path.join(root, "index.json"), "utf8").then((value) => JSON.parse(value) as BlueprintSourcesIndex),
  readFile(path.join(missionSourceRoot, "mission_contracts.json"), "utf8")
    .then((value) => JSON.parse(value) as MissionContractsCatalog),
  readFile(path.join(missionSourceRoot, "mission_reward_lookups.json"), "utf8")
    .then((value) => JSON.parse(value) as MissionRewardLookups),
  readFile(path.join(missionGenerationRoot, "mission_browser_index.json"), "utf8")
    .then((value) => JSON.parse(value) as unknown),
  readFile(path.join(missionGenerationRoot, "mission_shard_manifest.json"), "utf8")
    .then((value) => JSON.parse(value) as unknown),
]);
const sourceBlueprints = deriveBlueprintSourceRecords(sourceCatalog, sourceLookups);
const sourceMissions = deriveMissionBlueprintRewards(sourceCatalog, sourceLookups);
const missionJoin = parseMissionBlueprintOfferJoin(
  missionIndex,
  missionManifest,
  sourceCatalog.sourceLatestModifiedAt,
);
if (index.missionGeneration) {
  equal(index.missionGeneration, missionJoin.metadata, "blueprint index mission generation");
} else if (missionJoin.variantOfferKeys) {
  throw new Error("Offer-capable blueprint source index is missing mission generation metadata.");
}
const expectedBlueprintCount = sourceBlueprints.filter(
  (record) => typeof record.blueprintGuid === "string" && record.blueprintGuid,
).length;
const expectedMissionCount = sourceMissions.filter(
  (record) => typeof record.contractId === "string" && record.contractId,
).length;

if (index.summary?.blueprintSourceCount !== expectedBlueprintCount) {
  throw new Error(`Expected ${expectedBlueprintCount} blueprint sources, found ${index.summary?.blueprintSourceCount ?? 0}.`);
}
if (index.summary?.missionRewardCount !== expectedMissionCount) {
  throw new Error(`Expected ${expectedMissionCount} mission rewards, found ${index.summary?.missionRewardCount ?? 0}.`);
}
if (Object.keys(index.blueprintFiles ?? {}).length !== expectedBlueprintCount) {
  throw new Error("Blueprint source index file map does not match the source artifact.");
}
if (Object.keys(index.missionFiles ?? {}).length !== expectedMissionCount) {
  throw new Error("Mission reward index file map does not match the source artifact.");
}

for (const sourceBlueprint of sourceBlueprints) {
  const blueprintGuid = typeof sourceBlueprint.blueprintGuid === "string"
    ? sourceBlueprint.blueprintGuid.toLowerCase()
    : "";
  if (!blueprintGuid) continue;
  const relativeFile = index.blueprintFiles?.[blueprintGuid];
  if (!relativeFile) throw new Error(`Blueprint ${blueprintGuid} has no shaped source file.`);
  const shaped = JSON.parse(
    await readFile(path.join(root, relativeFile), "utf8"),
  ) as { missionGeneration?: MissionGenerationJoinMetadata; missions?: unknown[] };
  if (shaped.missionGeneration) {
    equal(shaped.missionGeneration, missionJoin.metadata, `${blueprintGuid} mission generation`);
  } else if (missionJoin.variantOfferKeys) {
    throw new Error(`${blueprintGuid} is missing mission generation metadata.`);
  }
  equal(
    withoutOfferKey(shaped.missions ?? []),
    sourceBlueprint.missions ?? [],
    `${blueprintGuid} mission source tuples`,
  );
  if (missionJoin.variantOfferKeys) {
    for (const [missionIndex, missionValue] of array(
      shaped.missions ?? [],
      `${blueprintGuid}.missions`,
    ).entries()) {
      const mission = object(missionValue, `${blueprintGuid}.missions[${missionIndex}]`);
      const contractId = String(mission.contractId ?? "");
      equal(
        mission.offerKey,
        missionJoin.variantOfferKeys[contractId.toLowerCase()],
        `${blueprintGuid}/${contractId} offer owner`,
      );
      const poolGuid = String(mission.poolGuid ?? "");
      const bookmarkIdentity = `mission:${contractId}:${poolGuid}`;
      const sourceMission = object(
        (sourceBlueprint.missions ?? [])[missionIndex],
        `${blueprintGuid}.sourceMissions[${missionIndex}]`,
      );
      equal(
        bookmarkIdentity,
        `mission:${String(sourceMission.contractId ?? "")}:${String(sourceMission.poolGuid ?? "")}`,
        `${blueprintGuid}/${contractId} bookmark identity`,
      );
    }
  }
}

const normalizedSourceMissions = sourceMissions
  .map((mission) => normalizeMissionBlueprintReward(mission))
  .filter((mission): mission is NonNullable<typeof mission> => Boolean(mission));
const shapedCatalog = JSON.parse(
  await readFile(path.join(root, "missions", "catalog.json"), "utf8"),
) as { missionGeneration?: MissionGenerationJoinMetadata; missions?: unknown[] };
if (shapedCatalog.missionGeneration) {
  equal(shapedCatalog.missionGeneration, missionJoin.metadata, "mission catalog generation");
} else if (missionJoin.variantOfferKeys) {
  throw new Error("Offer-capable mission catalog is missing mission generation metadata.");
}
equal(
  sortedMissionInvariants(array(shapedCatalog.missions ?? [], "shaped mission catalog")),
  sortedMissionInvariants(normalizedSourceMissions),
  "normalized mission reward tuples",
);
if (missionJoin.variantOfferKeys) {
  for (const missionValue of array(shapedCatalog.missions ?? [], "mission catalog missions")) {
    const mission = object(missionValue, "mission catalog mission");
    const missionId = String(mission.missionId ?? "");
    equal(
      mission.offerKey,
      missionJoin.variantOfferKeys[missionId.toLowerCase()],
      `${missionId} normalized mission offer owner`,
    );
  }
}

const releaseState = JSON.parse(
  await readFile(path.join(root, "release-state.json"), "utf8"),
) as { missionGeneration?: MissionGenerationJoinMetadata; states?: Record<string, boolean> };
if (releaseState.missionGeneration) {
  equal(releaseState.missionGeneration, missionJoin.metadata, "release-state generation");
} else if (missionJoin.variantOfferKeys) {
  throw new Error("Offer-capable release-state artifact is missing mission generation metadata.");
}
equal(releaseState.states ?? {}, buildReleaseStateMap(sourceMissions), "mission release flags");

const sampleBlueprintGuid = Object.keys(index.blueprintFiles ?? {})[0];
const sampleContractId = Object.keys(index.missionFiles ?? {})[0];
if (!sampleBlueprintGuid || !sampleContractId) {
  throw new Error("Shaped blueprint source index is missing sample lookup keys.");
}

const checks: Array<{ name: string; run: () => Promise<void> }> = [
  {
    name: "GET /api/crafting/blueprint-sources/index",
    run: async () => {
      const result = await handleCraftingBlueprintSourcesRoute(
        "GET",
        "/api/crafting/blueprint-sources/index",
        {},
      );
      if (!result || result.status !== 200) throw new Error(`Unexpected status: ${result?.status ?? "null"}`);
      const body = result.body as { blueprintGuids?: string[] };
      if (!Array.isArray(body.blueprintGuids) || body.blueprintGuids.length !== expectedBlueprintCount) {
        throw new Error(`Expected ${expectedBlueprintCount} blueprint guids, found ${body.blueprintGuids?.length ?? 0}.`);
      }
    },
  },
  {
    name: "GET /api/crafting/blueprint-sources",
    run: async () => {
      const result = await handleCraftingBlueprintSourcesRoute(
        "GET",
        `/api/crafting/blueprint-sources?blueprintGuid=${encodeURIComponent(sampleBlueprintGuid)}`,
        {},
      );
      if (!result || result.status !== 200) throw new Error(`Unexpected status: ${result?.status ?? "null"}`);
      const body = result.body as { blueprintGuid?: string; missions?: unknown[] };
      if (body.blueprintGuid !== sampleBlueprintGuid) throw new Error("blueprintGuid mismatch.");
      if (!Array.isArray(body.missions)) throw new Error("missions array missing.");
    },
  },
  {
    name: "POST /api/crafting/blueprint-sources/batch",
    run: async () => {
      const result = await handleCraftingBlueprintSourcesRoute(
        "POST",
        "/api/crafting/blueprint-sources/batch",
        { blueprintGuids: [sampleBlueprintGuid] },
      );
      if (!result || result.status !== 200) throw new Error(`Unexpected status: ${result?.status ?? "null"}`);
      const body = result.body as { byBlueprintGuid?: Record<string, unknown> };
      if (!body.byBlueprintGuid?.[sampleBlueprintGuid]) throw new Error("batch response missing blueprint slice.");
    },
  },
  {
    name: "GET /api/crafting/blueprint-rewards/release-state",
    run: async () => {
      const result = await handleCraftingBlueprintSourcesRoute(
        "GET",
        "/api/crafting/blueprint-rewards/release-state",
        {},
      );
      if (!result || result.status !== 200) throw new Error(`Unexpected status: ${result?.status ?? "null"}`);
      const body = result.body as { states?: Record<string, boolean> };
      if (!body.states || Object.keys(body.states).length === 0) throw new Error("release-state.states missing.");
    },
  },
  {
    name: "GET /api/crafting/blueprint-rewards/missions",
    run: async () => {
      const result = await handleCraftingBlueprintSourcesRoute(
        "GET",
        "/api/crafting/blueprint-rewards/missions",
        {},
      );
      if (!result || result.status !== 200) throw new Error(`Unexpected status: ${result?.status ?? "null"}`);
      const body = result.body as { missions?: unknown[] };
      if (!Array.isArray(body.missions) || body.missions.length !== expectedMissionCount) {
        throw new Error(`Expected ${expectedMissionCount} normalized missions, found ${body.missions?.length ?? 0}.`);
      }
    },
  },
  {
    name: "GET /api/crafting/blueprint-rewards/missions/:contractId",
    run: async () => {
      const result = await handleCraftingBlueprintSourcesRoute(
        "GET",
        `/api/crafting/blueprint-rewards/missions/${encodeURIComponent(sampleContractId)}`,
        {},
      );
      if (!result || result.status !== 200) throw new Error(`Unexpected status: ${result?.status ?? "null"}`);
      const body = result.body as { missionId?: string };
      if (body.missionId?.toLowerCase() !== sampleContractId) throw new Error("missionId mismatch.");
    },
  },
];

for (const check of checks) {
  await check.run();
  console.log(`OK ${check.name}`);
}

console.log("crafting blueprint sources API verification passed.");
