import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mdx from "@mdx-js/rollup";
import svgr from "vite-plugin-svgr";
import remarkFrontmatter from "remark-frontmatter";

export default defineConfig({
  plugins: [
    react(),
    svgr(),
    mdx({
      providerImportSource: "@mdx-js/react",
      remarkPlugins: [remarkFrontmatter],
    }),
  ],
});
