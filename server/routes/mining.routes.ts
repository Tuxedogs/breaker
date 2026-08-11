import { readFile } from "node:fs/promises";
import path from "node:path";

import { getMiningDataRoot } from "../config/miningDataRoot";
import { getRecommendations } from "../recommender";
import type { RecommendRequest } from "../recommender";

export type MiningRouteResult = {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
};

const INDEX_ROUTES = new Map<string, string>([
  ["/api/mining/location-materials", "indexes/location-material.json"],
  ["/api/mining/encounter-rankings", "indexes/material-encounter-rankings.json"],
  ["/api/mining/material-quality", "indexes/material-quality.json"],
  ["/api/mining/location-distribution", "indexes/location-distribution.json"],
  ["/api/mining/location-hierarchy", "indexes/location-hierarchy.json"],
  ["/api/mining/lagrange-groups", "locations/lagrange-groups.json"],
  ["/api/mining/lagrange-children", "locations/lagrange-children.json"],
]);

function pathnameFromUrl(rawUrl: string): string {
  return new URL(rawUrl, "http://localhost").pathname.replace(/\/$/, "");
}

async function readMiningJson(dataRoot: string, relativePath: string): Promise<unknown> {
  const filePath = path.resolve(dataRoot, relativePath);
  const relativeToRoot = path.relative(dataRoot, filePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("Invalid mining data path.");
  }
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

export async function handleMiningRoute(
  method: string,
  rawUrl: string,
  body?: unknown,
  dataRoot = getMiningDataRoot(),
): Promise<MiningRouteResult | null> {
  const pathname = pathnameFromUrl(rawUrl);
  const indexFile = INDEX_ROUTES.get(pathname);
  if (indexFile) {
    if (method !== "GET" && method !== "HEAD") {
      return { status: 405, body: { error: "Method not allowed" }, headers: { allow: "GET, HEAD" } };
    }
    return {
      status: 200,
      body: await readMiningJson(dataRoot, indexFile),
      headers: { "cache-control": "public, max-age=300, stale-while-revalidate=3600" },
    };
  }

  if (pathname === "/api/mining/recommendations") {
    if (method !== "POST") {
      return { status: 405, body: { error: "Method not allowed" }, headers: { allow: "POST" } };
    }
    return { status: 200, body: await getRecommendations((body ?? {}) as RecommendRequest) };
  }

  return null;
}
