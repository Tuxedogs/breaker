import { createHash, randomUUID } from "node:crypto";
import { getFittingDataRoot, resolveDataset } from "../fitting/datasetResolver.js";
import { calculateFittingLoadout, validateFittingLoadout } from "../fitting/fittingEngine.js";
import {
  fittingApiMeta,
  getAmmo,
  getCalculations,
  getComponent,
  getHardpoints,
  getLoadout,
  getMeta,
  getShip,
  listCompatibleComponents,
  listComponents,
  listShips,
} from "../fitting/fitting.service.js";
import type { DatasetSelection, ProblemBody, RouteResult } from "../fitting/fitting.types.js";
import { FittingHttpError } from "../fitting/fitting.types.js";

const BASE_PATH = "/api/v1/fitting";
const READ_PATHS = [
  new RegExp(`^${BASE_PATH}/meta$`),
  new RegExp(`^${BASE_PATH}/ships$`),
  new RegExp(`^${BASE_PATH}/ships/[^/]+$`),
  new RegExp(`^${BASE_PATH}/ships/[^/]+/(hardpoints|loadout|calculations)$`),
  new RegExp(`^${BASE_PATH}/ships/[^/]+/ports/[^/]+/compatible-components$`),
  new RegExp(`^${BASE_PATH}/components$`),
  new RegExp(`^${BASE_PATH}/components/[^/]+$`),
  new RegExp(`^${BASE_PATH}/ammo/[^/]+$`),
];
const POST_PATHS = [
  `${BASE_PATH}/validate`,
  `${BASE_PATH}/calculate`,
];

const COMMON_QUERY = ["channel", "buildId"];

function assertQueryKeys(search: URLSearchParams, allowed: string[]): void {
  const allowedSet = new Set([...COMMON_QUERY, ...allowed]);
  for (const key of search.keys()) {
    if (!allowedSet.has(key)) {
      throw new FittingHttpError(400, "INVALID_REQUEST", "Invalid request", `Unsupported query parameter: ${key}.`, [
        { path: `query.${key}`, code: "UNSUPPORTED_PARAMETER", message: "This parameter is not supported by the route." },
      ]);
    }
  }
}

function problem(error: FittingHttpError, instance: string, requestId: string): ProblemBody {
  const slug = error.code.toLowerCase().replaceAll("_", "-");
  return {
    type: `https://scintel.example/problems/${slug}`,
    title: error.title,
    status: error.status,
    code: error.code,
    detail: error.message,
    instance,
    requestId,
    errors: error.errors,
  };
}

function responseHeaders(selection: DatasetSelection, body: unknown, cacheable = true): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": cacheable
      ? selection.explicitBuild ? "public, max-age=3600, immutable" : "public, max-age=60, must-revalidate"
      : "no-store",
    "x-scintel-channel": selection.channel,
    "x-scintel-build-id": selection.buildId,
    "x-scintel-api-version": "1",
  };
  if (cacheable) {
    headers.etag = `W/"${createHash("sha256").update(JSON.stringify(body)).digest("base64url")}"`;
  }
  return headers;
}

function errorResult(error: FittingHttpError, instance: string, requestId: string): RouteResult {
  return {
    status: error.status,
    body: problem(error, instance, requestId),
    headers: {
      "content-type": "application/problem+json; charset=utf-8",
      "cache-control": "no-store",
      ...(error.status === 405 ? { allow: POST_PATHS.includes(instance) ? "POST" : "GET, HEAD" } : {}),
    },
  };
}

function decodePortId(value: string): string {
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded || decoded.length > 1024) throw new Error("invalid port id");
    return decoded;
  } catch {
    throw new FittingHttpError(400, "INVALID_REQUEST", "Invalid request", "portId is not a valid encoded path segment.");
  }
}

