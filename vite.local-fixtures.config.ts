import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mdx from "@mdx-js/rollup";
import svgr from "vite-plugin-svgr";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import path from "node:path";
import { readFileSync, realpathSync } from "node:fs";
import { handleSourceRoute } from "./server/routes/source.routes";
import { handleMissionsRoute } from "./server/routes/missions.routes";
import { handleCraftingBlueprintSourcesRoute } from "./server/routes/craftingBlueprintSources.routes";

/**
 * Isolated synthetic UI workshop; never uses staging/production credentials.
 * Allows local dev hot reload or a locally compiled preview. Both are blocked
 * from accessing any application API or authentication routes, except the
 * read-only Mining, Crafting, Refinery Planner and Mission Browser data files
 * served from server-data below.
 * The verified Vercel staging config remains separate and unchanged.
 */
const lanIp = process.env.BREAKER_FIXTURE_LAN_IP?.trim();
if (lanIp && !/^(?:192\.168\.|10\.|172\.(?:1[6-9]|2\d|3[01])\.)\d{1,3}\.\d{1,3}$/.test(lanIp)) {
  throw new Error("Fixture LAN binding must be an explicit private IPv4 address.");
}
const host = lanIp || "127.0.0.1";
const headers = {
  "Content-Security-Policy": [
    "default-src 'self' data: blob:",
    "connect-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    "frame-src 'none'",
    "form-action 'self'",
  ].join("; "),
};
function denyBackend(req: { url?: string }, res: {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(value: string): void;
}, next: () => void) {
  const pathname = (req.url ?? "").split("?")[0] ?? "";
  if (pathname === "/api" || pathname.startsWith("/api/") ||
      pathname === "/auth" || pathname.startsWith("/auth/")) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "text/plain");
    res.end("Local UI fixtures cannot reach any authentication or database API.");
    return;
  }
  next();
}

// Read-only Mining indexes from tracked files in server-data/mining (same map as
// server/routes/mining.routes.ts). No server code, database or auth runs; every other
// /api route stays blocked by denyBackend.
const miningFixtureFiles = new Map<string, string>([
  ["/api/mining/location-materials", "indexes/location-material.json"],
  ["/api/mining/encounter-rankings", "indexes/material-encounter-rankings.json"],
  ["/api/mining/material-quality", "indexes/material-quality.json"],
  ["/api/mining/location-distribution", "indexes/location-distribution.json"],
  ["/api/mining/location-hierarchy", "indexes/location-hierarchy.json"],
  ["/api/mining/lagrange-groups", "locations/lagrange-groups.json"],
  ["/api/mining/lagrange-children", "locations/lagrange-children.json"],
]);
function serveMiningFixture(req: { url?: string; method?: string }, res: {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(value: Buffer): void;
}, next: () => void) {
  const file = miningFixtureFiles.get((req.url ?? "").split("?")[0] ?? "");
  if (!file || (req.method !== "GET" && req.method !== "HEAD")) { next(); return; }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(readFileSync(path.resolve(__dirname, "server-data", "mining", file)));
}

// Read-only Crafting, Refinery Planner and Mission Browser fixtures from tracked files in
// server-data, served exactly as the API routes return them. Lookups go through each data
// set's own index (recordFiles) or current.json pointer, so no request path reaches the disk.
const serverDataRoot = path.resolve(__dirname, "server-data");
const referenceFixtureFiles = new Map<string, string>([
  ["/api/crafting/reference/refinery-yields", "crafting/reference/refinery-yields.json"],
  ["/api/crafting/reference/material-identity", "crafting/reference/material-identity-index.json"],
]);
const recordFixtureRoutes = [
  // GET /api/crafting/component-cards/:id (same lookup as server/routes/componentCards.routes.ts)
  { pattern: /^\/api\/crafting\/component-cards\/([0-9a-f-]{36})$/i, root: "crafting/component-cards" },
  // GET /api/crafting/recipes/:blueprintGuid (same lookup as server/routes/craftingRecipes.routes.ts)
  { pattern: /^\/api\/crafting\/recipes\/([0-9a-f-]{36})$/i, root: "crafting/recipes" },
];
function readServerData(relativePath: string): Buffer {
  return readFileSync(path.join(serverDataRoot, relativePath));
}
function resolveDataFixture(url: string): string | null {
  const [pathname = ""] = url.split("?");
  const referenceFile = referenceFixtureFiles.get(pathname);
  if (referenceFile) return referenceFile;
  for (const route of recordFixtureRoutes) {
    const id = pathname.match(route.pattern)?.[1]?.toLowerCase();
    if (!id) continue;
    const index = JSON.parse(readServerData(`${route.root}/index.json`).toString("utf8")) as { recordFiles?: Record<string, string> };
    const file = index.recordFiles?.[id];
    return file ? `${route.root}/${file}` : null;
  }
  return null;
}
function serveDataFixture(req: { url?: string; method?: string }, res: {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(value: Buffer): void;
}, next: () => void) {
  if (req.method !== "GET" && req.method !== "HEAD") { next(); return; }
  const file = resolveDataFixture(req.url ?? "");
  if (!file) { next(); return; }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(readServerData(file));
}


