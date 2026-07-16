# Agent 3 — Direction B Colorful Page Family Review

## Scope and method

Investigation only. I inspected the route wrappers, component markup, and effective page-scoped CSS for Mission Browser, Blueprint Tracker, Mining, Build Queue, and Carrier Logistics. No application code, data, state, routing, or Mining implementation was changed. This report is based on source evidence; I did not obtain a reliable comparable screenshot set in this pass, so viewport observations are inferred only where explicit responsive/2K CSS exists.

## Executive finding

Direction B is a family by product function, not yet by visual system. It contains at least three visibly different dialects:

1. Mission Browser and Build Queue: deep navy surfaces with teal/cyan interaction, violet selection, and several semantic colors.
2. Blueprint Tracker: amber-led charcoal at the top of the file, partially restyled by a later navy/teal/amber preference-tracker layer.
3. Carrier Logistics: charcoal gradient panels with amber controls and multicolor cargo semantics.

Mining bridges the first and second dialects but also exposes the inconsistency most clearly: its legacy variables declare teal/violet semantics, while its current v2 active filter combines cyan and violet in the same selected fill. The family therefore has useful page-specific accents, but cannot serve unchanged as a global foundation. Its strongest transferable qualities are operational density, compact controls, semantic cargo/status color, and selected states that often use more than hue. Its weakest qualities are fragmented token ownership, too many near-black surface recipes, undersized/faint metadata, and inconsistent accent roles.

## Route and style evidence

| Page | Route wrapper/component | Primary style evidence |
|---|---|---|
| Mission Browser | `src/pages/industry/MissionBrowserPage.tsx` | `src/pages/industry/mission-browser.css`, shared `src/styles/scintel-filter-shell.css` |
| Blueprint Tracker | `src/pages/industry/BlueprintTrackerPage.tsx` → `src/components/industry/crafting/BlueprintTrackerPage.tsx` | `src/components/industry/crafting/blueprint-tracker.css` |
| Mining | `src/pages/industry/MiningPage.tsx` → `src/components/industry/mining/MiningPage.tsx` | `src/components/industry/mining/mining.css`, shared `src/styles/scintel-filter-shell.css` |
| Build Queue | `src/pages/logistics/BuildQueuePage.tsx` | `src/components/logistics/build-queue.css`, `src/components/logistics/logistics.css` |
| Carrier Logistics | `src/pages/logistics/CarrierLogisticsPage.tsx` → `CarrierLogisticsPanel`/`CarrierCargoRooms` | `src/components/logistics/carrier-logistics.css`, `src/components/logistics/logistics.css` |

## Page reviews

### Mission Browser

**Canvas and surfaces.** `.mb-page` hard-codes a flat `#03121c` canvas (`--mb-panel-3`) with panels `#04131d`, `#051a28`, and another `#03121c`. These luminance steps are small, so depth depends heavily on borders and local gradients. `.mb-family-row` uses a violet-tinted horizontal gradient and `.mission-group-card__rail`/path headers introduce colored rails; this provides identity, but nested lanes, cards, and dossier sections can collapse into one dark mass when the very quiet `rgba(65,132,160,.14)` border is the only separator.

**Accent behavior.** The root declares green, amber, red, violet, teal, and blue. Reputation-path colors are meaningfully categorical, while violet is broadly used for titles/selection and teal/blue appear in supporting states. The key competition occurs in selected variants: `.mission-dossier-variant-row.is-selected` uses a violet-to-teal background plus a blue inset outline. That is three accent families for one state, decorative rather than semantic. `.mission-dossier-tabs button.is-active` is better: a fill/text change plus an inset violet underline.

**Hierarchy and readability.** The dense browse grouping is structurally strong: filter shell → group header → category/path lane → concept cards → modal dossier. However, the CSS itself acknowledges undersizing: the 2K media query says many rules are locked at `11–13px !important` and explicitly bumps them. This is evidence that typography scaling is reactive rather than systemic. `--mb-subtle: #7a8fa3` and numerous small uppercase labels are at risk of fading against `#03121c`, though exact contrast should be measured by the accessibility agent.

**Preserve.** Reputation-path identity rails and badges; the connected lane/card/dossier hierarchy; muted violet as selected/active; semantic green/amber/red. Simplify selected rows to one interaction accent plus one structural cue.

### Blueprint Tracker

