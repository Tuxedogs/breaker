## Crafting Detail Canon

Crafting Detail is the primary decision page between discovering an item and committing it to the Build Queue.

It must help the user understand:

* What the item is
* What its current and resulting performance will be
* Which materials are required
* How material quality affects the result
* What target the user is pursuing
* Whether that target is achievable
* What blueprint sources are available
* What will be carried into Build Queue

The page must preserve all crafting data, calculations, modifier logic, slider behavior, blueprint-source behavior, Save Blueprint behavior, and Add to Queue behavior.

### Visual-System Status

Crafting Detail must follow the approved Moonbreaker visual system produced by the cross-page theme audit.

Do not independently style it toward Dashboard, Fitting Mockup, Mining, Inventory, Build Queue, or Carrier Logistics until the global surface, card, accent, and typography system has been approved.

Page-specific identity may come from item artwork, category information, semantic effects, and crafting data. It should not use a separate base theme.

### Page Structure

Crafting Detail should use three primary regions:

1. Compact item identity and action header
2. Crafting and performance detail area
3. Blueprint Sources

The page should remain detail-oriented without feeling like an admin or debug interface.

Avoid:

* Giant empty hero areas
* Detached identity cards
* Raw tables placed inside generic boxes
* Excessive nested cards
* Decorative effects behind dense data
* Stretching rows across excessive horizontal space

### Item Identity

The item identity area should clearly present:

* Item visual or icon
* Item name
* Category path
* Description
* Quality
* Size
* Grade
* Save Blueprint
* Add to Queue

The item visual should be integrated into the header rather than appearing as a small disconnected sidebar widget.

The header should be content-driven and compact.

Save Blueprint remains a secondary action.

Add to Queue remains the primary action.

### Item Summary and Performance

Preserve all existing stats and values.

Stat presentation should use:

* Clear grouping
* Muted labels
* Strong values
* Right-aligned or consistently aligned numbers
* Tabular numerals
* Compact rows
* Semantic delta treatment

Do not remove important stats merely to simplify the layout.

A numerically positive change is not automatically beneficial, and a numerically negative change is not automatically harmful. Styling must follow the semantic effect of the stat.

### Crafting Overview

Crafting Overview should summarize existing information such as:

* Craft time
* Resulting or projected quality
* Material requirements
* Current target
* Craft quantity where applicable

Summary values should remain compact.

Do not turn every summary value into a large dashboard card.

### Material Requirements

Material Requirements is the primary interactive section of the page.

Preserve:

* Material roles
* Material names
* Required quantities
* Selected qualities
* Sliders and inputs
* Existing material effects
* Existing modifier calculations

Each material entry should make it easy to identify:

* Material role
* Material name
* Required amount
* Selected quality
* Input control
* Resulting effect
* Relationship to the selected target where supported

Do not duplicate crafting, solver, allocation, or quality calculations inside presentation components.

### Target and Min to Target

Where the existing source of truth supports it, the page should communicate:

* Target
* Projected quality
* Minimum Quality for Remaining Quantity
* Minimum Quantity at a Selected Quality
* Target Met
* Target Unavailable With Current Inventory
* Best achievable projected quality

Preferred language includes:

* Target 924
* Projected 911
* Min to Target
* 0.42 SCU at Quality 965
* Target Met
* Target Unavailable With Current Inventory

Never place the letter Q before or after a quality value.

If Min to Target values do not already exist in shared crafting, allocation, Auto Reserve, or solver logic:

* Do not recreate the calculation in the UI.
* Document the missing data requirement.
* Use deterministic development fixtures only for visual review.
* Do not expose invented values in production.

### Estimated Effects

Estimated Effects should clearly communicate:

* Stat affected
* Final value
* Percentage change
* Absolute delta
* Contributing materials

Preserve all existing values and source-material relationships.

Contributing materials should remain visible without becoming an undifferentiated text block.

Effect styling must reflect whether the result is beneficial, detrimental, neutral, or unavailable.

### Blueprint Sources

Blueprint Sources should remain a distinct lower section.

Preserve:

* Source title
* Mission or acquisition metadata
* Availability information
* Confidence information where present
* Existing save or bookmark state
* Existing blueprint-source logic

Sources should use compact, readable rows or cards.

Do not turn every source into a large feature card.

### Crafting-Flow Continuity

Terminology and visual meaning must remain consistent between:

* Crafting Detail
* Build Queue
* Material Allocation
* Inventory
* Reserve selection
* Pull instructions

The user should recognize the same:

* Item
* Target
* Projected result
* Material
* Quality
* Quantity
* Effect
* Reservation state

after moving from Crafting Detail into Build Queue.

Do not expose backend terminology such as `stack` when the user is interacting with a physical inventory box.

Do not expose raw location identifiers.

### Responsive Order

Desktop should balance performance information with interactive crafting controls without excessive horizontal spread.

Mobile should prioritize the crafting decision flow:

1. Item identity and actions
2. Crafting Overview
3. Material Requirements
4. Estimated Effects
5. Item Summary and performance
6. Blueprint Sources

Do not remove important information merely to simplify mobile layout.

### Implementation Guardrails

Visual Crafting Detail work must not change:

* Crafting data
* Crafting calculations
* Material modifier math
* Quality calculations
* Blueprint-source logic
* Add to Queue behavior or payloads
* Save Blueprint behavior
* API calls
* Fitting behavior
* Inventory behavior
* Build Queue behavior
* Reservation or allocation behavior

Visual work requires deterministic populated data, screenshot review at 1920×1080 and 2560×1440, and a passing production build.
