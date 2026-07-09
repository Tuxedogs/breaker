import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getCraftingRecipesRoot } from "../server/config/craftingRecipesRoot.ts";

type JsonRecord = Record<string, unknown>;

const vehicleSourcePath = path.resolve("public", "api", "crafting", "blueprints.json");
const fpsSourcePath = path.resolve("public", "api", "crafting", "fps", "fps_blueprints.json");
const outputRoot = getCraftingRecipesRoot();
const byBlueprintRoot = path.join(outputRoot, "by-blueprint");
const catalogRoot = path.join(outputRoot, "catalog");

function isGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function normalizeGuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed && isGuid(trimmed) ? trimmed : null;
}

function recordGuid(record: JsonRecord, kind: "vehicle" | "fps"): string | null {
  if (kind === "fps") {
    return normalizeGuid(record.blueprintGuid) ?? normalizeGuid(record.id);
  }
  return normalizeGuid(record.blueprintGuid);
}

async function readJsonArray(filePath: string): Promise<JsonRecord[]> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected array in ${filePath}`);
  }
  return parsed.filter((entry): entry is JsonRecord => typeof entry === "object" && entry !== null);
}

async function main() {
  const [vehicleRecords, fpsRecords] = await Promise.all([
    readJsonArray(vehicleSourcePath),
    readJsonArray(fpsSourcePath),
  ]);

  await mkdir(byBlueprintRoot, { recursive: true });
  await mkdir(catalogRoot, { recursive: true });

  const recordFiles: Record<string, string> = {};
  let missingIdCount = 0;
  let duplicateIdCount = 0;

  async function shapeRecords(records: JsonRecord[], kind: "vehicle" | "fps") {
    for (const record of records) {
      const guid = recordGuid(record, kind);
      if (!guid) {
        missingIdCount += 1;
        continue;
      }
      if (recordFiles[guid]) {
        duplicateIdCount += 1;
        continue;
      }
      const relativePath = path.join("by-blueprint", `${guid}.json`).replace(/\\/g, "/");
      recordFiles[guid] = relativePath;
      await writeFile(
        path.join(outputRoot, relativePath),
        `${JSON.stringify({ schemaVersion: 1, kind, record }, null, 2)}\n`,
        "utf8",
      );
    }
  }

  await shapeRecords(vehicleRecords, "vehicle");
  await shapeRecords(fpsRecords, "fps");

  await writeFile(
    path.join(catalogRoot, "vehicle.json"),
    `${JSON.stringify(vehicleRecords, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(catalogRoot, "fps.json"),
    `${JSON.stringify(fpsRecords, null, 2)}\n`,
    "utf8",
  );

  const index = {
    schemaVersion: 1 as const,
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: new Date().toISOString(),
    vehicleCount: vehicleRecords.length,
    fpsCount: fpsRecords.length,
    shapedRecordCount: Object.keys(recordFiles).length,
    missingIdCount,
    duplicateIdCount,
    recordFiles,
  };

  await writeFile(path.join(outputRoot, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    vehicleCount: vehicleRecords.length,
    fpsCount: fpsRecords.length,
    shapedRecordCount: Object.keys(recordFiles).length,
    missingIdCount,
    duplicateIdCount,
    outputRoot,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
