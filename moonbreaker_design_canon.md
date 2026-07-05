Bring Crafting Detail page in line with the updated Moonbreaker visual system.

Use 5.4 Medium.

Scope:
Crafting/Recipe/Component Detail page visual and layout refactor only.

Do not change:
- Crafting data
- Crafting calculations
- Material modifier math
- Quality calculation logic
- Blueprint source logic
- Add to Queue behavior
- Save Blueprint behavior
- Search/filter behavior
- API calls
- Fitting API
- Inventory
- Build Queue
- Mining
- Missions

Problem:
The crafting detail page looks visually behind the rest of the site. It still feels like an older dense admin/debug layout, while Mining, Inventory, Build Queue, and Material Allocation now use a more polished sci-fi panel system.

Current issues:
- Header has excessive empty space.
- Item identity card on the left feels disconnected and small.
- Detail header does not use the newer hero/card language.
- Item Summary and Crafting Overview feel like raw tables in boxes.
- Material Requirements sliders are useful but visually dated.
- Estimated Effects are important but too flat.
- Blueprint Sources section needs to align with the newer card system.
- The page lacks a strong information hierarchy.

Goal:
Refactor the crafting detail page so it feels visually aligned with the rest of Moonbreaker while preserving all current behavior and data.

Use shared visual language:
- deep blue/black panels
- rounded cards
- subtle borders
- cyan/purple/amber accents
- compact badges
- clear hierarchy
- readable stat tables
- no giant empty voids

Use these visual tokens where practical:
--panel-bg: #04131D;
--panel-bg-deep: #03121C;
--panel-row-bg: #051A28;
--panel-row-hover: #081E2C;
--panel-border: #0E2A36;
--panel-border-soft: rgba(65, 132, 160, 0.22);
--accent-cyan: #00E6D2;
--accent-blue: #4DA3FF;
--accent-purple: #B85CF6;
--warning: #FFB84D;
--danger: #FF5C5C;
--success: #22D37A;
--text-primary: #E6F2FF;
--text-secondary: #8FA3B8;
--text-muted: #5F7285;

Page layout target:
Keep the page detail-oriented, but reorganize visually into:

1. Compact item hero/header
2. Main two-column detail area
3. Blueprint/source section below

Recommended desktop layout:

Top detail hero:
- Left: item icon/card
- Center: item title, category path, quality badge, size/grade badges, description
- Right: Save Blueprint and Add to Queue actions

Main content grid:
Left column:
- Item Summary / Performance stats

Right column:
- Crafting Overview
- Material Requirements
- Estimated Effects

Bottom:
- Blueprint Sources

Hero/header:
The current top section is too empty.

Replace with a compact hero panel:
- Height should be content-driven, not a huge blank area.
- Item icon/card should be larger and integrated into the hero.
- Item name should be prominent.
- Category path should be smaller and muted.
- Quality badge should remain visible.
- Size and grade badges should remain.
- Description should remain, but line length should be constrained.
- Save Blueprint / Add to Queue should sit cleanly on the right.

Example hierarchy:
vehicle / Ship Weapon / weaponGun
ATTRITION-2 REPEATER
[3.67 QUALITY] [S2] [GRADE A]
Description text...

Actions:
[Save Blueprint] [Add to Queue]

Item identity card:
Do not leave the item card as a tiny isolated block.
Integrate it into the hero.

The item visual card should:
- use the same deep panel styling
- have stronger border/radius
- show category and item name
- show quality chip
- not feel like an old sidebar widget

Main content:
Use a balanced two-column layout.

Suggested:
.detail-grid {
  display: grid;
  grid-template-columns: minmax(360px, 0.85fr) minmax(620px, 1.4fr);
  gap: 16px;
}

Left:
Item Summary / Weapon Performance

Right:
Crafting Overview + Material Requirements + Estimated Effects

At 2K:
- Max content width around 2200-2320px.
- Do not stretch tables into huge gaps.
- Keep readable line lengths.

At 1440p:
- Layout must fit without horizontal overflow.

Item Summary:
Keep all current rows and values.
Restyle into a cleaner stat panel.

Requirements:
- Section title: Item Summary
- Subsection title if needed: Weapon Performance
- Rows remain compact.
- Labels muted.
- Values right-aligned.
- Positive deltas green/cyan.
- Use tabular numbers.
- Do not remove stats.

Crafting Overview:
The Crafting Overview panel should feel like a modern summary card, not a flat table.

Top summary cards:
- Craft Time
- Resulting Quality
- Materials Required

Use compact cards in a row.
Each card:
- label
- primary value
- optional secondary text if already available

Material Requirements:
This is the most important interactive part of the page. Keep it clear.

Each material row should show:
- material role, e.g. Reinforced Frame / Emitter / Thermal Sink
- material name
- required amount
- quality band / quality value
- input slider
- resulting effect

Improve row layout:
- stronger material name hierarchy
- role label small/muted
- quality badge compact
- input slider aligned
- effect chip clearly visible on the right

Do not change slider behavior.
Do not change modifier math.
Do not relabel effects unless existing labels are wrong.

Material row visual:
- row background subtly different from panel
- separators quiet
- effect chips use semantic colors:
  - damage / performance effect: cyan or purple
  - health / HP effect: green/cyan
  - warning/negative: amber/red if applicable

Estimated Effects:
Make this feel like a result panel.

Each effect row should show:
- stat label
- final value
- percent change
- absolute delta
- source materials contributing to the effect

Keep the existing data exactly.

Improve readability:
- final value prominent
- percent/delta grouped together
- contributing material names muted but visible
- rows should not feel like raw text strings

Example:
Weapon Damage
55.48   +0.9% / +0.48
Hadante +0.3% · Pressurized Ice +0.6%

Blueprint Sources:
Bring this in line with the updated page design.

Use card/list styling:
- source title
- mission/source metadata
- any availability/confidence info
- bookmark/save state if already present

Do not change blueprint source logic.

Buttons:
Save Blueprint and Add to Queue should match current app button system.

Add to Queue:
- Primary amber/gold button.
- Strong but not oversized.

Save Blueprint:
- Secondary/ghost button.
- Clear hover/focus state.

Spacing:
Reduce excessive empty top/header space.
Use consistent 12-16px gaps.
Panels should feel connected but not cramped.
No giant blank regions.

Responsive:
Desktop:
- Two-column detail grid.

Tablet:
- Keep two columns if possible around 900px+.
- Collapse to single column only when necessary.

Mobile:
- Stack:
  1. Hero
  2. Crafting Overview
  3. Material Requirements
  4. Estimated Effects
  5. Item Summary
  6. Blueprint Sources

Do not make mobile worse in this pass.

Important guardrails:
- Do not touch calculation code.
- Do not rename Deadbolt/weapon modifier labels in this pass.
- Do not “fix” modifier effects.
- Do not change material requirement values.
- Do not change quality sliders/input behavior.
- Do not change Add to Queue payloads.
- Do not change Save Blueprint behavior.

Acceptance criteria:
- Crafting detail page visually aligns with Mining/Inventory/Build Queue.
- Header/hero no longer has excessive empty space.
- Item identity is stronger and integrated.
- Item Summary is readable and polished.
- Crafting Overview feels modern.
- Material Requirements are clearer without changing behavior.
- Estimated Effects are easier to scan.
- Blueprint Sources section is visually aligned.
- No data/API/calculation behavior changes.
- npm run build passes.