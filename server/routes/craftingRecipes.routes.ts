import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { getCraftingRecipesRoot } from "../config/craftingRecipesRoot.js";

type RouteResult = { status: number; body: unknown };

type RecipesIndex = {
  schemaVersion: 1;
  generatedAt?: string;
  sourceGeneratedAt?: string;
  vehicleCount?: number;
  fpsCount?: number;
  recordFiles: Record<string, string>;
};

const recipesRoot = getCraftingRecipesRoot();
const MAX_BATCH_GUIDS = 100;

let indexCache: Promise<RecipesIndex> | null = null;
let indexModifiedAt = 0;
let vehicleCatalogCache: Promise<unknown> | null = null;
let vehicleCatalogModifiedAt = 0;
let fpsCatalogCache: Promise<unknown> | null = null;
let fpsCatalogModifiedAt = 0;

function parseRouteUrl(rawUrl: string): URL {
  return new URL(rawUrl, "http://localhost");
}

function normalizeGuid(value: string): string {
  return value.trim().toLowerCase();
}

function isGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function readJson<T>(relativePath: string): Promise<T> {
  const filePath = path.resolve(recipesRoot, relativePath);
  const relativeToRoot = path.relative(recipesRoot, filePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("Invalid crafting recipe data path.");
  }
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function loadIndex(): Promise<RecipesIndex> {
  const indexPath = path.join(recipesRoot, "index.json");
  const modifiedAt = (await stat(indexPath)).mtimeMs;
  if (!indexCache || modifiedAt !== indexModifiedAt) {
    indexModifiedAt = modifiedAt;
    indexCache = readJson<RecipesIndex>("index.json");
  }
  return indexCache;
}

async function loadVehicleCatalog(): Promise<unknown> {
  const catalogPath = path.join(recipesRoot, "catalog", "vehicle.json");
  const modifiedAt = (await stat(catalogPath)).mtimeMs;
  if (!vehicleCatalogCache || modifiedAt !== vehicleCatalogModifiedAt) {
    vehicleCatalogModifiedAt = modifiedAt;
    vehicleCatalogCache = readJson("catalog/vehicle.json");
  }
  return vehicleCatalogCache;
}

async function loadFpsCatalog(): Promise<unknown> {
  const catalogPath = path.join(recipesRoot, "catalog", "fps.json");
  const modifiedAt = (await stat(catalogPath)).mtimeMs;
  if (!fpsCatalogCache || modifiedAt !== fpsCatalogModifiedAt) {
    fpsCatalogModifiedAt = modifiedAt;
    fpsCatalogCache = readJson("catalog/fps.json");
  }
  return fpsCatalogCache;
}

function methodNotAllowed(): RouteResult {
  return { status: 405, body: { error: "Method not allowed" } };
}

export async function handleCraftingRecipesRoute(
  method: string,
  rawUrl: string,
  body: unknown,
): Promise<RouteResult | null> {
  const url = parseRouteUrl(rawUrl);
  const pathName = url.pathname;

  if (pathName === "/api/crafting/recipes/index") {
    if (method !== "GET") return methodNotAllowed();
    const index = await loadIndex();
    return {
      status: 200,
      body: {
        schemaVersion: 1,
        generatedAt: index.generatedAt,
        sourceGeneratedAt: index.sourceGeneratedAt,
        vehicleCount: index.vehicleCount ?? 0,
        fpsCount: index.fpsCount ?? 0,
        blueprintGuids: Object.keys(index.recordFiles),
      },
    };
  }

  if (pathName === "/api/crafting/recipes/catalog/vehicle") {
    if (method !== "GET") return methodNotAllowed();
    return { status: 200, body: await loadVehicleCatalog() };
  }

  if (pathName === "/api/crafting/recipes/catalog/fps") {
    if (method !== "GET") return methodNotAllowed();
    return { status: 200, body: await loadFpsCatalog() };
  }

  if (pathName === "/api/crafting/recipes/batch") {
    if (method !== "POST") return methodNotAllowed();
    const payload = body && typeof body === "object" ? body as { blueprintGuids?: unknown } : {};
    const rawGuids = Array.isArray(payload.blueprintGuids) ? payload.blueprintGuids : [];
    const blueprintGuids = rawGuids
      .filter((value): value is string => typeof value === "string")
      .map(normalizeGuid)
      .filter((value) => isGuid(value));
    if (blueprintGuids.length === 0) {
      return { status: 400, body: { error: "blueprintGuids must be a non-empty array." } };
    }
    if (blueprintGuids.length > MAX_BATCH_GUIDS) {
      return { status: 400, body: { error: `Maximum ${MAX_BATCH_GUIDS} blueprintGuids per batch.` } };
    }

    const index = await loadIndex();
    const records: unknown[] = [];
    const missing: string[] = [];
    for (const guid of blueprintGuids) {
      const file = index.recordFiles[guid];
      if (!file) {
        missing.push(guid);
        continue;
      }
      records.push(await readJson(file));
    }
    return { status: 200, body: { records, missing } };
  }

  const recordMatch = pathName.match(/^\/api\/crafting\/recipes\/([^/]+)$/);
  if (recordMatch) {
    if (method !== "GET") return methodNotAllowed();
    const blueprintGuid = normalizeGuid(decodeURIComponent(recordMatch[1] ?? ""));
    if (!blueprintGuid || !isGuid(blueprintGuid)) {
      return { status: 400, body: { error: "Invalid blueprint id." } };
    }
    const index = await loadIndex();
    const file = index.recordFiles[blueprintGuid];
    if (!file) return { status: 404, body: { error: "Recipe not found." } };
    return { status: 200, body: await readJson(file) };
  }

  return null;
}
