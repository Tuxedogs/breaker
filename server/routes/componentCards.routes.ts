import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { getComponentCardsRoot } from "../config/componentCardsRoot.js";

type RouteResult = { status: number; body: unknown };

type ComponentCardsIndex = {
  schemaVersion: 1;
  generatedAt?: string;
  sourceGeneratedAt?: string;
  sourceRecordCount?: {
    vehicle?: number;
    fps?: number;
    total?: number;
  };
  shapedRecordCount?: number;
  missingIdCount?: number;
  duplicateIdCount?: number;
  skippedCount?: number;
  warnings?: string[];
  recordFiles: Record<string, string>;
};

const cardsRoot = getComponentCardsRoot();

let indexCache: Promise<ComponentCardsIndex> | null = null;
let indexModifiedAt = 0;
let browseCache: Promise<unknown> | null = null;
let browseModifiedAt = 0;
let facetsCache: Promise<unknown> | null = null;
let facetsModifiedAt = 0;

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
  const filePath = path.resolve(cardsRoot, relativePath);
  const relativeToRoot = path.relative(cardsRoot, filePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("Invalid component card data path.");
  }
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function loadIndex(): Promise<ComponentCardsIndex> {
  const indexPath = path.join(cardsRoot, "index.json");
  const modifiedAt = (await stat(indexPath)).mtimeMs;
  if (!indexCache || modifiedAt !== indexModifiedAt) {
    indexModifiedAt = modifiedAt;
    indexCache = readJson<ComponentCardsIndex>("index.json");
  }
  return indexCache;
}

async function loadBrowse(): Promise<unknown> {
  const browsePath = path.join(cardsRoot, "browse.json");
  const modifiedAt = (await stat(browsePath)).mtimeMs;
  if (!browseCache || modifiedAt !== browseModifiedAt) {
    browseModifiedAt = modifiedAt;
    browseCache = readJson("browse.json");
  }
  return browseCache;
}

async function loadFacets(): Promise<unknown> {
  const facetsPath = path.join(cardsRoot, "facets.json");
  const modifiedAt = (await stat(facetsPath)).mtimeMs;
  if (!facetsCache || modifiedAt !== facetsModifiedAt) {
    facetsModifiedAt = modifiedAt;
    facetsCache = readJson("facets.json");
  }
  return facetsCache;
}

function methodNotAllowed(): RouteResult {
  return { status: 405, body: { error: "Method not allowed" } };
}

export async function handleComponentCardsRoute(
  method: string,
  rawUrl: string,
): Promise<RouteResult | null> {
  const url = parseRouteUrl(rawUrl);
  const pathName = url.pathname;

  if (pathName === "/api/crafting/component-cards/index") {
    if (method !== "GET") return methodNotAllowed();
    const index = await loadIndex();
    return {
      status: 200,
      body: {
        schemaVersion: 1,
        generatedAt: index.generatedAt,
        sourceGeneratedAt: index.sourceGeneratedAt,
        sourceRecordCount: index.sourceRecordCount ?? {},
        shapedRecordCount: index.shapedRecordCount ?? 0,
        missingIdCount: index.missingIdCount ?? 0,
        duplicateIdCount: index.duplicateIdCount ?? 0,
        skippedCount: index.skippedCount ?? 0,
        warnings: index.warnings ?? [],
        recordIds: Object.keys(index.recordFiles),
      },
    };
  }

  if (pathName === "/api/crafting/component-cards/facets") {
    if (method !== "GET") return methodNotAllowed();
    return { status: 200, body: await loadFacets() };
  }

  if (pathName === "/api/crafting/component-cards/browse") {
    if (method !== "GET") return methodNotAllowed();
    return { status: 200, body: await loadBrowse() };
  }

  const recordMatch = pathName.match(/^\/api\/crafting\/component-cards\/([^/]+)$/);
  if (recordMatch) {
    if (method !== "GET") return methodNotAllowed();
    const recordId = normalizeGuid(decodeURIComponent(recordMatch[1] ?? ""));
    if (!recordId || !isGuid(recordId)) {
      return { status: 400, body: { error: "Invalid component card id." } };
    }
    const index = await loadIndex();
    const file = index.recordFiles[recordId];
    if (!file) return { status: 404, body: { error: "Component card not found." } };
    return { status: 200, body: await readJson(file) };
  }

  return null;
}