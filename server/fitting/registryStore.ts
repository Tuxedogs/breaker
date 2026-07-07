import { open, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { DatasetSelection, RegistryEnvelope } from "./fitting.types.js";
import { FittingHttpError } from "./fitting.types.js";

const registryCache = new Map<string, Promise<RegistryEnvelope<Record<string, unknown>>>>();
const SHARDED_REGISTRIES = new Set<string>(["compatibility_rules.json"]);

export const PUBLIC_REGISTRIES = [
  "ships.json",
  "ship_hardpoints.json",
  "default_loadouts.json",
  "ship_performance.json",
  "components.json",
  "component_identity_index.json",
  "ship_weapons.json",
  "mining_lasers.json",
  "salvage_heads.json",
  "salvage_modifiers.json",
  "fuel_nozzles.json",
  "vehicle_ammo.json",
  "shields.json",
  "ship_armors.json",
  "power_plants.json",
  "coolers.json",
  "quantum_drives.json",
  "radars.json",
  "thrusters.json",
  "compatible_items_by_port.json",
  "compatibility_rules.json",
  "stock_loadout_calculations.json",
] as const;

function registryPath(selection: DatasetSelection, fileName: string): string {
  if (!PUBLIC_REGISTRIES.includes(fileName as (typeof PUBLIC_REGISTRIES)[number])) {
    throw new FittingHttpError(500, "INTERNAL_ERROR", "Internal error", "Unknown fitting registry requested.");
  }
  return path.join(selection.fittingRoot, fileName);
}

async function registryShardPaths(selection: DatasetSelection, fileName: string): Promise<string[]> {
  if (!SHARDED_REGISTRIES.has(fileName)) return [];
  const directory = selection.fittingRoot;
  const prefix = fileName.replace(/\.json$/, ".part-");
  try {
    const entries = await readdir(directory);
    return entries
      .filter((entry) => entry.startsWith(prefix) && entry.endsWith(".json"))
      .sort((a, b) => a.localeCompare(b))
      .map((entry) => path.join(directory, entry));
  } catch {
    return [];
  }
}

function validateRegistryEnvelope(
  payload: RegistryEnvelope<Record<string, unknown>>,
  fileName: string,
): RegistryEnvelope<Record<string, unknown>> {
  if (!Array.isArray(payload.records) || typeof payload.schemaVersion !== "number") {
    throw new FittingHttpError(409, "DATASET_SCHEMA_UNSUPPORTED", "Dataset schema unsupported", "A fitting registry has an unsupported envelope.");
  }
  if (payload.schemaVersion !== 1) {
    throw new FittingHttpError(409, "DATASET_SCHEMA_UNSUPPORTED", "Dataset schema unsupported", `Artifact schema ${payload.schemaVersion} is not supported by fitting API v1.`);
  }
  if (payload.registry && payload.registry !== fileName.replace(/\.json$/, "")) {
    throw new FittingHttpError(409, "DATASET_SCHEMA_UNSUPPORTED", "Dataset schema unsupported", "A fitting registry shard has an unexpected registry name.");
  }
  return payload;
}

async function readRegistryEnvelope(filePath: string, fileName: string): Promise<RegistryEnvelope<Record<string, unknown>>> {
  const raw = await readFile(filePath, "utf8");
  return validateRegistryEnvelope(JSON.parse(raw) as RegistryEnvelope<Record<string, unknown>>, fileName);
}

async function loadRegistryEnvelope(
  selection: DatasetSelection,
  fileName: (typeof PUBLIC_REGISTRIES)[number],
): Promise<RegistryEnvelope<Record<string, unknown>>> {
  const shardPaths = await registryShardPaths(selection, fileName);
  if (shardPaths.length > 0) {
    const shards = await Promise.all(shardPaths.map((shardPath) => readRegistryEnvelope(shardPath, fileName)));
    const records = shards.flatMap((payload) => payload.records);
    return {
      ...shards[0],
      recordCount: records.length,
      records,
    };
  }
  return readRegistryEnvelope(registryPath(selection, fileName), fileName);
}

export async function loadRegistry(
  selection: DatasetSelection,
  fileName: (typeof PUBLIC_REGISTRIES)[number],
): Promise<RegistryEnvelope<Record<string, unknown>>> {
  const filePath = registryPath(selection, fileName);
  let cached = registryCache.get(filePath);
  if (!cached) {
    cached = loadRegistryEnvelope(selection, fileName)
      .catch((error: unknown) => {
        registryCache.delete(filePath);
        if (error instanceof FittingHttpError) throw error;
        throw new FittingHttpError(503, "DATASET_UNAVAILABLE", "Dataset unavailable", `Required fitting registry ${fileName} is missing or unreadable.`);
      });
    registryCache.set(filePath, cached);
  }
  return cached;
}

async function readRegistryHeaderFromFile(
  filePath: string,
  fileName: (typeof PUBLIC_REGISTRIES)[number],
): Promise<{ name: string; recordCount: number; schemaVersion: number; generatedAt: string | null }> {
  const file = await open(filePath, "r");
  try {
    const info = await stat(filePath);
    const sampleSize = Math.min(info.size, 131_072);
    const prefixBuffer = Buffer.alloc(sampleSize);
    const suffixBuffer = Buffer.alloc(sampleSize);
    await file.read(prefixBuffer, 0, prefixBuffer.length, 0);
    await file.read(suffixBuffer, 0, suffixBuffer.length, Math.max(0, info.size - sampleSize));
    const sampled = `${prefixBuffer.toString("utf8")}\n${suffixBuffer.toString("utf8")}`;
    const count = /"recordCount"\s*:\s*(\d+)/.exec(sampled);
    const schema = /"schemaVersion"\s*:\s*(\d+)/.exec(sampled);
    const generated = /"generatedAt"\s*:\s*"([^"]+)"/.exec(sampled);
    if (!count || !schema) throw new Error("registry metadata absent");
    return {
      name: fileName.replace(/\.json$/, ""),
      recordCount: Number(count[1]),
      schemaVersion: Number(schema[1]),
      generatedAt: generated?.[1] ?? null,
    };
  } finally {
    await file.close();
  }
}

export async function readRegistryHeader(
  selection: DatasetSelection,
  fileName: (typeof PUBLIC_REGISTRIES)[number],
): Promise<{ name: string; recordCount: number; schemaVersion: number; generatedAt: string | null }> {
  try {
    const shardPaths = await registryShardPaths(selection, fileName);
    if (shardPaths.length > 0) {
      const headers = await Promise.all(shardPaths.map((shardPath) => readRegistryHeaderFromFile(shardPath, fileName)));
      const schemaVersion = headers[0]?.schemaVersion;
      if (!headers.every((header) => header.schemaVersion === schemaVersion)) {
        throw new Error("registry shard schema mismatch");
      }
      return {
        name: fileName.replace(/\.json$/, ""),
        recordCount: headers.reduce((sum, header) => sum + header.recordCount, 0),
        schemaVersion: schemaVersion ?? 1,
        generatedAt: headers[0]?.generatedAt ?? null,
      };
    }
    return readRegistryHeaderFromFile(registryPath(selection, fileName), fileName);
  } catch {
    throw new FittingHttpError(503, "DATASET_UNAVAILABLE", "Dataset unavailable", `Required fitting registry ${fileName} is missing or unreadable.`);
  }
}

export function clearRegistryCache(): void {
  registryCache.clear();
}
