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
import { handleSavedBlueprintsRoute } from "./src/server/user/savedBlueprintsRoute";
import { handleUserBuildQueueRoute } from "./src/server/user/buildQueueRoute";

const dynamicApiPaths = new Set([
  "/api/recommender/locations",
  "/api/recommender/recommendations",
  "/api/build-queue/requirements",
  "/api/user/saved-blueprints",
  "/api/user/build-queue",
]);

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
  if (!url.startsWith("/api/") || dynamicApiPaths.has(url)) return false;

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

function installScintelApiMiddleware(server: Pick<ViteDevServer | PreviewServer, "middlewares">, scintelApiRoot: string) {
  const middleware: Connect.NextHandleFunction = async (request, response, next) => {
    const url = request.url?.split("?")[0] ?? "";
    if (!dynamicApiPaths.has(url)) {
      if (await tryServeScintelApiFile(request, response, scintelApiRoot)) return;
      next();
      return;
    }
    const body = await readRequestBody(request);
    const route = url === "/api/user/saved-blueprints"
      ? await handleSavedBlueprintsRoute(request.method ?? "GET", request.headers, body)
      : url === "/api/user/build-queue"
        ? await handleUserBuildQueueRoute(request.method ?? "GET", request.headers, body)
        : await handleRecommenderRoute(request.method ?? "GET", url, body) ??
          await handleBuildQueueRoute(request.method ?? "GET", url, body);
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

  return {
    plugins: [
      {
        name: "scintel-recommender-api",
        configureServer(server) {
          installScintelApiMiddleware(server, scintelApiRoot);
        },
        configurePreviewServer(server) {
          installScintelApiMiddleware(server, scintelApiRoot);
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
    build: {
      chunkSizeWarningLimit: 900,
    },
  };
});
