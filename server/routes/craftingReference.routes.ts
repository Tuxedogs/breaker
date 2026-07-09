import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { getCraftingReferenceRoot } from "../config/craftingReferenceRoot.js";

type RouteResult = { status: number; body: unknown };

const referenceRoot = getCraftingReferenceRoot();

const REFERENCE_FILES = {
  "/api/crafting/reference/crafted-properties": "crafted-properties.json",
  "/api/crafting/reference/quality-quantization": "quality-quantization.json",
  "/api/crafting/reference/material-quality-quantization": "material-quality-quantization.json",
  "/api/crafting/reference/material-identity": "material-identity-index.json",
} as const;

const cache = new Map<string, { modifiedAt: number; promise: Promise<unknown> }>();

function methodNotAllowed(): RouteResult {
  return { status: 405, body: { error: "Method not allowed" } };
}

async function readReferenceFile(relativePath: string): Promise<unknown> {
  const filePath = path.resolve(referenceRoot, relativePath);
  const relativeToRoot = path.relative(referenceRoot, filePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("Invalid crafting reference data path.");
  }
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

async function loadReference(relativePath: string): Promise<unknown> {
  const filePath = path.join(referenceRoot, relativePath);
  const modifiedAt = (await stat(filePath)).mtimeMs;
  const cached = cache.get(relativePath);
  if (!cached || cached.modifiedAt !== modifiedAt) {
    const promise = readReferenceFile(relativePath);
    cache.set(relativePath, { modifiedAt, promise });
    return promise;
  }
  return cached.promise;
}

export async function handleCraftingReferenceRoute(
  method: string,
  rawUrl: string,
): Promise<RouteResult | null> {
  const pathName = new URL(rawUrl, "http://localhost").pathname;
  const relativePath = REFERENCE_FILES[pathName as keyof typeof REFERENCE_FILES];
  if (!relativePath) return null;
  if (method !== "GET") return methodNotAllowed();
  return { status: 200, body: await loadReference(relativePath) };
}
