import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildReleaseStateMap,
  normalizeMissionBlueprintReward,
} from "../server/crafting/blueprintSourcesNormalize.ts";
import {
  craftingBlueprintSourcesMissionSourceRoot,
  getCraftingBlueprintSourcesRoot,
} from "../server/config/craftingBlueprintSourcesRoot.ts";

type JsonRecord = Record<string, unknown>;

type BlueprintSourceRecord = {
  blueprintGuid?: string;
  displayName?: string;
  componentType?: string;
  missions?: unknown[];
};

type MissionContractsCatalog = {
  sourceLatestModifiedAt?: string;
};

const outputRoot = getCraftingBlueprintSourcesRoot();
const byBlueprintRoot = path.join(outputRoot, "by-blueprint");
const missionsRoot = path.join(outputRoot, "missions");
const byContractRoot = path.join(missionsRoot, "by-contract");

async function resolveMissionSourceRoot(): Promise<string> {
  try {
    await access(path.join(craftingBlueprintSourcesMissionSourceRoot, "blueprint_reward_sources.json"));
    return craftingBlueprintSourcesMissionSourceRoot;
  } catch {
    throw new Error(
      "Mission reward source inputs are missing. Expected blueprint_reward_sources.json in server-data/missions/source.",
    );
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

function blueprintFileName(blueprintGuid: string): string {
  return `${blueprintGuid.toLowerCase()}.json`;
}

function contractFileName(contractId: string): string {
  return `${contractId.toLowerCase()}.json`;
}

const sourceRoot = await resolveMissionSourceRoot();
const [blueprintSources, missionRewards, missionCatalog] = await Promise.all([
  readJson<BlueprintSourceRecord[]>(path.join(sourceRoot, "blueprint_reward_sources.json")),
  readJson<unknown[]>(path.join(sourceRoot, "mission_blueprint_rewards.json")),
  readJson<MissionContractsCatalog>(path.join(sourceRoot, "mission_contracts.json")).catch(() => ({})),
]);

const generatedAt = new Date().toISOString();
const sourceLatestModifiedAt = missionCatalog.sourceLatestModifiedAt ?? generatedAt;
const releaseStates = buildReleaseStateMap(missionRewards);

const blueprintFiles: Record<string, string> = {};
let blueprintMissionCount = 0;

for (const record of blueprintSources) {
  const blueprintGuid = typeof record.blueprintGuid === "string" ? record.blueprintGuid.trim().toLowerCase() : "";
  if (!blueprintGuid) continue;
  const missions = Array.isArray(record.missions) ? record.missions : [];
  blueprintMissionCount += missions.length;
  const relativeFile = path.posix.join("by-blueprint", blueprintFileName(blueprintGuid));
  blueprintFiles[blueprintGuid] = relativeFile;
  await writeJson(path.join(outputRoot, relativeFile), {
    schemaVersion: 1,
    generatedAt,
    sourceLatestModifiedAt,
    blueprintGuid,
    missions,
  });
}

const normalizedMissions = missionRewards
  .map((mission) => normalizeMissionBlueprintReward(mission))
  .filter((mission): mission is NonNullable<typeof mission> => Boolean(mission));

const missionFiles: Record<string, string> = {};
for (const mission of normalizedMissions) {
  const relativeFile = path.posix.join("missions/by-contract", contractFileName(mission.missionId));
  missionFiles[mission.missionId.toLowerCase()] = relativeFile;
  await writeJson(path.join(outputRoot, relativeFile), {
    schemaVersion: 1,
    generatedAt,
    sourceLatestModifiedAt,
    missionId: mission.missionId,
    mission,
  });
}

const rewardCount = normalizedMissions.reduce((sum, mission) => sum + mission.rewards.length, 0);

await Promise.all([
  writeJson(path.join(outputRoot, "index.json"), {
    schemaVersion: 1,
    generatedAt,
    sourceLatestModifiedAt,
    sourceRoot,
    summary: {
      blueprintSourceCount: Object.keys(blueprintFiles).length,
      blueprintMissionLinkCount: blueprintMissionCount,
      missionRewardCount: normalizedMissions.length,
      blueprintRewardItemCount: rewardCount,
    },
    blueprintFiles,
    missionFiles,
  }),
  writeJson(path.join(outputRoot, "release-state.json"), {
    schemaVersion: 1,
    generatedAt,
    sourceLatestModifiedAt,
    states: releaseStates,
  }),
  writeJson(path.join(missionsRoot, "catalog.json"), {
    schemaVersion: 1,
    generatedAt,
    sourceLatestModifiedAt,
    summary: {
      missionCount: normalizedMissions.length,
      rewardCount,
    },
    missions: normalizedMissions,
  }),
]);

console.log(`Shaped blueprint source data into ${outputRoot}`);
console.log(`blueprint sources: ${Object.keys(blueprintFiles).length}`);
console.log(`normalized missions: ${normalizedMissions.length}`);
console.log(`release states: ${Object.keys(releaseStates).length}`);