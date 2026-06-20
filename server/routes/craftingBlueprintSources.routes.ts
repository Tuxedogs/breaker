import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { getCraftingBlueprintSourcesRoot } from "../config/craftingBlueprintSourcesRoot.js";

type RouteResult = { status: number; body: unknown };

type BlueprintSourcesIndex = {
  schemaVersion: 1;
  generatedAt?: string;
  sourceLatestModifiedAt?: string;
  summary?: Record<string, number>;
  blueprintFiles: Record<string, string>;
  missionFiles: Record<string, string>;
};

const sourcesRoot = getCraftingBlueprintSourcesRoot();
const MAX_BATCH_GUIDS = 100;

let indexCache: Promise<BlueprintSourcesIndex> | null = null;
let indexModifiedAt = 0;

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
  const filePath = path.resolve(sourcesRoot, relativePath);
  const relativeToRoot = path.relative(sourcesRoot, filePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("Invalid blueprint source data path.");
  }
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function loadIndex(): Promise<BlueprintSourcesIndex> {
  const indexPath = path.join(sourcesRoot, "index.json");
  const modifiedAt = (await stat(indexPath)).mtimeMs;
  if (!indexCache || modifiedAt !== indexModifiedAt) {
    indexModifiedAt = modifiedAt;
    indexCache = readJson<BlueprintSourcesIndex>("index.json");
  }
  return indexCache;
}

function methodNotAllowed(): RouteResult {
  return { status: 405, body: { error: "Method not allowed" } };
}

function invalidGuid(): RouteResult {
  return { status: 400, body: { error: "Invalid blueprintGuid." } };
}

export async function handleCraftingBlueprintSourcesRoute(
  method: string,
  rawUrl: string,
  body: unknown,
): Promise<RouteResult | null> {
  const url = parseRouteUrl(rawUrl);
  const pathName = url.pathname;

  if (pathName === "/api/crafting/blueprint-sources/index") {
    if (method !== "GET") return methodNotAllowed();
    const index = await loadIndex();
    return {
      status: 200,
      body: {
        schemaVersion: 1,
        generatedAt: index.generatedAt,
        sourceLatestModifiedAt: index.sourceLatestModifiedAt,
        summary: index.summary ?? {},
        blueprintGuids: Object.keys(index.blueprintFiles),
      },
    };
  }

  if (pathName === "/api/crafting/blueprint-sources") {
    if (method !== "GET") return methodNotAllowed();
    const blueprintGuid = normalizeGuid(url.searchParams.get("blueprintGuid") ?? "");
    if (!blueprintGuid || !isGuid(blueprintGuid)) return invalidGuid();
    const index = await loadIndex();
    const file = index.blueprintFiles[blueprintGuid];
    if (!file) return { status: 404, body: { error: "Blueprint sources not found." } };
    return { status: 200, body: await readJson(file) };
  }

  if (pathName === "/api/crafting/blueprint-sources/batch") {
    if (method !== "POST") return methodNotAllowed();
    const payload = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    const blueprintGuids = Array.isArray(payload.blueprintGuids)
      ? payload.blueprintGuids.filter((value): value is string => typeof value === "string")
      : [];
    if (blueprintGuids.length === 0) {
      return { status: 400, body: { error: "blueprintGuids must be a non-empty array." } };
    }
    if (blueprintGuids.length > MAX_BATCH_GUIDS) {
      return { status: 400, body: { error: `blueprintGuids exceeds limit of ${MAX_BATCH_GUIDS}.` } };
    }

    const index = await loadIndex();
    const byBlueprintGuid: Record<string, unknown> = {};
    for (const rawGuid of blueprintGuids) {
      const blueprintGuid = normalizeGuid(rawGuid);
      if (!isGuid(blueprintGuid)) continue;
      const file = index.blueprintFiles[blueprintGuid];
      if (!file) continue;
      byBlueprintGuid[blueprintGuid] = await readJson(file);
    }
    return {
      status: 200,
      body: {
        schemaVersion: 1,
        byBlueprintGuid,
      },
    };
  }

  if (pathName === "/api/crafting/blueprint-rewards/release-state") {
    if (method !== "GET") return methodNotAllowed();
    return { status: 200, body: await readJson("release-state.json") };
  }

  if (pathName === "/api/crafting/blueprint-rewards/missions") {
    if (method !== "GET") return methodNotAllowed();
    return { status: 200, body: await readJson("missions/catalog.json") };
  }

  const missionMatch = pathName.match(/^\/api\/crafting\/blueprint-rewards\/missions\/([^/]+)$/);
  if (missionMatch) {
    if (method !== "GET") return methodNotAllowed();
    const contractId = normalizeGuid(decodeURIComponent(missionMatch[1] ?? ""));
    if (!contractId || !isGuid(contractId)) {
      return { status: 400, body: { error: "Invalid contractId." } };
    }
    const index = await loadIndex();
    const file = index.missionFiles[contractId];
    if (!file) return { status: 404, body: { error: "Mission reward not found." } };
    const payload = await readJson<{ mission?: unknown }>(file);
    return { status: 200, body: payload.mission ?? payload };
  }

  return null;
}