**Canvas and surfaces.** The opening `.bt-page` system is charcoal: `#10161a`, `#151b20`, `#0c1114`, warm primary text `#f1ecdf`, amber `#f59e0b`, and teal `#43ffd0`. It has clear panel steps and restrained 2–4px radii. Later in the same file, `.bt-preference-tracker` rebinds `--bt-panel` to a navy gradient and adds multiple navy gradient recipes (`rgba(10,18,30,...)`, `rgba(14,25,38,...)`, etc.). This creates internal theme layering and makes final appearance dependent on selector order/specificity.

**Accent behavior.** Amber is mostly semantic as section identity, disclosure rail, focus, and tracked-source emphasis. Teal is used for expanded/available controls and search focus; violet marks selected mission rows (`.bt-mission-entry.is-selected .bt-mission-main`). This is mostly disciplined because roles differ, but the page-level visual identity can flip between amber-charcoal and navy-teal depending on subview. `.bt-tab:hover, .bt-tab.is-active` initially share the same fill, with only the active inset line distinguishing them; the later preference-tracker rule improves active specificity but still makes hover and selected close.

**Borders/glow.** Default borders are quiet (`rgba(184,194,204,.12)` and `.07`). Amber left rails on faction headers and mission states are effective, non-glow hierarchy cues. Most shadows are restrained; the detail overlay’s `0 18px 56px rgba(0,0,0,.7)` is appropriate for modal separation. Card hover adding an amber inset rail is potentially selection-like if selection also uses a rail.

**Preserve.** Warm off-white primary text, amber section rails, compact low-radius rows, explicit focus outline, and the strong accordion/list hierarchy. Consolidate the two token generations before treating this as a reference page.

### Mining

**Canvas and surfaces.** Mining inherits global void navy variables (`--sc-bg-0..3`) but also hard-codes many translucent blacks/navies. `.msb-sidebar` contains duplicate declarations (two backgrounds/borders and repeated padding rules in `.msb-section`), direct evidence of accumulated overrides. The v2 area introduces additional gradients and panels, creating more surface recipes than the hierarchy needs.

**Accent behavior.** Legacy selected chips are disciplined violet (`.msb-chip--active` fill + border + text). Current v2 filter selection is not: `.mine-page--v2 .mining-filter-chip.is-active` combines cyan and violet in one gradient, with cyan inset border and violet glow. It makes a routine filter look unusually energized and uses both hues decoratively. Method/tier-specific active rules then add more colors, which can be semantic if they consistently encode mining method/tier, but compete when shown together. `.mining-scope-button--active` uses purple underline plus state styling and is clearer.

**Hierarchy/readability.** The page is operationally dense and its system/list/detail structure scales well, but `0.48rem`, `0.52rem`, and low-alpha labels (`rgba(169,186,208,.55/.62)`) are too fragile for long sessions. At 1080p the density is useful but risks becoming cramped; at 2K there are explicit readability accommodations elsewhere in the stylesheet, yet the volume of fixed rem values makes consistency uncertain. Selected location rows (`.mine-page--v2 .mlist-item...`) use fill, border/inset, and presumably markup state, which is stronger than glow alone.

**Preserve.** Method/tier colors only if a legend/label makes their meaning explicit; teal for positive route/resource emphasis; violet for selection; dense system/list/detail composition. Reject the cyan-violet gradient as the generic active-filter treatment.

### Build Queue

**Canvas and surfaces.** `.bq-page` has the clearest explicit navy hierarchy in this family: gutter `#010a12`, deep card `#03121c`, panel `#04131d`, row `#051a28`, hover `#081e2c`. The three-column layout and distinct queue/center/summary regions read as an operations console. However, it duplicates essentially the same tokens under `--mb-*`, `--alloc-*`, `--panel-*`, and `--bq-*`, which invites drift. Some top-level panels use `#04131d`, while others retain charcoal gradients `#181d21 → #101417`, so the page is not fully unified internally.

**Accent behavior.** Teal/cyan is the primary interaction color and green is aliased to the same teal (`--bq-green: #4db8b0`), which weakens semantic separation between action and success. Violet is used for allocation ownership/lower-quality relationships, amber for warnings/auto-reserve emphasis, red for danger, and rarity glow for product quality. Those latter roles are appropriate. `.bq-craft-card.is-selected` uses a full teal border, darker selected fill, and restrained outer/inset treatment—one of the strongest selected states in Direction B. `.bq-queue-tab.is-active` also combines fill, outline-like shadow, and count treatment.

**Borders/glow.** Routine panels have substantial drop shadows and many later selectors add text/box glows. Most are low alpha, but their cumulative count risks making many elements feel active. The auto-reserve amber gradient/glow and rarity text glows should remain exceptional. Default borders at `.14–.16` alpha are quiet but usable when adjacent surfaces differ; where adjacent panels share `#04131d`, nesting becomes border-dependent.

