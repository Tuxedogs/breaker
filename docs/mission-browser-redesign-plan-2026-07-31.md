# Mission Browser Redesign Plan

Updated: 2026-07-31
Status: Design proposal only. Production implementation is intentionally blocked on visual-direction approval.

## Scope

Page: `/industry/missions`
Components: Mission Browser filter/results shell, category/faction/reputation group surfaces, mission concept cards, complete mission-detail modal, exact-variant comparison, eligibility and prerequisite-path workspace.

The redesign must not change mission APIs, extraction, routing, bookmarks, solver behavior, payout calculations, eligibility logic, prerequisite logic, or Blueprint Tracker identities.

## Mockups

- Browser/card direction: `artifacts/mission-browser-redesign-concept/mission-browser-cards-concept-desktop.png`
- Complete modal direction: `artifacts/mission-browser-redesign-concept/mission-browser-modal-concept-desktop.png`

The mockups are layout and visual-system references. Representative text is used to demonstrate state hierarchy. Production badges must remain source-backed.

## Design direction

Use the Dashboard `Next Fabrication Run` card as the composition benchmark: a strong operational perimeter, compact summary, grouped peer regions, explicit state labels, internal scrolling for long data, and a clear action path. Do not copy its exact three-column geometry.

Align the page with Build Queue through:

- Graphite-black and deep-navy surfaces.
- Quiet borders and restrained elevation.
- Compact header bands and aligned metric rows.
- Readable, technical typography using shared density tokens.
- Tabular numerals for payouts, counts, standing, and reputation amounts.
- Semantic color only when the color represents a real mission category, reputation scope, restriction, outcome, or state.
- Clear hover, keyboard-focus, and selected states that do not resemble one another.

## Browser hierarchy

1. Compact page identity: `Contract Registry` kicker, `Mission Browser` title, current group/count summary.
2. Existing search and six filters in the shared filter shell.
3. Existing `Full`, `Faction`, and `Reputation` views plus the reputation-path legend.
4. Category, faction, or reputation group header.
5. Responsive mission-card grid.
6. Existing results count and pagination.

The redesign must retain search, filters, view precedence, zero-results recovery, pagination, canonical URLs, and legacy URL repair.

## Mission card anatomy

Each card remains one direct modal trigger and contains:

1. Reputation-scope accent rail.
2. Faction initials and mission identity.
3. Provider and mission category.
4. Stable comparison row: variant count, pickup summary, base/solo payout.
5. Important semantic badges.
6. Quiet supporting metadata and a disclosure chevron.

Badge priority:

1. Reputation scope, always badged.
2. Explicit `Verified Mission` or `Unverified Mission`, only when normalized source data explicitly provides it.
3. Blueprint pool count, item rewards, or required mission items when present.
4. CrimeStat or other real mission constraint when operationally important.

Do not badge lawful status. Preserve lawful classification as labeled text, for example `Legal classification: Unknown`, and retain full legal-source detail in technical disclosure. Search/filter match context remains visible as quiet contextual text rather than competing with mission evidence badges.

The current view contract does not expose a dedicated normalized verified/unverified field. Before production rendering, verify whether this tag already exists in source-backed title/specificity data. If it does, normalize it at the shaping or projection boundary. Do not infer it from title confidence or page-local string parsing.

## Modal hierarchy

The modal remains the complete mission detail, opened directly from a card.

1. Sticky identity header with initials, title, provider/category, source-backed badges, bookmark, close, and lawful classification as plain text.
2. Compact facts strip: active variants, exact variants, pickup scope, base/solo payout range, and mission-item requirement count.
3. Peer overview surfaces:
   - Main column: briefing and required-item rows.
   - Right rail: reputation, payout, certification buy-in, item rewards, and blueprint rewards.
4. Full-width exact mission comparison.
5. Eligibility and prerequisite-path workspace, replacing the comparison region only while the existing check flow is active.
6. Confidence and unresolved-data footer.

Required-item rows stay compact and preserve proven collect/deliver versus runtime-selected semantics. Blueprint rows retain pool evidence and Blueprint Tracker actions. The modal owns vertical scrolling; long tables keep bounded horizontal scrolling rather than clipping columns.

## Color roles

Replace the current page palette with a restrained page-local system derived from shared tokens:

- Canvas and structural surfaces: graphite/deep navy.
- Interaction, focus, links, selected boundary: cool cyan.
- Reputation scope: controlled source-category accent used on the card rail and reputation badge.
- Verified: green, with label and border.
- Unverified or unresolved evidence: amber, with label and border.
- Blueprint evidence: teal.
- Required items and collect/deliver attention: amber.
- Active/eligible/complete: green.
- Error, invalid, or required CrimeStat: red.
- Missing or unavailable data: neutral/muted, never whole-card opacity.

