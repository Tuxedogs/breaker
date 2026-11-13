import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import mdx from "@mdx-js/rollup";
import svgr from "vite-plugin-svgr";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import path from "node:path";
import { assertStagingConfiguration } from "./src/server/staging/config";

export default defineConfig(({ command, mode, isPreview }) => {
  // Mode names do not establish isolation: dev and preview must never start here.
  if (command !== "build" || isPreview || mode !== "production") {
    throw new Error("Use the verified Vercel staging Preview; local dev and preview servers are disabled on this branch.");
  }
  const env = loadEnv(mode, process.cwd(), "");
  assertStagingConfiguration({ ...env, ...process.env });

  return {
    define: {
      "import.meta.env.VITE_FIXTURES_ENABLED": JSON.stringify(env.VITE_FIXTURES_ENABLED === "1"),
    },
    plugins: [
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