**Preserve.** The gutter/panel/row/hover luminance ladder, three-column terminal layout, selected craft-card treatment, tab state, violet allocation-ownership cue, and semantic warning/danger/rarity treatments. Separate success green from interaction teal and remove duplicated token aliases.

### Carrier Logistics

**Canvas and surfaces.** Carrier uses the shared `.logi-page` canvas (`background: var(--bg-app)`) and header, then a compact grid of `.clog-panel` charcoal gradients (`#181d21 → #101417`) with `rgba(255,255,255,.07)` borders and 6px radius. Nested room/capability/summary cards use translucent white fills around `.025–.03` and borders `.06–.08`. The silhouette, restrained radius, and warm panel gradient are premium and practical. Surface nesting is conceptually clear, but the luminance difference between panel and nested cards is slight enough that the faint borders carry too much load.

**What should be preserved.**

- The top-row carrier-controls + expanding cargo-rooms composition and bottom-row loadout + capability composition (`.clog-top-row`, `.clog-bottom-row`). It maps operational priority cleanly.
- The amber identity used for panel titles, capacity, active toggles, focus, and decisive quick actions. It feels like a ship terminal and is more restrained than broad cyan/purple glow.
- Cargo resource colors in `.clog-legend-swatch-*`, `.clog-loadout-swatch-*`, and `.clog-crate-chip-*`. These colors encode resource categories, not generic decoration, and should survive unification.
- Segmented cargo visualization (`.clog-room-bar-seg`, `.clog-room-grid`, `.clog-room-cell`) and tabular numeric treatment.
- Semantic status overrides: green OK, amber loaded/full/warn, red overflow/danger.
- Compact 4–6px radii and restrained panel shadow (`0 4px 14px rgba(0,0,0,.3)`).

**Carrier readability diagnosis.** The primary problem is typography/color, followed by density; spacing is generally coherent.

- Color/contrast: many labels use `rgba(160,180,220,.28–.45)` on very dark backgrounds: `.clog-field-label` `.4`, `.clog-override-label` `.42`, `.clog-cap-bar-total` `.35`, `.clog-inline-card-label` `.35`, `.clog-room-capacity` `.32`, `.clog-room-stat-label` `.28`, `.clog-capability-desc` `.35`, `.clog-cap-row-label` `.4`, `.clog-cap-row-sublabel` `.28`. These are intentionally muted beyond comfortable metadata contrast.
- Typography: metadata is frequently `0.49–0.63rem`, often uppercase with wide tracking. `.clog-room-stat-label` at `.49rem` and `.clog-inline-card-label` at `.52rem` are especially fragile. The shared `.logi-breadcrumb` is `.58rem`; the page title is only `1.1rem`, giving the page a weak entry hierarchy.
- Density: the 200px control strip, 380px capability rail, three-column loadout rows, sliders, quick actions, and crate chips pack many targets into a small vertical rhythm. This is useful density, but tiny text is being used to make it fit. The 2K media query widens columns to 220px/420px but does not shown here a systematic type-size lift, so 2560×1440 may create more breathing room without fixing faint labels.
- Spacing: panel padding `.7rem .8rem`, room gaps `.5rem`, and row padding `.42rem` are consistent and not the root issue. Increasing all spacing would dilute the operational strength. Raise label sizes/contrast first, then selectively widen controls.
- State clarity: `.clog-toggle-btn--active` has fill + border + text color, which is sound. Focus on `.clog-select` and `.clog-number-input` is border-color only and uses `rgba(255,153,0,.4)`, likely too quiet for a robust focus indicator. Sliders rely heavily on the amber thumb without a dedicated focus-visible rule.

**Direction decision for Carrier.** Carrier should influence the unified system through its amber terminal accent, compact silhouettes, cargo semantics, and operational composition. It should inherit a stronger shared navy/charcoal canvas and shared text/border tokens rather than be wholesale restyled into Dashboard decoration. Its information architecture is worth preserving; its low-alpha blue-grey typography is not.

## Cross-family findings

### Are blue, teal, and purple semantic or decorative?

- **Teal:** mostly interaction/availability in Build Queue and Blueprint Tracker, and positive/resource emphasis in Mining. This is close to a coherent role, except Build Queue aliases green to teal.
- **Purple/violet:** mostly selected/active and relationship/ownership. This is the best candidate for a consistent selected-state role. It becomes decorative when paired with cyan gradients/glows on Mining filters and Mission selected variants.
- **Blue/cyan:** often neutral/info or category/method encoding, but sometimes serves as a third selected-state outline. It should not be layered on top of violet and teal for the same selection.
- **Amber:** strong page identity/action in Blueprint Tracker and Carrier; warnings/actions in Build Queue; focus in Mission/Mining. It is valuable but currently spans identity, focus, warning, and action.

