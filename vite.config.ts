import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mdx from "@mdx-js/rollup";
import svgr from "vite-plugin-svgr";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import path from "node:path";
import { handleRecommenderRoute } from "./server/routes/recommender.routes";
import { handleBuildQueueRoute } from "./server/routes/buildQueue.routes";

async function readRequestBody(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export default defineConfig({
  plugins: [
    {
      name: "scintel-recommender-api",
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const url = request.url?.split("?")[0] ?? "";
          if (url !== "/api/recommender/recommendations" && url !== "/api/build-queue/requirements") {
            next();
            return;
          }
          const body = await readRequestBody(request);
          const route =
            await handleRecommenderRoute(request.method ?? "GET", url, body) ??
            await handleBuildQueueRoute(request.method ?? "GET", url, body);
          if (!route) {
            next();
            return;
          }
          response.statusCode = route.status;
          response.setHeader("content-type", "application/json");
          response.end(JSON.stringify(route.body));
        });
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
});
