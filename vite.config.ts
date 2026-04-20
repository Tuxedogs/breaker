import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mdx from "@mdx-js/rollup";
import svgr from "vite-plugin-svgr";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";

export default defineConfig({
  plugins: [
    react(),
    svgr(),
    mdx({
      providerImportSource: "@mdx-js/react",
      remarkPlugins: [remarkFrontmatter, remarkGfm],
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("/node_modules/three/") ||
            id.includes("/node_modules/@react-three/fiber/") ||
            id.includes("/node_modules/@react-three/drei/") ||
            id.includes("/node_modules/three-stdlib/")
          ) {
            return "viewer-vendor";
          }
        },
      },
    },
  },
});
