# Crafting V31b Recipe Index Presentation | Pass 8
Date: 2026-11-11
Worktree: D:\Moonbreaker-unified-review-20261110
Branch: review/unified-v31-20261110
Preview: http://127.0.0.1:5173 (local fixtures)

## Changes
- The existing 23 x 25 pixel orange recipe mark stages now render actual mapped component imagery using resolveComponentImageUrl and the record's stable item identity. Images are centered and object-fit:contain with padding and no clipping.
- The existing asset resolver supplied 19 of 26 fixture recipe rows with actual renders; all 19 loaded successfully. Seven rows have no matching verified render and retain the V31b blueprint glyph. No fake product image substitution.
- Recipe material chips use color accents from the canonical materialPresentation palette. Four absent materials (Beryl, Torite, Bexalite and Agricium) have additional Crafting-only presentation hues. No changes to Mining's palette, chips or calculations.
- The visible 26-row fixture has 76 material chips with accents, including highlighted selected matches.
- Index canvas #091723, normal row #0e202e, hover #152b3a, selected row #163245, selected border #4bc9e5 and inner line #55d6e9 match Breaker_V31b_Responsive_Motion.html.
- Removed 13 conflicting old V31 row, image, end-label and chip styling rules and replaced them with one canonical selector set in craft-v31-layout.css. No !important overrides and no new branch.
- Existing material filtering, blueprint selection, queue status, quality laboratory and other pages remain untouched.

## Verification
- Browser tests at 1440px and 390px: all images loaded and contained, all material chips accented, exact backgrounds, no JS errors, no horizontal overflow.
- v31-pass8-recipe-row-art-accent.cjs verifies selection and material filtering still function.
- CSS ownership, nonmining smoke, previous Crafting filter browser regression and componentImageResolver tests passed.
- TypeScript check, fixture Vite build, Git whitespace check passed. Browser asset validation does not establish live backend availability.

## Screenshots, iOS-friendly
Three-way cropped list comparison: https://files.catbox.moe/u985j6.jpg
Full updated desktop: https://files.catbox.moe/izfnqb.jpg
Full updated mobile: https://files.catbox.moe/ov5kxw.jpg

## Remaining
The 7 records without an exact current component render need future art coverage. Do not map unrelated category icons as if they were product renders. Other Crafting panels still have outstanding V31b visual parity work.
