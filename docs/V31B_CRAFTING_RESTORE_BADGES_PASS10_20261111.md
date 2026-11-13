# Crafting recipe list, Pass 10: restore original badges and enlarge thumbnails

Date: 2026-11-11
Worktree: D:\Moonbreaker-unified-review-20261110
Branch: review/unified-v31-20261110
Preview: http://localhost:5173 (local fixtures)

## User request

Restore recipe material badges to their appearance before accent/ranking-chip experiments, increase component artwork size, and reduce the side padding around the Blueprint Index recipe list.

## Changes

- Restored the exact `craft-v31-material-chips` JSX from commit `7ebb57118`. It shows full material names in neutral outlined labels and preserves the subtle selected-material highlighting.
- Restored the three original badge style rules from that commit. No extra material palette, custom background tint, or abbreviated Mining ranking badge renderer remains on the Crafting recipe list.
- Removed the material accent system added during passes 8 and 9, and restored Mining's pre-pass-9 `MaterialCoverageChips.tsx` and `mining.css`, removing the now-unused shared ranked-material CSS.
- Maintained the verified component artwork resolver, existing images, Blueprint Index normal/active background styles, recipe selection, and filters.
- Enlarged the thumbnail frame from 23x25 to 42x44 pixels, with a centered contain-fit image using the available frame.
- Reduced list side padding from 12px to 5px and row side padding from 10px to 7px. Adjusted row minimum height to 83px and the thumbnail grid column to 42px.
- No new stylesheet override file, branch, or worktree.

## Verification

- Browser at 1440px and 390px: 26 recipe rows, 76 full-name neutral badges, 19 loaded and contained component renders, correct 42x44 thumbnail stage, zero CSS overflow, zero runtime errors.
- Selected Beryl filter retained the original subtle #184052 matching-label background.
- Mining ranking chips still display their abbreviations and retain the pre-pass-9 presentation.
- Original Badge/reverted thumbnail QA: `scripts/qa/v31-pass10-badge-revert-thumbnails.cjs`. Legacy pass8 QA delegates to the new assertion to prevent regression tests enforcing rejected styling.
- TypeScript, CSS ownership, page smoke, filter interactions, cross-page checks and fixture build are regression-tested.

## iOS screenshots

Desktop before/after: https://files.catbox.moe/91eaod.jpg
Mobile before/after: https://files.catbox.moe/6822lb.jpg

## Limitations

Seven fixture recipes still lack verified matching component renders; those correctly retain their blueprint placeholder. This change does not introduce substitute artwork or claim production backend verification.