### Do borders and glows make too many elements active?

Carrier and the initial Blueprint Tracker rules are restrained. Build Queue has many low-alpha glows across selected cards, actions, modals, rarity values, status dots, and allocation ownership; individually modest, cumulatively busy. Mining v2’s cyan-violet selected chip is the clearest over-energized routine state. Mission Browser uses fewer broad glows but stacks multiple hues on selected variants.

### Do backgrounds provide depth?

Build Queue provides the clearest luminance ladder. Carrier’s warm gradient panels are attractive but nested translucent-white cards are close in luminance. Mission Browser has several near-identical navy values and relies on rails/gradients. Blueprint Tracker has good charcoal stepping but conflicting later navy overrides. Mining has ample recipes but too many overlapping generations, so depth is inconsistent rather than absent.

### Does muted text become too faint?

Yes, most severely in Carrier and Mining. Carrier routinely uses blue-grey at `.28–.45` alpha and sub-10px-equivalent rem sizes. Mining has `.48rem` labels and `.55` alpha text. Mission’s 2K overrides explicitly acknowledge fixed 11–13px rules. Blueprint Tracker’s `#a4aaa4` muted text is comparatively stronger, while `#69716d` faint text still needs measured verification.

### Does each page feel like one product?

Shared Rajdhani-first typography, dark canvases, compact controls, low radii, and operational density create kinship. Color roles and surfaces do not: Mission is violet/navy, Blueprint is amber/charcoal then navy, Mining is teal/violet/cyan, Build Queue is teal/navy with violet allocation, and Carrier is amber/charcoal with blue-grey text. The family needs shared base tokens and state rules, while retaining one page identity accent or semantic visualization layer.

## Accents and treatments that should survive unification

1. **Carrier amber terminal accent:** retain for Carrier identity, capacity, focus, and decisive actions—not every border.
2. **Carrier cargo category palette:** retain blue/cyan/violet/yellow/orange/green swatches and chips because they label distinct resources; pair color with text/position.
3. **Mission reputation-path accents:** retain as semantic path identity rails/badges, not whole-card glow.
4. **Build Queue violet ownership/relationship cue:** retain for allocation ownership/lower-quality association, separate from teal interaction and green success.
5. **Build Queue teal selected craft pattern:** preserve the fill + border + secondary cue structure, though the global interaction accent may later be retokenized.
6. **Blueprint amber rails and warm off-white text:** retain as high-value/blueprint identity and strong readable hierarchy.
7. **Mining method/tier accents:** retain only when consistently mapped, labeled, and not mixed into a generic cyan-violet active gradient.
8. **Green/amber/red semantic status:** preserve across all pages with distinct labels/icons, never hue alone.

## Recommended promotion / simplification / rejection

**Promote into a shared system:** Build Queue’s canvas-to-row luminance ladder; Carrier’s compact radius/shadow discipline; Blueprint’s warm readable primary text and amber rail technique; consistent fill + border + label/icon selected states; tabular numerics; semantic status colors.

**Keep page-local:** Mission reputation paths; Carrier cargo colors and segmented grids; Blueprint amber identity; Mining method/tier palette; rarity color/glow limited to product/material quality.

**Simplify:** token duplication in Build Queue; legacy/current override layers in Mining and Blueprint Tracker; near-identical navy backgrounds; small uppercase metadata; routine panel drop shadows; hover states that resemble selected states.

**Reject:** generic cyan+violet selected gradients; three accent hues on one selected row; green aliased to interaction teal; low-alpha blue-grey body/metadata text below comfortable readability; glow as the only extra state cue; making every page monochrome.

## Risks and unknowns

- This report did not include computed-style screenshots at 1920×1080 and 2560×1440. Source evidence identifies likely issues, but final scoring should use the independent screenshot and contrast reports.
- Several long CSS files contain late overrides; source order and runtime class combinations determine the exact final value. Blueprint Tracker and Mining especially need computed-style confirmation before implementation.
- Global values behind `--bg-app`, `--void-bg-*`, and shared border/shadow tokens can change the apparent separation described here.
- No behavior or responsive logic was exercised or changed.

## Build result

Not run for this investigation-only report. The only repository artifact is this Markdown file outside application source folders; application code is unchanged.
