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

- Add the active exact-variant comparison workspace and selected hero.
- Expose Stage 3 eligibility through a server route and typed browser adapter.
- Add the player-state editor and one-variant eligibility evaluation.
- Resolve concept bookmark compatibility with exact mission and blueprint-pool
  identities without silently changing the shared storage key.
- Add targeted Mission Browser interaction tests and deterministic loading/error
  fixtures.
- Complete the compact, 1080p, 2K, and 4K visual matrix for the final hierarchy.

## Validation for this slice

- `npm run missions:test` — 29 passed
- `npm run ui:missions` — 4 passed
- `npm run lint` — passed
- `npm run build` — passed
- Required-item dossier reviewed at 768×900, 1920×1080, 2560×1440, and 3840×2160
- Certification buy-in dossier reviewed at 1920×1080
- Zero-results state reviewed at 1920×1080

Local visual routes:

- `/industry/missions?concept=70d0a94a8a837e887b3c`
- `/industry/missions?concept=1cf7b7218006719074f0`
- `/industry/missions?search=__no_mission_matches__`
