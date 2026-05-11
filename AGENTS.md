# ScintelPages Agent Rules

## Prime Directive

Audit first. Patch second.

Do not guess, invent, or rebuild working systems. If a data path, field, function, or state flow is unclear, stop and report what is unclear before editing.

Make the smallest scoped change that fixes the confirmed issue.

## Required Workflow

Before editing code:

1. Trace the current state/data flow.
2. Identify exact files, functions, and props involved.
3. Reuse existing utilities/state where possible.
4. Avoid duplicate logic.
5. Patch only the confirmed issue.
6. Run build/typecheck if available.
7. Report:
   - files changed
   - logic changed
   - risks/unknowns
   - build result

## Scope Control

Do not touch Mining unless explicitly requested.

Do not redesign unrelated pages.

Do not change extraction/data pipelines unless the task specifically asks for it.

Do not create new state stores if existing state already exists.

Do not mutate source recipe data. Queue/build items may be mutable planning snapshots.

## Current Priority Areas

Active focus:
- Crafting Recipe / Recipe Browser
- Builder / Build Queue
- shared crafting utilities only when needed

Not active unless requested:
- Mining page
- global app redesign
- mission tracker systems

## Design Language

Use a compact Scintel industry UI:

- dark graphite / muted navy surfaces
- Rajdhani-first typography
- compact, readable, data-dense layout
- low nesting
- connected drawers/details
- restrained borders
- no random card stacks
- blue is allowed only when muted/tokenized

Avoid:
- loud default web-blue panels
- excessive `!important`
- Orbitron as normal UI text
- heavy monospace except tiny metadata
- nested card soup
- detached floating drawers

## Accent Rules

Use accents consistently:

- green = covered / available / positive
- amber = partial / warning
- red = missing / destructive
- violet = selected / active
- rarity colors = product/material quality only
- blue/navy = neutral/info/readout

Do not let colors lie about meaning.

## Recipe Page Rules

Recipe page must use:

- selected active recipe/variant as source of truth
- selected material quality/band state from existing flow
- connected variant drawers
- compact material quality cards
- `craft-summary-panel` inside a `craft-detail`-style wrapper when relevant

Do not invent new filters.

Sidebar filters should stay scoped to:
- Search
- System
- Mining Type
- FPS
- Armor Weapons
- Vehicles
- Materials
- Blueprint Bookmarks, if implemented

Size, grade, and class stay in item rows, not sidebar filters.

## Final Product Quality

Use simple ingredient average unless a task explicitly says otherwise.

Formula:
- average selected material band numbers across all required ingredients
- no SCU weighting
- no unit weighting
- no required quantity weighting

Display:
- `Band {average}`
- max 2 decimals
- trim trailing zeros
- rarity color comes from final product quality

## Modifier Totals

Modifier totals are separate from final product quality.

Rules:
- calculate per stat
- only include materials that actually modify that stat
- ignore non-contributing materials
- do not scale by final product quality
- only show changed stats

Display:
`Stat Name  deltaFromBase  (modifiedValue)`

Modifier value color:
- higher-is-better: positive green, negative red
- lower-is-better: negative green, positive red
- unknown direction: neutral/readout

Do not color modifier totals by rarity.

## Builder / Build Queue Rules

Builder is a mutable planning page.

Queue items may mutate:
- selected material quality/band
- lower-quality assignments
- reserved amounts
- item-specific modifier values
- final product quality fields

Builder must not mutate:
- original recipe data
- source extraction data
- unrelated queue items

Blueprint sources are read-only metadata.

## Blueprint Sources

Blueprint sources come from `recipe.rewardPools`.

Use GUIDs:
- `blueprint_id`
- `blueprintGuid`
- `poolGuid`

Do not key by display name or item name.

Builder should display blueprint sources from the queue item snapshot.

This is not a mission tracker.

Never add:
- mission completion state
- progress tracking
- checklist state
- active mission state
- route/run tracking
- timers

Use labels like:
- Blueprint Source
- Blueprint Sources
- Unknown Blueprint Source

Avoid:
- Mission Tracker

## FPS Blueprint Sources

FPS blueprints should use the same reward pool model as vehicle blueprints when GUID matches exist.

Do not invent a separate FPS source model unless explicitly approved.

If FPS `rewardPools` are empty, first check normalization/join logic before assuming data is missing.

## Data / Naming Rules

Do not use `q` prefixes in:
- labels
- ids
- CSS classes
- data keys
- quality band names

Use clean numeric/range naming.

Preserve existing data shapes unless the task explicitly requires a payload change.

## CSS Rules

Before adding CSS:

1. Search existing selectors.
2. Check for duplicates/conflicts.
3. Reuse tokens/classes where possible.
4. Consolidate instead of piling overrides.
5. Avoid random `!important`.

CSS should clarify hierarchy, not fight the DOM.

## Reporting Format

After work, report briefly:

- changed files
- what changed
- what was reused
- what was not touched
- build/typecheck result
- risks or follow-up needed