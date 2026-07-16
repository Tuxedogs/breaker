import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const publicApiRoot = path.resolve("public", "api");
const missionSourceRoot = path.resolve("server-data", "missions", "source");
const craftingBlueprintSourcesRoot = path.resolve("server-data", "crafting", "blueprint-sources");
const forbiddenPublicMissionFiles = new Set([
  "mission_contracts.json",
  "mission_extraction_report.json",
  "mission_blueprint_rewards.json",
  "blueprint_reward_sources.json",
  "mission_reward_lookups.json",
]);
const forbiddenFilePatterns = [
  /\.bak_/,
  /_audit\.json$/i,
  /fixture.*\.json$/i,
  /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|py|ps1|sh)$/i,
];
const forbiddenDirectoryNames = new Set(["server", "scripts"]);
const maxPublicMissionJsonBytes = 1 * 1024 * 1024;
const serverMissionRoot = path.resolve("server-data", "missions");
const maxServerMissionOutputJsonBytes = 50 * 1024 * 1024;
const legacyMissionOutputFiles = new Set([
  "mission_locations.json",
  "mission_variants.json",
]);

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (forbiddenDirectoryNames.has(entry.name)) {
        files.push(fullPath);
        continue;
      }
      files.push(...await walk(fullPath));
    } else if (entry.isFile() && forbiddenFilePatterns.some((pattern) => pattern.test(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

async function validatePublicMissionHygiene(): Promise<void> {
  const missionsDir = path.join(publicApiRoot, "missions");
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(missionsDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const fullPath = path.join(missionsDir, entry.name);
    const fileStat = await stat(fullPath);
    if (forbiddenPublicMissionFiles.has(entry.name) || fileStat.size > maxPublicMissionJsonBytes) {
      console.error("public/api/missions must not contain runtime or build-input mission JSON:");
      console.error(`- ${path.relative(process.cwd(), fullPath)} (${fileStat.size} bytes)`);
      process.exit(1);
    }
  }
}

async function walkServerMissionOutputs(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === "source") continue;

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkServerMissionOutputs(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files;
}

async function validateServerMissionOutputs(): Promise<void> {
  const files = await walkServerMissionOutputs(serverMissionRoot);
  const oversized: Array<{ filePath: string; size: number }> = [];
  const legacy: string[] = [];

  for (const filePath of files) {
    const fileName = path.basename(filePath);
    const fileStat = await stat(filePath);

    if (legacyMissionOutputFiles.has(fileName)) {
      legacy.push(filePath);
    }
    if (fileStat.size > maxServerMissionOutputJsonBytes) {
      oversized.push({ filePath, size: fileStat.size });
    }
  }

  if (legacy.length > 0) {
    console.error("Legacy mission monoliths must not be committed:");
    for (const filePath of legacy) {
      console.error(`- ${path.relative(process.cwd(), filePath)}`);
    }
    process.exit(1);
  }

  if (oversized.length > 0) {
    console.error("server-data/missions shaped outputs exceed the 50 MB limit:");
    for (const { filePath, size } of oversized) {
      console.error(`- ${path.relative(process.cwd(), filePath)} (${size} bytes)`);
    }
    process.exit(1);
  }
}

const offenders = await walk(publicApiRoot);

if (offenders.length > 0) {
  console.error("public/api contains non-contract artifacts:");
  for (const offender of offenders) {
    console.error(`- ${path.relative(process.cwd(), offender)}`);
  }
  process.exit(1);
}

await validatePublicMissionHygiene();
await validateServerMissionOutputs();

const missionCatalogPath = path.join(missionSourceRoot, "mission_contracts.json");
const missionReportPath = path.join(missionSourceRoot, "mission_extraction_report.json");
const missionCatalog = JSON.parse(await readFile(missionCatalogPath, "utf8")) as {
  sourceLatestModifiedAt?: string;
  records?: Array<{ contractId?: string; familyId?: string; blueprintRewards?: unknown[] }>;
};
const missionReport = JSON.parse(await readFile(missionReportPath, "utf8")) as {
  missionContractCount?: number;
  missionFamilyCount?: number;
  missionCountWithBlueprintRewards?: number;
  missionCountWithoutBlueprintRewards?: number;
};
const records = missionCatalog.records ?? [];
const uniqueContractIds = new Set(records.map((record) => record.contractId));
const uniqueFamilyIds = new Set(records.map((record) => record.familyId));
const blueprintMissionCount = records.filter((record) => (record.blueprintRewards?.length ?? 0) > 0).length;
const sourceUpdatedAt = missionCatalog.sourceLatestModifiedAt ? new Date(missionCatalog.sourceLatestModifiedAt) : null;
const minimumSourceDate = new Date("2026-06-04T00:00:00Z");

if (
  uniqueContractIds.size !== records.length ||
  uniqueFamilyIds.has(undefined) ||
  blueprintMissionCount < 0 ||
  !sourceUpdatedAt ||
  Number.isNaN(sourceUpdatedAt.getTime()) ||
  sourceUpdatedAt < minimumSourceDate ||
  missionReport.missionContractCount !== records.length ||
  missionReport.missionFamilyCount !== uniqueFamilyIds.size ||
  missionReport.missionCountWithBlueprintRewards !== blueprintMissionCount ||
  missionReport.missionCountWithoutBlueprintRewards !== records.length - blueprintMissionCount
) {
  console.error("Mission source publication validation failed.");
  process.exit(1);
}

const serverMissionIndexPath = path.join("server-data", "missions", "mission_browser_index.json");
try {
  const serverIndex = JSON.parse(await readFile(serverMissionIndexPath, "utf8")) as {
    summary?: { familyCount?: number; variantCount?: number };
    sourceLatestModifiedAt?: string;
  };
  if (
    serverIndex.summary?.familyCount !== uniqueFamilyIds.size ||
    serverIndex.summary?.variantCount !== records.length ||
    !serverIndex.sourceLatestModifiedAt
  ) {
    console.error("server-data/missions browser index validation failed.");
    process.exit(1);
  }
} catch (error) {
  console.error("server-data/missions browser index is missing or unreadable.");
  console.error(error);
  process.exit(1);
}

const craftingIndex = JSON.parse(
  await readFile(path.join(craftingBlueprintSourcesRoot, "index.json"), "utf8"),
) as {
  summary?: { blueprintSourceCount?: number; missionRewardCount?: number };
};
if (
  typeof craftingIndex.summary?.blueprintSourceCount !== "number" ||
  typeof craftingIndex.summary?.missionRewardCount !== "number" ||
  craftingIndex.summary.blueprintSourceCount < 0 ||
  craftingIndex.summary.missionRewardCount !== blueprintMissionCount
) {
  console.error("server-data/crafting/blueprint-sources index validation failed.");
  process.exit(1);
}

console.log("public/api contract hygiene check passed.");
console.log("public/api/missions runtime JSON guard passed.");
console.log("server-data/missions output size guard passed.");
console.log("server-data/missions source check passed.");
console.log("server-data/missions browser index check passed.");
console.log("server-data/crafting/blueprint-sources index check passed.");
