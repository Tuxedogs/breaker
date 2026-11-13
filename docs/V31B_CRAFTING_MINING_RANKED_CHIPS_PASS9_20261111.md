# Crafting recipe chips: Mining ranking-list parity (Pass 9)
Date: 2026-11-11
Worktree: D:\Moonbreaker-unified-review-20261110
Branch: review/unified-v31-20261110
Preview: http://127.0.0.1:5173 (fixture mode)

## Correction
The prior Crafting recipe-list material chip implementation was not the approved Mining ranking-list presentation. It used full names, an invented Crafting-only supplemental color palette, and custom color-mixed accent CSS. All of that custom treatment has been removed from runtime code.

Crafting now renders RankedMaterialCoverageChip, extracted from Mining's actual MaterialCoverageChips component, using:
- The same materialShortCode() abbreviation logic.
- The same resolveMaterialPresentation() color lookup, including its neutral fallback for unknown materials. No fabricated Beryl, Torite, Bexalite, or Agricium colors.
- The exact same computed font, border, background, dimensions, padding, and CSS rules.
- No separate --craft-material-accent property or Crafting-only has-accent / is-matching decorative styles.

The six ranking chip styling rules were moved from mining.css to the shared ranked-material-coverage-chip.css and imported by MaterialCoverageChips.tsx, preserving Mining's existing rendering. Both Mining and Crafting now render chips from the same component. Crafting uses the full material name as a tooltip and a nonfocusable chip inside the clickable recipe row, while Mining retains its own focusable coverage semantics.

Recipe artwork, the orange thumbnails, recipe row backgrounds, search, filters, selected-material counts, queue and laboratory wiring are unchanged.

## Verification
- Browser verified Mining and Crafting Stileron chips have identical computed font, padding, border color, background, foreground color, and border radius. Both display Sti.
- Desktop 1440px and mobile 390px: 76 canonical ranking chips, 19 loaded component images, no horizontal overflow, no runtime errors, matching row backgrounds, and no obsolete accent property.
- TypeScript passed; V31 CSS ownership passed; page smoke passed; Crafting material filtering passed; Mining ranked-chip parity test passed; shared shell, interaction and sourcing suites passed; fixture Vite build passed; Git whitespace check passed.
- Fixture testing does not certify live backend integration.

## Review screenshots (phone-viewable)
Mining ranking list compared with Crafting before and after: https://files.catbox.moe/0twr91.jpg
Updated full desktop: https://files.catbox.moe/j1iblk.jpg
Updated mobile: https://files.catbox.moe/uvk1vd.jpg
