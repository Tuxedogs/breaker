# Dev preview target, November 10 2026

- Previously running dev build at http://localhost:5173/
- Previously served worktree: `D:\Moonbreaker-mockup-current`
- **User's current/working Mining branch to remember:** `claude/mining-materials-panel`
- This original Mining worktree has local uncommitted changes, all to be preserved. Do not reset, stash, checkout, merge into, or overwrite it.
- New preview worktree: `D:\Moonbreaker-pages-parallel-20261110`
- New preview branch: `claude/nonmining-pages-20261110`
- Switch only the running Vite dev server on port 5173, not Git branches or files.
- Original startup was `npm run dev` in the Mining worktree invoking `vite --config vite.local-fixtures.config.ts --mode fixtures`.
- To return to the user's Mining preview: stop Vite on port 5173 and start the same command from `D:\Moonbreaker-mockup-current`. This is a server switch, not a Git branch checkout.
