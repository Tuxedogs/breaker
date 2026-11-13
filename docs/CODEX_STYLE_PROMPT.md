# Codex prompts for style unification

## 1. Add to AGENTS.md (permanent)

```md
## Styling rules (enforced by `npm run style:check`)
- The only styling vocabulary is the `--mb-*` tokens in src/styles/tokens.css.
- Never add hex/rgb/hsl colors, raw font-family, raw border-radius, `!important`,
  or new custom properties outside tokens.css. The style ratchet fails the build if you do.
- One interactive accent: `--mb-accent` for selection, focus, active. Semantic colors
  (`--mb-good`, `--mb-bad`, `--mb-warn`, `--mb-info`) carry meaning only, never decoration.
- No command/page header. Every top-level page uses `AppPageShell`, and its working content
  fills the entire available vertical space. Do not add `CommandHeader`, page titles, heroes
  or banners above the working surface.
- Mining is the visual reference. When unsure, match it. Crafting is the reference only for
  the detail drawer/dialog, long-form detail sections, mobile filter sheet and charts; never
  copy its colors, fonts, spacing or known issues (see `moonbreaker_design_canon.md`).
- Do not read from or copy styles out of src/archive or src/pages/_archive.
- A styling task is done only when `npm run style:check` passes and you ran
  `node scripts/style-ratchet.mjs --update` to lock in reductions.
```

## 2. Per-page migration prompt (one session per page)

Fill in the two blanks and paste:

```
Task: migrate the {PAGE NAME} page to the shared Breaker style system. Visual-only change.

Scope (do not edit anything else):
- {STYLESHEET PATH(S)}
- The page component(s) that render it

Steps, in order:
1. Report the current ratchet numbers for these files:
   node scripts/style-ratchet.mjs  (read the baseline entries for the scoped files)
2. Wrap the page in AppPageShell with no command/page header; the working content fills the
   entire available vertical space. Delete the old header/hero CSS and markup.
3. Replace every page-local custom property DEFINITION with an alias to the closest
   --mb-* token (e.g. --bq-panel-bg: var(--mb-surface-1);). List the mapping you chose.
4. Replace color literals, raw fonts and raw radii in selectors with --mb-* tokens.
   Any accent used for selection/focus/active becomes --mb-accent.
   Decorative violet/teal/amber with no meaning becomes neutral surface/border.
5. Remove !important where the cascade allows it; leave a comment where it does not.
6. Delete selectors that no longer match any className in the scoped components.
7. Run: npm run style:check && npm run lint && npm run build
8. Run: node scripts/style-ratchet.mjs --update and show before/after numbers.

Rules:
- Do not change data, calculations, routing, filters, persistence or markup semantics.
- Do not invent new tokens. If nothing in --mb-* fits, stop and ask me.
- Do not touch tokens.css unless I say so.

Deliver: the token mapping table, before/after ratchet numbers, and the list of
deleted selectors. If you could not finish a step, say which and why.
```

## 3. Phase 1 prompt (token layer, run once)

```
Task: add the --mb-* semantic token layer to src/styles/tokens.css exactly as specified
in docs/STYLE_UNIFICATION.md Phase 1. Accent decision: {cyan|amber}.
Then re-point --void-*, --bg-*, --ui-* tokens at --mb-* equivalents where the values
match or are near-identical (list any you could not map). Update tailwind.config.js
ink/mist to use var(--mb-text-1)/var(--mb-text-2).
Do not edit any other stylesheet. Run npm run build and npm run style:check.
```