/** Read-only Mission Browser and blueprint-source routes, answered by the same file-backed
 * handlers the API server uses (server-data only; no database, authentication or user state).
 * The eligibility and prerequisite-path POSTs are stateless solver calls over published data.
 */
const missionFixtureMethods = new Set(["GET", "HEAD", "POST"]);
function isMissionFixturePath(pathname: string): boolean {
  return pathname.startsWith("/api/missions/")
    || pathname.startsWith("/api/crafting/blueprint-sources")
    || pathname.startsWith("/api/crafting/blueprint-rewards/");
}
function serveMissionRouteFixture(req: NodeJS.ReadableStream & { url?: string; method?: string }, res: {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(value?: string): void;
}, next: () => void) {
  const url = req.url ?? "";
  const method = req.method ?? "GET";
  if (!isMissionFixturePath(url.split("?")[0] ?? "") || !missionFixtureMethods.has(method)) { next(); return; }
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  req.on("end", () => {
    let body: unknown = {};
    try {
      const raw = Buffer.concat(chunks).toString("utf8");
      body = raw ? JSON.parse(raw) : {};
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Invalid JSON body." }));
      return;
    }
    const routeMethod = method === "HEAD" ? "GET" : method;
    void (async () => (await handleMissionsRoute(routeMethod, url, body))
      ?? (await handleCraftingBlueprintSourcesRoute(routeMethod, url, body)))()
      .then((result) => {
        if (!result) { next(); return; }
        res.statusCode = result.status;
        res.setHeader("Content-Type", "application/json");
        res.end(method === "HEAD" ? undefined : JSON.stringify(result.body));
      })
      .catch(() => {
        res.statusCode = 503;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Mission data unavailable" }));
      });
  });
}

/** A read-only Source catalog route, backed exclusively by the published registry.
 * Unpublished Journal associations stay "unknown" unless explicitly supplied
 * through the existing opt-in Source development path.
 */
function serveSourceCatalogFixture(req: { url?: string; method?: string }, res: {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(value: string | undefined): void;
}, next: () => void) {
  if ((req.url ?? "").split("?")[0] !== "/api/source/catalog") { next(); return; }
  void handleSourceRoute(req.method ?? "GET", req.url ?? "")
    .then((result) => {
      res.statusCode = result?.status ?? 404;
      res.setHeader("Content-Type", "application/json");
      res.end(req.method === "HEAD" ? undefined : JSON.stringify(result?.body ?? { error: "Source catalog unavailable" }));
    })
    .catch(() => {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Source catalog unavailable" }));
    });
}

export default defineConfig(({ command, mode }) => {
  if (mode !== "fixtures" || (command !== "serve" && command !== "build")) {
    throw new Error("Only local fixture builds or local fixture preview are permitted.");
  }
  return {
    envDir: path.resolve(__dirname, "staging", "__unused_fixture_env_directory__"),
    envPrefix: "__BREAKER_NO_ENV_EXPOSURE__",
    define: {
      "import.meta.env.VITE_FIXTURES_ENABLED": "true",
      "import.meta.env.VITE_LOCAL_COMPILED_FIXTURE": "true",
    },
    plugins: [
      {
        name: "reject-any-backend-in-local-fixtures",
        configureServer(server) {
          server.middlewares.use(serveMiningFixture);
          server.middlewares.use(serveDataFixture);
          server.middlewares.use(serveMissionRouteFixture);
          server.middlewares.use(serveSourceCatalogFixture);
          server.middlewares.use(denyBackend);
        },
        configurePreviewServer(server) {
          server.middlewares.use(serveMiningFixture);
          server.middlewares.use(serveDataFixture);
          server.middlewares.use(serveMissionRouteFixture);
          server.middlewares.use(serveSourceCatalogFixture);
          server.middlewares.use(denyBackend);
        },
      },
      react(),
      svgr(),
      mdx({
        providerImportSource: "@mdx-js/react",
        remarkPlugins: [remarkFrontmatter, remarkGfm],
      }),
    ],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    build: {
      outDir: path.resolve(__dirname, "node_modules", ".cache", "breaker-local-fixtures"),
      emptyOutDir: true,
      sourcemap: false,
    },
    server: {
      host,
      port: 5173,
      strictPort: true,
      // Some Windows worktrees junction node_modules to a shared dependency directory.
      // Allow only that resolved dependency root so the local preview serves real font files.
      fs: { allow: [path.resolve(__dirname), realpathSync(path.resolve(__dirname, "node_modules"))] },
      cors: false,
      // Vite HMR requires a same-origin websocket in dev mode.
      headers: { ...headers, "Content-Security-Policy": headers["Content-Security-Policy"].replace("connect-src 'self'", "connect-src 'self' ws: wss:") },
    },
    preview: {
      host,
      port: 5174,
      strictPort: true,
      cors: false,
      headers,
    },
  };
});
