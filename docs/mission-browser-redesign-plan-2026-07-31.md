# Mission Browser Accepted Design Canon

Updated: 2026-08-01

Status: Accepted and implemented. This document supersedes the proposal status previously recorded at this path and the rejected persistent-hero or inline-drawer direction.

## Scope and authority

Page: `/industry/missions`

Components: Mission Browser filter/results shell, category/faction/reputation groups, mission concept cards, complete mission-detail modal, exact-variant comparison, eligibility workspace, and prerequisite paths.

The browser/card mockup and complete modal mockup were accepted. The production redesign was committed in `8a7d5f416`, with the later accepted refinements of a five-column desktop grid and a 1px semantic card edge incorporated into this canon.

This is a presentation and interaction contract. It must not change mission APIs, extraction, routing, bookmarks, solver behavior, payout calculations, eligibility logic, prerequisite logic, or Blueprint Tracker identities.

## Visual direction

Use the Dashboard `Next Fabrication Run` card as the closest composition reference: a strong operational perimeter, compact summary, grouped peer regions, explicit state labels, layered internal cards, bounded scrolling, and a clear action path. Align with Build Queue through graphite-black and deep-navy surfaces, quiet borders, restrained elevation, compact header bands, aligned metrics, readable technical typography, and tabular numerals.

The page is a premium spacecraft operations interface, not a decorative card gallery. Repeated cards and rows do not receive independent glow, heavy outlines, or ornamental shadows. Cyan, teal, violet, amber, green, and red are semantic colors, not generic decoration.

## Browser hierarchy

The accepted browser sequence is:

1. Compact page identity with the `Contract Registry` kicker, `Mission Browser` title, and current group/count summary.
2. Existing search and six filters in the shared filter shell.
3. Existing `Full`, `Faction`, and `Reputation` views plus the reputation-path legend.
4. Category, faction, or reputation group header.
5. Five-column mission concept grid at the primary desktop layout.
6. Existing results count and pagination.

The five-column grid is the accepted desktop baseline. Each column may shrink with `minmax(0, 1fr)` so the group surface owns the available width. Responsive rules may reduce or stack columns when the viewport cannot preserve readable card content. Do not reintroduce the earlier two-column desktop baseline without new design approval.

Search, filters, view precedence, zero-results recovery, pagination, canonical URLs, and legacy URL repair remain unchanged.

## Mission card contract

Each card is one direct modal trigger. It contains:

1. A quiet 1px reputation-scope accent edge.
2. Faction initials and mission identity.
3. Provider and mission category.
4. A stable comparison row for variant count, pickup summary, and base/solo payout.
5. Important source-backed semantic badges.
6. Quiet supporting metadata and a disclosure icon.

The 1px accent is a semantic reputation cue, not a heavy item outline. The card retains its quiet structural border, no independent shadow, and a restrained hover lift. Hover, keyboard focus, and selected states must remain visually distinct.

Badge priority is:

1. Reputation scope, always badged.
2. Explicit `Verified Mission` or `Unverified Mission`, only when normalized source data provides it.
3. Blueprint pool count, item rewards, or required mission items when present.
4. CrimeStat or another real operational constraint when important.

Do not badge lawful status. Present it as labeled text such as `Legal classification: Unknown`, with full legal-source detail retained in technical disclosure. Do not infer verified/unverified status from title confidence, mission wording, legality, or page-local parsing. Search/filter match context remains quiet supporting text rather than an evidence badge.

## Complete mission-detail modal

Selecting a concept card opens the complete modal directly. Do not restore an inline drawer, persistent selected-concept hero, intermediate hero panel, or obscure `Open dossier` action.

The accepted modal hierarchy is:

1. Sticky identity header with faction icon/initials, title, provider/category, source-backed badges, bookmark icon, close icon, and lawful classification as plain text.
2. Compact facts strip for active variants, exact variants, pickup scope, base/solo payout range, and mission-item requirement count.
3. Peer overview surfaces:
   - Main column: briefing and required-item card.
   - Right rail: layered rewards card and separate blueprint-rewards card.
4. Full-width exact mission comparison.
5. Eligibility and prerequisite-path workspace, replacing the comparison region only while the existing check flow is active.
6. Confidence and unresolved-data footer.

The rewards region must read as layered operational cards. Reputation reward, aUEC payout, certification buy-in, item rewards, and blueprint pools remain distinct concepts; they must not collapse into a flat text block.

