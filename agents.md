# Project Rules (Glass Docs Site)

- Stack: Vite + React + TypeScript + Tailwind.
- Style: glass UI (blur + low opacity + borders). No opaque white panels.
- Architecture: docs-first. Nav is data (nav.ts). Layout is Header + Sidebar + PageLayout only.
- Content: MDX-ready. Minimal logic. No dashboards, no complex state.
- Definition of done: npm run dev works, npm run build passes, no TS errors.