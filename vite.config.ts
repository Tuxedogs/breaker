import { defineConfig, loadEnv } from "vite";
import type { Connect, PreviewServer, ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import mdx from "@mdx-js/rollup";
import svgr from "vite-plugin-svgr";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { handleRecommenderRoute } from "./server/routes/recommender.routes";
import { handleBuildQueueRoute } from "./server/routes/buildQueue.routes";
import { handleFittingRoute } from "./server/routes/fitting.routes";
import { handleMissionsRoute } from "./server/routes/missions.routes";
import { runCraftingBlueprintSourcesApiHandler } from "./server/routes/craftingBlueprintSourcesApi";
import { handleSavedBlueprintsRoute } from "./src/server/user/savedBlueprintsRoute";
import { handleUserBuildQueueRoute } from "./src/server/user/buildQueueRoute";
import { handleUserInventoryRoute } from "./src/server/user/inventoryRoute";

const dynamicApiPaths = [
  "/api/recommender/locations",
  "/api/recommender/recommendations",
  "/api/build-queue/requirements",
  "/api/user/saved-blueprints",
  "/api/user/build-queue",
  "/api/user/inventory",
  "/api/user/inventory/sync",
  "/api/user/inventory/stacks",
  "/api/missions/browser",
];

function isCraftingBlueprintSourcesApiPath(pathname: string) {
  return pathname === "/api/crafting/blueprint-sources"
    || pathname === "/api/crafting/blueprint-sources/index"
    || pathname === "/api/crafting/blueprint-sources/batch"
    || pathname === "/api/crafting/blueprint-rewards/release-state"
    || pathname === "/api/crafting/blueprint-rewards/missions"
    || pathname.startsWith("/api/crafting/blueprint-rewards/missions/");
}

function isComponentCardsApiPath(pathname: string) {
  return pathname === "/api/crafting/component-cards/index"
    || pathname === "/api/crafting/component-cards/facets"
    || pathname === "/api/crafting/component-cards/browse"
    || /^\/api\/crafting\/component-cards\/[^/]+$/.test(pathname);
}

function isCraftingRecipesApiPath(pathname: string) {
  return pathname === "/api/crafting/recipes/index"
    || pathname === "/api/crafting/recipes/catalog/vehicle"
    || pathname === "/api/crafting/recipes/catalog/fps"
    || pathname === "/api/crafting/recipes/batch"
    || /^\/api\/crafting\/recipes\/[^/]+$/.test(pathname);
}

function isCraftingReferenceApiPath(pathname: string) {
  return pathname === "/api/crafting/reference/crafted-properties"
    || pathname === "/api/crafting/reference/quality-quantization"
    || pathname === "/api/crafting/reference/material-quality-quantization"
    || pathname === "/api/crafting/reference/material-identity";
}

function isCraftingShapedApiPath(pathname: string) {
  return isCraftingBlueprintSourcesApiPath(pathname)
    || isComponentCardsApiPath(pathname)
    || isCraftingRecipesApiPath(pathname)
    || isCraftingReferenceApiPath(pathname);
}

function isDynamicApiPath(pathname: string) {
  return dynamicApiPaths.includes(pathname)
    || isCraftingShapedApiPath(pathname)
    || pathname.startsWith("/api/fitting/")
    || pathname.startsWith("/api/v1/fitting/")
    || pathname.startsWith("/api/missions/family/")
    || pathname.startsWith("/api/missions/families/")
    || pathname.startsWith("/api/missions/variant/")
    || pathname.startsWith("/api/missions/variants/")
    || pathname.startsWith("/api/user/inventory/stacks/")
    || pathname.startsWith("/api/user/inventory/locations/");
}

const contentTypes: Record<string, string> = {
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

async function readRequestBody(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function tryServeScintelApiFile(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
  scintelApiRoot: string,
): Promise<boolean> {
  if (request.method !== "GET" && request.method !== "HEAD") return false;

  const url = request.url?.split("?")[0] ?? "";
  if (!url.startsWith("/api/") || isDynamicApiPath(url)) return false;

  const relativePath = decodeURIComponent(url.slice("/api/".length));
  const filePath = path.resolve(scintelApiRoot, relativePath);
  const relativeToRoot = path.relative(scintelApiRoot, filePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) return false;

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return false;
  } catch {
    return false;
  }

  response.statusCode = 200;
  response.setHeader("content-type", contentTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream");
  if (request.method === "HEAD") {
    response.end();
    return true;
  }
  createReadStream(filePath).pipe(response);
  return true;
}

function installScintelApiMiddleware(
  server: Pick<ViteDevServer | PreviewServer, "middlewares">,
  scintelApiRoot: string,
  fittingDataRoot: string,
) {
  const middleware: Connect.NextHandleFunction = async (request, response, next) => {
    const url = request.url?.split("?")[0] ?? "";
    if (!isDynamicApiPath(url)) {
      if (await tryServeScintelApiFile(request, response, scintelApiRoot)) return;
      next();
      return;
    }
    let body: unknown;
    try {
      body = await readRequestBody(request);
    } catch {
      response.statusCode = 400;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ error: "Invalid request body." }));
      return;
    }
    if (isCraftingShapedApiPath(url)) {
      await runCraftingBlueprintSourcesApiHandler(request, response);
      return;
    }

    if (url.startsWith("/api/v1/fitting/")) {
      const pathname = url.split("?")[0] ?? url;
      const fittingBody = (request.method === "POST" && (pathname.endsWith("/validate") || pathname.endsWith("/calculate"))) ? body : undefined;
      const fittingResult = await handleFittingRoute(request.method ?? "GET", request.url ?? url, undefined, fittingDataRoot, fittingBody);
      if (!fittingResult) {
        next();
        return;
      }
      for (const [key, value] of Object.entries(fittingResult.headers ?? {})) response.setHeader(key, value);
      if (fittingResult.status === 200 && fittingResult.headers?.etag && request.headers["if-none-match"] === fittingResult.headers.etag) {
        response.statusCode = 304;
        response.end();
        return;
      }
      response.statusCode = fittingResult.status;
      response.end(request.method === "HEAD" ? undefined : JSON.stringify(fittingResult.body));
      return;
    }

    const route = await handleUserInventoryRoute(request.method ?? "GET", url, request.headers, body)
      ?? (url === "/api/user/saved-blueprints"
      ? await handleSavedBlueprintsRoute(request.method ?? "GET", request.headers, body)
      : url === "/api/user/build-queue"
        ? await handleUserBuildQueueRoute(request.method ?? "GET", request.headers, body)
        : await handleMissionsRoute(request.method ?? "GET", request.url ?? url) ??
          await handleRecommenderRoute(request.method ?? "GET", url, body) ??
          await handleBuildQueueRoute(request.method ?? "GET", url, body));
    if (!route) {
      next();
      return;
    }
    response.statusCode = route.status;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(route.body));
  };
  server.middlewares.use(middleware);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const scintelApiRoot = path.resolve(process.env.SCINTEL_API_ROOT ?? env.SCINTEL_API_ROOT ?? "D:\\scintel\\api");
  const fittingDataRoot = path.resolve(
    process.env.FITTING_DATA_ROOT ?? env.FITTING_DATA_ROOT ?? path.join(process.cwd(), "server-data", "fitting"),
  );

  return {
    plugins: [
      {
        name: "scintel-recommender-api",
        // Dev uses server.proxy → https://www.scintel.app (see server.proxy below).
        // Preview keeps local API middleware for offline/local data.
        configurePreviewServer(server) {
          installScintelApiMiddleware(server, scintelApiRoot, fittingDataRoot);
        },
      },
      react(),
      svgr(),
      mdx({
        providerImportSource: "@mdx-js/react",
        remarkPlugins: [remarkFrontmatter, remarkGfm],
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: "https://www.scintel.app",
          changeOrigin: true,
          secure: true,
          // Strip Domain so Set-Cookie works on localhost during auth flows.
          cookieDomainRewrite: "",
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 900,
    },
  };
});