Required-item rows remain compact and preserve proven collect/deliver versus runtime-selected semantics. Blueprint rows retain pool evidence, chance/count details, icons, and Blueprint Tracker actions. All information currently delivered by the mission contract remains presented.

The modal owns vertical scrolling. Long comparison tables use bounded horizontal scrolling instead of clipping columns. Header controls remain visible, correctly scaled, and icon-led. Escape, backdrop click, and the close control dismiss the modal; focus returns to the invoking card and body scroll remains locked while open.

## Typography and density

Mission content must remain readable at every supported resolution. Identity, section headings, values, secondary evidence, and body copy each have a distinct level. Long briefing text uses a bounded readable line length and preserves authored line breaks. Blueprint reward names remain visually stronger than their evidence lines.

Do not shrink type merely to force more information into view. Prefer bounded internal scrolling and compact row construction. Numeric comparisons, payouts, counts, and reputation amounts use tabular numerals.

## Color roles

- Canvas and structural surfaces: graphite and deep navy.
- Interaction, links, focus, and selected boundaries: cool cyan.
- Reputation scope: controlled source-category accent on the 1px card edge and reputation badge.
- Verified mission evidence: green label and border.
- Unverified or unresolved evidence: amber label and border.
- Blueprint evidence: teal.
- Required items and collect/deliver attention: amber.
- Active, eligible, and complete outcomes: green.
- Error, invalid, or required CrimeStat: red.
- Missing or unavailable data: neutral and muted, never whole-card opacity.

Avoid generic cyan-plus-violet decoration, rainbow borders, broad glow, and heavy repeated outlines.

## CSS ownership

Mission Browser styles remain page-local and split by responsibility:

- `mission-browser.css`: import order and page-local tokens.
- `mission-browser-shell.css`: page identity, filters, groups, pagination, and empty/error states.
- `mission-browser-cards.css`: cards, the five-column grid, badges, the 1px reputation edge, and interaction states.
- `mission-browser-modal.css`: backdrop, modal perimeter, header, facts, dossier cards, required items, rewards, blueprints, and footer.
- `mission-browser-workspaces.css`: exact variants, eligibility, prerequisite paths, and technical disclosure.
- `mission-browser-responsive.css`: consolidated viewport behavior.

Do not append recovery layers, restore historical drawer selectors, create a global primitive for this page, or use high-specificity overrides when a page-local owner exists.

## Responsive contract

Validate at minimum:

- `768x900`: stacked browser cards and an edge-safe single-column modal; icon controls remain visible and tables scroll horizontally.
- `1920x1080`: five-column browser grid and the accepted main-column/right-rail modal composition.
- `2560x1440`: density-aware layout with readable card contents and intentionally scaled modal regions.
- `3840x2160`: wide-screen density without unbounded briefing lines, giant empty regions, or stretched row content.

Column reductions at compact or density-scaled breakpoints are allowed only to preserve content readability. Long titles, many rows, many exact variants, required items, blueprint pools, and overflow must remain inspectable.

## Data and behavior preserved

- Direct card-to-modal interaction.
- Readable mission URLs and legacy link repair.
- Search, filters, Full/Faction/Reputation views, pagination, and zero-results recovery.
- Exact-variant sorting and Active/All variants control.
- Valid zero distinguished from missing or unresolved payout.
- Certification buy-in separated from payout.
- Required-item evidence semantics.
- Blueprint reward pools, bookmark identity, and Blueprint Tracker compatibility.
- Server-owned eligibility and prerequisite paths.
- Unknown player state remains unknown.
- Raw GUIDs remain outside normal presentation.
- Runtime-selected locations remain explicit and are never invented.

## Validation

For future Mission Browser visual changes, run:

```powershell
npm run ui:missions
npm run lint
npm run build
```

Review populated and zero-result browser states and an information-rich modal at every required viewport. Include long mission names, long briefing text, required items, blueprint rewards, many exact variants, valid zero, missing and unresolved data, loading and error states, eligibility paths, keyboard focus, dismissal, clipping, contrast, and internal scrolling.

## Stop condition

Do not expand Mission Browser presentation changes into a global theme rewrite, API redesign, mission schema change, solver change, or unrelated page refactor. Any departure from the five-column desktop baseline, 1px reputation edge, direct complete-modal interaction, badge rules, or layered reward-card structure requires explicit design approval.
