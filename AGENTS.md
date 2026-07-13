# Moonbreaker Agent Instructions

You are working on Moonbreaker / Scintel.

## Repository Locations

* Main UI repository: `D:/Moonbreaker`
* Extraction and source-data repository: `D:/scintel`
* Clean fitting worktree, when explicitly requested: `D:/Moonbreaker-push-clean`

Do not assume work should occur in the clean fitting worktree. Use the repository named in the task.

## Working Style

* Prefer small, isolated changes.
* Do not blindly follow a proposed solution when it harms usability, maintainability, or correctness.
* Explain important tradeoffs and recommend a better direction when appropriate.
* Do not expand a narrow task into a full-page or cross-system refactor.
* Do not make unrelated cleanup changes.
* Preserve existing behavior unless the task explicitly requests behavior changes.

## Scope Safety

Visual and layout tasks must not change:

* APIs
* Database behavior
* Authentication
* Routing
* Crafting calculations
* Fitting calculations
* Mining calculations
* Material modifier calculations
* Inventory totals
* Reservation logic
* Allocation logic
* Solver behavior
* Production data contracts

If a requested visual feature needs data that does not currently exist:

1. Verify whether the value already exists elsewhere.
2. Reuse the existing source of truth when available.
3. Otherwise document the missing data requirement.
4. Use a deterministic development-only fixture for visual review when appropriate.
5. Do not invent production calculations inside a UI component.

## Data Truth

Do not infer or relabel gameplay data from frontend assumptions.

Modifier, component, crafting, and fitting truth must come from the extracted or server-provided data paths.

Do not duplicate calculations in presentation components when a shared calculation or solver already exists.

## Quality Formatting

Never place the letter `Q` before or after a quality value.

Forbidden:

* `Q965`
* `965Q`
* `Q 965`
* `965 Q`

Required:

* `Quality 965`
* `Target 924`
* `Projected 911`
* `Minimum Quality 965`
* `0.42 SCU at Quality 965`

This rule applies to:

* Production UI
* Development fixtures
* Tests
* Screenshots
* Mockups
* Reports
* Documentation
* Agent-written examples

## Inventory and Crafting Terminology

Inventory records should be presented as physical boxes when each record represents a discrete container.

Do not expose backend terminology such as `stack` unless the UI is intentionally showing an aggregate rather than a physical box.

For location-based inventory, the default organizational model is:

`Location → Material → Individual Boxes`

Other workflows may use a different order when the user’s task requires it:

* Inventory: location first
* Build Queue allocation: craft requirement first
* Reserve selection: material requirement first
* Pull instructions: location and retrieval order first

Do not force one grouping model onto every workflow.

Location names must be understandable to users.

Never expose raw location UUIDs in normal UI.

Use:

* Joined location name when available
* `Unknown Location` when a location ID exists but its record cannot be resolved
* `Unassigned Stock` when no location is assigned

## Physical Box Information

Where relevant, an individual box should clearly communicate:

* Material
* Quality
* Quantity or SCU
* Location
* Availability
* Reservation state
* Owning craft when reserved
* Pull or warehouse state
* Consumption order
* Expected remainder or refund

Do not turn every individual box into a large feature card.

Use compact rows or tiles optimized for scanning and comparison.

States such as available, selected, reserved, unavailable, missing, and completed must not rely on color alone.

## Visual Direction

The product should feel like a dark, premium spacecraft operations interface:

* Dense but readable
* Practical rather than ornamental
* Strong information hierarchy
* Controlled surface depth
* Quiet borders
* Restrained glow
* Compact controls
* No giant empty voids
* No decorative effects that interfere with data

The global color, card, border, and highlight system is currently being audited.

Do not treat the current Dashboard palette or the blue, teal, and purple page family as the final global standard until that audit is approved.

Detailed page and design guidance belongs in the Moonbreaker design canon rather than being duplicated here.

## UI Implementation Rules

For visual work:

* State the exact page and component scope.
* Preserve all behavior and calculations.
* Use existing shared tokens and components where appropriate.
* Do not create a new global primitive for a single-page experiment.
* Do not spread page-local styling into unrelated pages.
* Check both populated and empty states.
* Check long names, many rows, and overflow behavior.
* Avoid hiding important data merely to simplify layout.

For responsive work, inspect at minimum:

* `1920×1080`
* `2560×1440`

Check mobile when the affected component already supports mobile or when the task explicitly requests it.

## Visual Validation

Tests and builds are not sufficient validation for UI work.

Visual changes require:

* A deterministic populated state or fixture
* Screenshot review at the requested resolutions
* Manual inspection of hierarchy, overflow, clipping, contrast, and density

Do not claim a visual task is complete solely because the build passes.

## Validation

Run the checks relevant to the changed area.

At minimum:

```bash
npm run build
```

Also run targeted tests when the changed code has an existing test suite.

Report:

* Files changed
* Behavior changed
* Behavior intentionally preserved
* Tests run
* Build result
* Screenshot or fixture route used
* Any unresolved visual or data limitations

## Stop Conditions

Stop when the requested scope is complete.

Do not continue into:

* Global theme implementation
* Unrelated page cleanup
* Architecture migration
* API redesign
* Calculation changes
* Additional speculative features unless the task explicitly requests them.
