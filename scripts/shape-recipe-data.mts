import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getCraftingRecipesRoot } from "../server/config/craftingRecipesRoot.ts";
import {
  classifyRecipeInput,
  getRecipeInputDisplayName,
} from "../src/lib/crafting/recipeInputClassification.ts";
import { getScintelCraftingSourcePath } from "./lib/scintelDatasetSource.mts";

type JsonRecord = Record<string, unknown>;

const vehicleSourcePath = getScintelCraftingSourcePath("blueprints.json");
const fpsSourcePath = getScintelCraftingSourcePath("fps", "fps_blueprints.json");
const outputRoot = getCraftingRecipesRoot();
const byBlueprintRoot = path.join(outputRoot, "by-blueprint");

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

function shapeRecipeInput(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;

  const input = value as JsonRecord;
  const inputKind = classifyRecipeInput(input);
  const displayName = getRecipeInputDisplayName(input);

  return {
    ...input,
    inputKind,
    ...(inputKind === "part" && displayName ? { materialName: displayName } : {}),
  };
}

function shapeRecipeRecord(record: JsonRecord): JsonRecord {
  const shaped = { ...record };
  for (const key of ["materials", "materialRequirements"]) {
    const inputs = shaped[key];
    if (Array.isArray(inputs)) shaped[key] = inputs.map(shapeRecipeInput);
  }
  return shaped;
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

  const recordFiles: Record<string, string> = {};
  const vehicleBlueprintGuids: string[] = [];
  const fpsBlueprintGuids: string[] = [];
  let missingIdCount = 0;
  let duplicateIdCount = 0;

  async function shapeRecords(records: JsonRecord[], kind: "vehicle" | "fps") {
    for (const record of records) {
      const shapedRecord = shapeRecipeRecord(record);
      const guid = recordGuid(shapedRecord, kind);
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
      (kind === "vehicle" ? vehicleBlueprintGuids : fpsBlueprintGuids).push(guid);
      await writeFile(
        path.join(outputRoot, relativePath),
        `${JSON.stringify({ schemaVersion: 1, kind, record: shapedRecord }, null, 2)}\n`,
        "utf8",
      );
    }
  }

  await shapeRecords(vehicleRecords, "vehicle");
  await shapeRecords(fpsRecords, "fps");

  const index = {
    schemaVersion: 1 as const,
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: new Date().toISOString(),
    vehicleCount: vehicleBlueprintGuids.length,
    fpsCount: fpsBlueprintGuids.length,
    shapedRecordCount: Object.keys(recordFiles).length,
    missingIdCount,
    duplicateIdCount,
    vehicleBlueprintGuids,
    fpsBlueprintGuids,
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
