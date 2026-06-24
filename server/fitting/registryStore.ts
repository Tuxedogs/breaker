import { open, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { DatasetSelection, RegistryEnvelope } from "./fitting.types.ts";
import { FittingHttpError } from "./fitting.types.ts";

const registryCache = new Map<string, Promise<RegistryEnvelope<Record<string, unknown>>>>();

export const PUBLIC_REGISTRIES = [
  "ships.json",
  "ship_hardpoints.json",
  "default_loadouts.json",
  "ship_performance.json",
  "components.json",
  "component_identity_index.json",
  "ship_weapons.json",
  "vehicle_ammo.json",
  "shields.json",
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

export async function loadRegistry(
  selection: DatasetSelection,
  fileName: (typeof PUBLIC_REGISTRIES)[number],
): Promise<RegistryEnvelope<Record<string, unknown>>> {
  const filePath = registryPath(selection, fileName);
  let cached = registryCache.get(filePath);
  if (!cached) {
    cached = readFile(filePath, "utf8")
      .then((raw) => JSON.parse(raw) as RegistryEnvelope<Record<string, unknown>>)
      .then((payload) => {
        if (!Array.isArray(payload.records) || typeof payload.schemaVersion !== "number") {
          throw new FittingHttpError(409, "DATASET_SCHEMA_UNSUPPORTED", "Dataset schema unsupported", "A fitting registry has an unsupported envelope.");
        }
        if (payload.schemaVersion !== 1) {
          throw new FittingHttpError(409, "DATASET_SCHEMA_UNSUPPORTED", "Dataset schema unsupported", `Artifact schema ${payload.schemaVersion} is not supported by fitting API v1.`);
        }
        return payload;
      })
      .catch((error: unknown) => {
        registryCache.delete(filePath);
        if (error instanceof FittingHttpError) throw error;
        throw new FittingHttpError(503, "DATASET_UNAVAILABLE", "Dataset unavailable", `Required fitting registry ${fileName} is missing or unreadable.`);
      });
    registryCache.set(filePath, cached);
  }
  return cached;
}

export async function readRegistryHeader(
  selection: DatasetSelection,
  fileName: (typeof PUBLIC_REGISTRIES)[number],
): Promise<{ name: string; recordCount: number; schemaVersion: number; generatedAt: string | null }> {
  const filePath = registryPath(selection, fileName);
  try {
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
  } catch {
    throw new FittingHttpError(503, "DATASET_UNAVAILABLE", "Dataset unavailable", `Required fitting registry ${fileName} is missing or unreadable.`);
  }
}

export function clearRegistryCache(): void {
  registryCache.clear();
}
