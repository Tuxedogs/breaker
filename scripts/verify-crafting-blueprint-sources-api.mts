import { readFile } from "node:fs/promises";
import path from "node:path";

import { getCraftingBlueprintSourcesRoot } from "../server/config/craftingBlueprintSourcesRoot.ts";
import { handleCraftingBlueprintSourcesRoute } from "../server/routes/craftingBlueprintSources.routes.ts";

type BlueprintSourcesIndex = {
  summary?: {
    blueprintSourceCount?: number;
    missionRewardCount?: number;
  };
  blueprintFiles?: Record<string, string>;
  missionFiles?: Record<string, string>;
};

const root = getCraftingBlueprintSourcesRoot();
const missionSourceRoot = path.resolve("server-data", "missions", "source");
const [index, sourceBlueprints, sourceMissions] = await Promise.all([
  readFile(path.join(root, "index.json"), "utf8").then((value) => JSON.parse(value) as BlueprintSourcesIndex),
  readFile(path.join(missionSourceRoot, "blueprint_reward_sources.json"), "utf8")
    .then((value) => JSON.parse(value) as Array<{ blueprintGuid?: string }>),
  readFile(path.join(missionSourceRoot, "mission_blueprint_rewards.json"), "utf8")
    .then((value) => JSON.parse(value) as Array<{ contractId?: string }>),
]);
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