export async function handleFittingRoute(
  method: string,
  rawUrl: string,
  requestId: string = randomUUID(),
  dataRoot = getFittingDataRoot(),
  requestBody?: unknown,
): Promise<RouteResult | null> {
  const url = new URL(rawUrl, "http://localhost");
  if (url.pathname !== BASE_PATH && !url.pathname.startsWith(`${BASE_PATH}/`)) return null;

  const isPostRoute = POST_PATHS.includes(url.pathname);
  const isReadRoute = READ_PATHS.some((pattern) => pattern.test(url.pathname));

  if (!isPostRoute && !isReadRoute) {
    return errorResult(new FittingHttpError(404, "RESOURCE_NOT_FOUND", "Resource not found", "No fitting API route matched the requested path."), url.pathname, requestId);
  }

  if (isPostRoute && method !== "POST") {
    return errorResult(new FittingHttpError(405, "METHOD_NOT_ALLOWED", "Method not allowed", "Only POST is supported for this route."), url.pathname, requestId);
  }

  if (isReadRoute && method !== "GET" && method !== "HEAD") {
    return errorResult(new FittingHttpError(405, "METHOD_NOT_ALLOWED", "Method not allowed", "Only GET and HEAD are supported."), url.pathname, requestId);
  }

  try {
    const selection = await resolveDataset(url.searchParams, dataRoot);
    let bodyOut: unknown;

    if (isPostRoute) {
      const engineResult = url.pathname === `${BASE_PATH}/validate`
        ? await validateFittingLoadout(selection, requestBody)
        : await calculateFittingLoadout(selection, requestBody);
      bodyOut = { meta: await fittingApiMeta(selection), ...(engineResult as Record<string, unknown>) };
      const headers = responseHeaders(selection, bodyOut, false);
      return { status: 200, body: bodyOut, headers };
    }

    let body: unknown;
    let match: RegExpExecArray | null;

    if (url.pathname === `${BASE_PATH}/meta`) {
      assertQueryKeys(url.searchParams, []);
      body = await getMeta(selection);
    } else if (url.pathname === `${BASE_PATH}/ships`) {
      assertQueryKeys(url.searchParams, ["limit", "cursor", "q", "manufacturer", "vehicleType", "groundVehicle", "sort"]);
      body = await listShips(selection, url.searchParams);
    } else if ((match = new RegExp(`^${BASE_PATH}/ships/([^/]+)$`).exec(url.pathname))) {
      assertQueryKeys(url.searchParams, ["include"]);
      body = await getShip(selection, match[1], url.searchParams);
    } else if ((match = new RegExp(`^${BASE_PATH}/ships/([^/]+)/hardpoints$`).exec(url.pathname))) {
      assertQueryKeys(url.searchParams, ["format", "include"]);
      body = await getHardpoints(selection, match[1], url.searchParams);
    } else if ((match = new RegExp(`^${BASE_PATH}/ships/([^/]+)/loadout$`).exec(url.pathname))) {
      assertQueryKeys(url.searchParams, ["include"]);
      body = await getLoadout(selection, match[1], url.searchParams);
    } else if ((match = new RegExp(`^${BASE_PATH}/ships/([^/]+)/calculations$`).exec(url.pathname))) {
      assertQueryKeys(url.searchParams, ["include"]);
      body = await getCalculations(selection, match[1], url.searchParams);
    } else if ((match = new RegExp(`^${BASE_PATH}/ships/([^/]+)/ports/([^/]+)/compatible-components$`).exec(url.pathname))) {
      assertQueryKeys(url.searchParams, ["limit", "cursor"]);
      body = await listCompatibleComponents(selection, match[1], decodePortId(match[2]), url.searchParams);
    } else if (url.pathname === `${BASE_PATH}/components`) {
      assertQueryKeys(url.searchParams, ["limit", "cursor", "q", "type", "size", "grade", "class", "manufacturer", "sort"]);
      body = await listComponents(selection, url.searchParams);
    } else if ((match = new RegExp(`^${BASE_PATH}/components/([^/]+)$`).exec(url.pathname))) {
      assertQueryKeys(url.searchParams, ["include"]);
      body = await getComponent(selection, match[1], url.searchParams);
    } else if ((match = new RegExp(`^${BASE_PATH}/ammo/([^/]+)$`).exec(url.pathname))) {
      assertQueryKeys(url.searchParams, ["include"]);
      body = await getAmmo(selection, match[1], url.searchParams);
    } else {
      throw new FittingHttpError(404, "RESOURCE_NOT_FOUND", "Resource not found", "No fitting API route matched the requested path.");
    }

    return { status: 200, body, headers: responseHeaders(selection, body) };
  } catch (error) {
    if (error instanceof FittingHttpError) return errorResult(error, url.pathname, requestId);
    return errorResult(new FittingHttpError(500, "INTERNAL_ERROR", "Internal error", "The fitting API could not complete the request."), url.pathname, requestId);
  }
}
