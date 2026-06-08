import { apiUrl } from "@/lib/apiUrl";
import { parseJsonResponse } from "@/lib/safeJson";

export type MissionClassification = {
  tutorial?: boolean;
  event?: boolean;
};

export type MissionStanding = {
  displayName?: string;
  minReputation?: number;
};

export type MissionPrerequisite = {
  type?: string;
  attributes?: Record<string, unknown>;
  resolved?: Record<string, unknown>;
  references?: string[];
};

export type MissionReward = {
  type?: string;
  chance?: number;
  blueprintPoolGuid?: string;
  missionResults?: boolean[];
  difficulty?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  references?: string[];
  reputationAmount?: number;
  reward?: Record<string, unknown>;
};

export type MissionContract = {
  contractId: string;
  familyId: string;
  contractType?: string;
  debugName?: string;
  title?: string;
  description?: string;
  generatorGuid?: string;
  generatorName?: string;
  generatorPath?: string;
  handlerType?: string;
  handlerDebugName?: string;
  notForRelease?: string | boolean;
  workInProgress?: string | boolean;
  missionType?: string;
  factionName?: string;
  minStanding?: MissionStanding;
  maxStanding?: MissionStanding;
  prerequisites?: MissionPrerequisite[];
  blueprintRewards?: MissionReward[];
  reputationRewards?: MissionReward[];
  creditRewardTypes?: MissionReward[];
  itemRewards?: MissionReward[];
  completionTags?: MissionReward[];
  classifications?: MissionClassification;
};

export type MissionCatalog = {
  schemaVersion: number;
  generatedAt: string;
  sourceLatestModifiedAt: string;
  records: MissionContract[];
};

export type BlueprintPoolLookup = {
  poolGuid?: string;
  displayName?: string;
  poolName?: string;
  rewards?: Array<{
    blueprintGuid?: string;
    displayName?: string;
    componentType?: string;
    poolChance?: number;
  }>;
};

export type MissionLookups = {
  blueprintPools?: BlueprintPoolLookup[];
};

let missionDataPromise: Promise<{ catalog: MissionCatalog; lookups: MissionLookups }> | null = null;

export function loadMissionData(): Promise<{ catalog: MissionCatalog; lookups: MissionLookups }> {
  missionDataPromise ??= Promise.all([
    fetch(apiUrl("/api/missions/mission_contracts.json")).then(async (response) => {
      const data = await parseJsonResponse<MissionCatalog>(response, {
        label: "mission contract catalog",
        url: response.url,
      });
      if (!response.ok) throw new Error(`Mission contract catalog unavailable: ${response.status}`);
      return data;
    }),
    fetch(apiUrl("/api/missions/mission_reward_lookups.json")).then(async (response) => {
      const data = await parseJsonResponse<MissionLookups>(response, {
        label: "mission reward lookups",
        url: response.url,
      });
      if (!response.ok) throw new Error(`Mission reward lookups unavailable: ${response.status}`);
      return data;
    }),
  ]).then(([catalog, lookups]) => ({ catalog, lookups }));
  return missionDataPromise;
}
