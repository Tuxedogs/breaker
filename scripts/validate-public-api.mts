import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const publicApiRoot = path.resolve("public", "api");
const forbiddenFilePatterns = [
  /\.bak_/,
  /_audit\.json$/i,
  /fixture.*\.json$/i,
  /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|py|ps1|sh)$/i,
];
const forbiddenDirectoryNames = new Set(["server", "scripts"]);

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

const offenders = await walk(publicApiRoot);

if (offenders.length > 0) {
  console.error("public/api contains non-contract artifacts:");
  for (const offender of offenders) {
    console.error(`- ${path.relative(process.cwd(), offender)}`);
  }
  process.exit(1);
}

const missionCatalogPath = path.join(publicApiRoot, "missions", "mission_contracts.json");
const missionReportPath = path.join(publicApiRoot, "missions", "mission_extraction_report.json");
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
  records.length !== 2460 ||
  uniqueContractIds.size !== 2460 ||
  uniqueFamilyIds.size !== 247 ||
  blueprintMissionCount !== 685 ||
  !sourceUpdatedAt ||
  Number.isNaN(sourceUpdatedAt.getTime()) ||
  sourceUpdatedAt < minimumSourceDate ||
  missionReport.missionContractCount !== 2460 ||
  missionReport.missionFamilyCount !== 247 ||
  missionReport.missionCountWithBlueprintRewards !== 685 ||
  missionReport.missionCountWithoutBlueprintRewards !== 1775
) {
  console.error("Mission API publication validation failed.");
  process.exit(1);
}

const serverMissionIndexPath = path.join("server-data", "missions", "mission_browser_index.json");
try {
  const serverIndex = JSON.parse(await readFile(serverMissionIndexPath, "utf8")) as {
    summary?: { familyCount?: number; variantCount?: number };
    sourceLatestModifiedAt?: string;
  };
  if (
    serverIndex.summary?.familyCount !== 247 ||
    serverIndex.summary?.variantCount !== 2460 ||
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

console.log("public/api contract hygiene check passed.");
console.log("server-data/missions browser index check passed.");
