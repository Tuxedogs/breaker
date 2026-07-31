# Mission Stage 4 Browser and Dossier Progress

Date: 2026-07-30
Accepted mission generation: `b42621a47bf58653e0ec17c3`

## Implemented slice

The first Stage 4 slice connects the existing Mission Browser dossier to the
accepted exact-variant detail shards.

- Resolved calculated rewards display Scintel's persisted `baseSoloAmount`.
- A valid calculated zero remains a reported zero rather than becoming missing.
- Certification buy-ins load from canonical financials and remain separate from
  the base/solo payout.
- Multiple calculated-result branches retain their verification warning and are
  not summed in React.
- Exact required-item evidence is loaded only for the selected variant.
- Source-backed hauling orders are distinguished from mission-item selectors
  whose turn-in role is not proven.
- Unresolved item definitions remain explicitly unresolved.
- The browser now has a clear zero-results state and a one-action filter reset.

The existing URL state, concept grouping, lazy family shards, modal focus
behavior, bookmarks, Blueprint Tracker joins, and solver behavior are unchanged.

## Exact-variant browser slice

Mission concept cards now select a persistent workspace before opening the
dossier.

- Selection is URL-addressable through `selected=<conceptKey>`.
- Existing `concept=<conceptKey>` dossier deep links remain valid.
- Exact variant shards still load lazily only for the selected concept.
- The selected hero reports active and total exact variants, pickup-scope count,
  source-backed base/solo range, and required-item coverage.
- The dense comparison table preserves exact variants as rows.
- Mission, pickup, tier, standing, and payout columns are sortable.
- Missing payouts sort separately from valid numeric zero.
- The default view includes active variants only.
- Authored not-for-release and work-in-progress records remain inspectable
  through the explicit **All variants** control.
- The 207-variant hauling stress concept remains bounded inside its own scrolling
  table rather than expanding the page.
- The dossier remains a separate action and peer surface.

## Measured Stage 4 decisions

The current generation contains 2,501 exact variants, of which 1,758 are active
by canonical release flags. Exact variants are the comparison and solver grain.

The first permanent browser filters should be:

1. Release availability, defaulting to active
2. Provider/faction
3. Display category
4. Pickup system with source status
5. Typed reward presence
6. Required-item presence
7. Player-aware eligibility after solver evaluation

Current generated facet counts mix family, concept, and variant grains. They
must not be presented as comparable mission counts. Reputation-scope,
archetype, legality, and technical mission type remain secondary until their
labels or coverage improve.

## Remaining Stage 4 work

- Add source-backed reputation and location identity inputs when runtime player
  state can provide them without raw-ID entry.
- Add completion-history import rather than relying on manual empty-history
  declarations.
- Add path-solving visualization after exact eligibility is accepted.
- Resolve concept bookmark compatibility with exact mission and blueprint-pool
  identities without silently changing the shared storage key.
- Add targeted Mission Browser interaction tests and deterministic loading/error
  fixtures.
- Complete the compact, 1080p, 2K, and 4K visual matrix for the final hierarchy.

## Validation for this slice

- `npm run missions:test` — 30 passed
- `npm run ui:missions` — 7 passed
- `npm run lint` — passed
- `npm run build` — passed
- Required-item dossier reviewed at 768×900, 1920×1080, 2560×1440, and 3840×2160
- Certification buy-in dossier reviewed at 1920×1080
- Zero-results state reviewed at 1920×1080
- Exact-variant workspace reviewed at 768×900, 1920×1080, and 2560×1440

Local visual routes:

- `/industry/missions?concept=70d0a94a8a837e887b3c`
- `/industry/missions?concept=1cf7b7218006719074f0`
- `/industry/missions?search=__no_mission_matches__`
- `/industry/missions?selected=9cab64c0aa3664d21d3c`

## Eligibility integration slice

Exact eligibility is now evaluated on the server through:

`POST /api/missions/variant/:variantId/eligibility`

The route validates the player-state payload, loads the accepted canonical
variant, applies published standing thresholds, and returns the mission
generation ID with every result. Client requests cannot replace the published
standing-threshold map.

The first player-facing workspace supports:

- Known or unknown CrimeStat
- Complete or partial contract-history knowledge
- Complete or partial completion-tag knowledge
- Full eligibility explanations from the Stage 3 service

Reputation and location are deliberately sent as unknown in this first slice.
The UI does not ask users to enter raw faction, standing, scope, or location IDs,
and unknown state is never treated as satisfied.