Avoid generic cyan-plus-violet decoration, repeated glow, rainbow card borders, and independent shadows on repeated rows.

## CSS refactor architecture

Current baseline: 4,220 physical lines, 97 `!important` declarations, 16 media blocks, and 11 distinct breakpoint conditions.

Do not append another recovery layer. Replace the current stylesheet with one entry file and bounded page-local owners:

- `mission-browser.css`: import order and root page-local custom properties only.
- `mission-browser-shell.css`: page identity, filter/results shell, grouping headers, pagination, loading/error/empty states.
- `mission-browser-cards.css`: concept cards, badges, reputation accents, hover/focus/selected states.
- `mission-browser-modal.css`: backdrop, perimeter, sticky header, facts strip, dossier surfaces, required items, rewards, blueprints, footer.
- `mission-browser-workspaces.css`: exact-variant comparison, eligibility, prerequisite paths, technical disclosure.
- `mission-browser-responsive.css`: consolidated compact, desktop, 1440p-density, and wide-screen behavior.

Ownership rules:

- Scope browser selectors under `.mb-page`.
- Scope portal selectors under `.mission-workspace-modal-shell` or `.mission-workspace-modal-backdrop`.
- Prefer single-class component selectors; avoid long descendant chains.
- Use shared tokens first and a small set of page-local semantic custom properties second.
- Goal: zero `!important`; document any unavoidable shared-control exception.
- Delete historical drawer, persistent-workspace, and unused selector families after mapping rendered classes.
- Keep responsive overrides next to one consolidated breakpoint strategy rather than scattered recovery blocks.
- Preserve the shared 1440p density layer; page-local wide rules must come later and be intentionally scoped.

The refactor is accepted only if it is materially smaller and has one clear owner for every rendered class family. Line count is evidence, not the sole objective.

## Responsive behavior

- `768x900`: single-column cards; stacked filter controls; modal becomes an edge-safe single-column workspace; sticky header remains usable; tables scroll horizontally; close and bookmark remain visible.
- `1920x1080`: two-column card grid; modal uses the two-thirds/one-third overview split shown in the concept.
- `2560x1440`: three-column card grid when card minimum width and long titles remain readable; shared density tokens increase type and controls.
- `3840x2160`: up to four cards per row; modal width grows intentionally but retains readable briefing line length and bounded internal regions.

Use CSS grid with an explicit card minimum width rather than width-specific card selectors. Validate long names, many rows, many variants, and overflow at every required viewport.

## Behavior intentionally preserved

- Direct card-to-modal interaction.
- Escape, backdrop, and close-button dismissal.
- Focus restoration and body-scroll lock.
- Readable mission URLs and legacy link repair.
- Search, filters, Full/Faction/Reputation views, pagination, and zero-results recovery.
- Exact-variant sorting and Active/All variants control.
- Valid zero versus missing/unresolved payout.
- Certification buy-in separated from payout.
- Required-item evidence semantics.
- Blueprint reward pools, bookmark identity, and Blueprint Tracker compatibility.
- Server-owned eligibility and prerequisite paths.
- Unknown player state remains unknown.
- Raw GUIDs remain outside normal presentation.

## Implementation sequence after approval

1. Capture a rendered-class inventory from `MissionBrowserPage.tsx` and classify every current selector as active, shared, or historical.
2. Add deterministic populated fixtures for a verified/unverified tag when source-backed, long titles, required items, blueprint pools, zero payout, unresolved payout, and many variants.
3. Build the new page-local stylesheet files without changing behavior or data logic.
4. Update card markup only where needed for the approved hierarchy and badge semantics.
5. Update modal markup only where needed for the approved peer-surface layout, sticky header, facts strip, and internal scrolling.
6. Remove replaced and unused CSS instead of overriding it.
7. Run targeted behavioral tests, then lint and build.
8. Capture and manually inspect populated and empty states at all required viewports.
9. Request final visual approval before staging or committing.

## Validation and acceptance

Run:

```powershell
npm run ui:missions
npm run lint
npm run build
```

Capture deterministic evidence at `768x900`, `1920x1080`, `2560x1440`, and `3840x2160` for:

- Populated browser.
- Zero results.
- Information-rich mission modal.
- Long briefing and long mission title.
- Many exact variants.
- Required items and blueprint rewards.
- Valid zero, missing, unresolved, loading, and error states.
- Eligibility and prerequisite paths.

Completion requires visual approval, materially simpler CSS, no stale drawer ownership, readable type at every viewport, and passing behavioral/build checks.
