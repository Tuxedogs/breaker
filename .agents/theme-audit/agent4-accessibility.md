# Agent 4 — Accessibility and Readability Audit

## Scope and method

Investigation only. I audited the supplied 1920×1080 and 2560×1440 captures for Dashboard, Fitting Mockup, Mission Browser, Blueprint Tracker, Mining, Build Queue, and Carrier Logistics, then traced the owning JSX/CSS. No application code or behavior was changed.

Contrast ratios below use WCAG relative luminance. For alpha colors I composited the declared foreground over the declared/nearest opaque surface in sRGB before measuring. These are reliable for flat-color cases and useful lower-bound estimates for gradients. Normal text is judged at 4.5:1, large text and meaningful non-text graphics at 3:1. Very small/thin uppercase Rajdhani is treated as suspect even when its arithmetic ratio passes.

## Highest-priority findings

1. **Carrier Logistics has systemic text failures.** Common metadata composites between **1.79:1 and 2.54:1**, often at 7.8–10px-equivalent sizes. The screenshots visibly confirm that room capacities, card descriptions, row sublabels, and service figures disappear during normal scanning.
2. **Routine boundaries are far below 3:1 across all families.** Examples: Fitting's white `.07` border is about **1.17:1**, Mission's teal `.14` border about **1.16:1**, and Carrier's white `.07` border about **1.19:1**. Quiet decorative edges may be exempt, but many of these edges are the only cue separating cards, inputs, or rows and therefore fail as meaningful boundaries.
3. **Keyboard focus is inconsistent or absent.** Fitting Mockup defines no `:focus`/`:focus-visible` rules in its page stylesheet. Carrier removes native outlines and replaces them with a weak border-only change. Dashboard explicitly removes the outline on `.dash-stat-info-btn:focus`. Mission controls also remove outlines and use a faint replacement.
4. **Small metadata is a product-wide fatigue risk.** Dashboard uses 0.53–0.68rem labels, Mining reaches 0.48rem, Build Queue reaches 9–10px, and Carrier reaches 0.49rem. Wide letter spacing and uppercase styling further reduce word-shape recognition.
5. **Selected states are not consistently redundant.** Build Queue is strongest (fill + border + related count treatment). Fitting selected equipment and some Mission/Mining states rely mainly on colored border/glow or multiple hues without an icon/check/structural marker.

## Measured reference pairs

| Selector / role | Foreground after compositing | Background | Ratio | Result |
|---|---:|---:|---:|---|
| `.clog-room-stat-label`, `.clog-cap-row-sublabel` (`rgba(160,180,220,.28)`) | `#38414e` | `#101417` | **1.79:1** | Fail |
| `.clog-room-capacity` (`.32`, interpolated) | about `#3e4857` | `#101417` | about **1.96:1** | Fail |
| `.clog-cap-bar-total`, `.clog-inline-card-label`, `.clog-capability-desc` (`.35`) | `#424c5c` | `#101417` | **2.13:1** | Fail |
| `.clog-field-label`, `.clog-inline-card-unit`, `.clog-cap-row-label` (`.40`) | `#4a5466` | `#101417` | **2.43:1** | Fail |
| `.clog-override-label`, inactive `.clog-toggle-btn` (`.42`) | `#4c576a` | `#101417` | **2.54:1** | Fail |
| `.clog-panel` border (`rgba(255,255,255,.07)`) | `#212427` | `#101417` | **1.19:1** | Fail when boundary is required |
| `.dash-hero-mini-label` (`rgba(160,180,220,.56)`) | `#616e85` | `#101417` | **3.59:1** | Fail normal text |
| Dashboard metadata at alpha `.38` | `#475162` | `#101417` | **2.31:1** | Fail |
| `.msb-section-label` (`rgba(169,186,208,.55)`) | `#606b7b` | `#070a12` | **3.66:1** | Fail normal text |
| Mission `--mb-subtle: #7a8fa3` | `#7a8fa3` | `#03121c` | **5.68:1** | Pass, but still suspect at 10–11px uppercase |
| Fitting `--fm-muted-2: #5f6b75` | `#5f6b75` | `#0a0e12` | **3.55:1** | Fail normal text |
| Fitting `--fm-border` white `.07` | `#1b1f23` | `#0a0e12` | **1.17:1** | Fail when boundary is required |
| Blueprint `--bt-faint: #69716d` | `#69716d` | `#10161a` | **3.63:1** | Fail normal text |
| Mission `--mb-border` teal `.14` | `#0d232f` | `#04131d` | **1.16:1** | Fail when boundary is required |

Gradients, artwork, shadows, and stacked translucent layers can shift a result. The listed failures have enough margin that reasonable local variation does not rescue them.

## Page audits

### Dashboard

- **Primary text:** `.dash-hero-title` `#e7edff` and major values are strong. The hero subtitle at `rgba(160,180,220,.72)` appears serviceable, though the thin 0.86rem face should not be reduced further.
- **Failures:** `.dash-hero-mini-label` is approximately 3.59:1 at 0.6rem; `.dash-hero-mini-value small` at alpha `.48` is lower; `.dash-stat-sublabel` alpha `.38`, `.dash-update-date` alpha `.30`, and `.dash-stat-tooltip-title` alpha `.45` fail. These are information, not decoration.
- **Boundaries:** `.dash-hero-mini` white `.07` borders and category borders `.16–.20` are too faint to be dependable boundaries. Surface luminance and shadow usually preserve the card silhouette, but category hue cannot substitute for contrast.
- **State/non-color cues:** primary versus secondary CTA uses fill + border, a sound redundant cue. Four hero mini cards use different border hues without a legend and look categorical rather than stateful. `.dash-stat-info-btn:focus` removes the outline and changes color only; this is a keyboard failure.
- **Artwork/gradient:** hero text is placed on a controlled dark gradient rather than directly over detailed art, so local contrast is stable. This is the safest hero treatment in the audit.
- **Fatigue:** repeated tiny uppercase metadata and numerous colored mini-card edges are the main risks, not the restrained ambient glow. At 2560×1440 the 2K adjustments help some text but do not repair all alpha roles.

### Fitting Mockup

- **Primary/secondary text:** `--fm-text #e8edf2` is strong. `--fm-muted #8b97a3` is generally adequate on `#0a0e12`; `--fm-muted-2 #5f6b75` is only 3.55:1 and is widely used at 11–12px (`.fm-stat-mini-head`, `.fm-resource-block h4`, `.fm-resource-metrics em`).
- **Boundaries:** `.fm-panel`, `.fm-stat-card`, equipment rows, icons, and controls repeatedly use white `.06–.08` edges (roughly 1.15–1.20:1). Because neighboring surfaces are very similar, boundaries often become indistinct. Equipment rows retain shape through spacing and the left category strip, but generic panels do not reliably do so.
- **State/non-color cues:** `.fm-topbar-tab.is-active` uses brighter text + underline, which survives grayscale. `.fm-equip-row.is-selected` uses a faint teal border/inset with little fill change and no guaranteed selected icon; it does not meet the required two-cue rule. Installed drawer rows use green border + fill and visible “Installed” text, which is substantially better. Status dots are paired with text labels.
- **Focus:** no page-scoped `:focus` or `:focus-visible` styles were found despite many custom buttons. Native outlines may appear where not globally reset, but this is not a dependable system and icon-only controls are especially exposed.
- **Artwork:** ship artwork is isolated to `.fm-hero-stage`; its controls use dark backplates, preventing most text-on-art failures. Ship silhouette/detail itself is nonessential and labelled via `role="img"`/ARIA in the terminal implementation. Ensure overlay text never loses its backplate.
- **Fatigue:** many equally sized 11–13px uppercase labels, very long four-column scanning at 1920, and dense right-rail micro-stat grids. Numeric alignment is good (`tabular-nums`, right-aligned values). Saturated glow is mostly reserved for active power segments, but cyan power and orange/purple category strips still compete in peripheral vision.

### Mission Browser

- **Text:** `--mb-text #edf7ff`, `--mb-muted #a9bad0`, and even `--mb-subtle #7a8fa3` (5.68:1 on `#03121c`) pass as solid colors. Readability concern comes from 10–11px uppercase usage, not the base token alone. The 2K overrides explicitly compensate for many locked 11–13px rules, showing the baseline scale is marginal.
- **Inputs:** select text `rgba(203,213,225,.88)` is readable; the `rgba(148,163,184,.13)` border is not a 3:1 control boundary. `:focus` removes the outline and uses amber `.52` border plus a `.08` 1px halo. The color may be visible but the thin border-only treatment is fragile and not standardized with keyboard-only focus.
- **Cards:** `--mb-border rgba(65,132,160,.14)` composites to about 1.16:1 against the panel. Where lane spacing and colored rails exist, grouping remains understandable; deeply nested dossier sections can collapse into one dark field.
- **State/non-color cues:** active dossier tabs use text/fill + inset underline and are good. `.mission-dossier-variant-row.is-selected` stacks violet, teal, and blue treatments; these are multiple color cues, not multiple kinds of cue. Add a persistent marker/check or stronger structural fill in future work. Reputation path rails are paired with labels and position, so they do not rely on hue alone.
- **Fatigue:** long nested card lanes, frequent uppercase labels, and violet/teal/blue competition on selected variants. At 2560 width, line lengths and horizontal scan increase even though type is slightly improved.

### Blueprint Tracker

- **Text:** `--bt-text #f1ecdf` and `--bt-muted #a4aaa4` provide comfortable contrast. `--bt-faint #69716d` is only 3.63:1 on `#10161a`, failing normal text and appearing in secondary mission/source metadata.
- **Boundaries:** default white-grey `.07–.12` alpha borders do not reach 3:1. Amber rails and spacing frequently rescue accordion grouping, but neutral inputs/cards whose edge is their only boundary remain weak.
- **Focus:** this page has the best explicit keyboard coverage: `.bt-faction-header:focus-visible`, `.bt-mission-main:focus-visible`, checkbox focus, and `.bp-card:focus-visible`. However, search inputs use `:focus` after `outline:none`, and some later selectors explicitly remove outlines; treatment is not uniform.
- **State/non-color cues:** selected mission entries use fill plus violet inset/rail; accordions use disclosure geometry and expanded content, both sound. Initial `.bt-tab:hover, .bt-tab.is-active` styling makes hover and active too similar, with the active inset line carrying most of the distinction.
- **Badges/status:** amber/teal/green/red text generally has sufficient luminance on dark panels, but semantic states should retain their text/icon wording. Amber card rails are a structural cue that works in grayscale.
- **Fatigue:** internal switching between warm charcoal and later navy layers makes the eye continually recalibrate; dense source metadata using `--bt-faint` is the main readability loss. Numeric/list alignment is otherwise strong.

### Mining

- **Text failures:** `.msb-section-label` is 0.48rem and `rgba(169,186,208,.55)`, approximately 3.66:1 on the sidebar—both too small and below 4.5:1. Multiple 0.52rem labels and faint alpha roles recur throughout the page. Base `--sc-text-faint` should also be checked wherever used as operational text.
- **Boundaries:** the sidebar's final white `.05` border and section white `.04` separators are decorative-level contrast. With near-identical dark surfaces, filter groups flatten together.
- **Controls/focus:** Mining has a broad `.mine-page :where(button,[role="button"],input,select):focus-visible` rule and dedicated focus for scope/bookmark controls, a positive baseline. Several search/select rules still remove outlines before applying page-local replacements, so source order needs consolidation.
- **State/non-color cues:** legacy `.msb-chip--active` uses fill + border + text. V2 `.mining-filter-chip.is-active` uses cyan/violet gradient, inset edge, and glow—multiple visual effects but still principally color/luminance, with no checked marker. Selected location rows gain fill + border/inset and remain distinguishable in grayscale better than chips. Method/tier colors are paired with text labels.
- **Charts/bars:** route/resource bars have labels and numerical context, which prevents color-only interpretation. Thin tracks and low-alpha empty states are difficult to see; active fills should be evaluated against both track and neighboring fills at 3:1.
- **Fatigue:** this is the most glow-heavy routine control system. Cyan + violet on ordinary active filters makes too many elements look energized. Tiny sidebar type, extensive nesting, and list-to-detail horizontal scanning are more serious than raw density.

### Build Queue

- **Text:** primary `#edf7ff`, secondary `#a9bad0`, and muted `#7a8fa3` are generally viable on `#03121c`; however, muted text is repeatedly rendered at 9–10px (`.bq-queue-tab`, small badges/pills), which is not comfortable for sustained use. Thin uppercase badge lettering remains suspect even if token contrast passes.
- **Boundaries:** craft-card border teal `.14`, pill grey `.14`, and many panel edges are below 3:1. Build Queue fares better visually because its opaque surface ladder (`#03121c` → `#04131d` → `#051a28` → `#081e2c`) adds luminance/spacing cues.
- **State/non-color cues:** `.bq-craft-card.is-selected` is the strongest selection in the audit: full teal edge + distinct `#071f2e` fill + inset/related treatment. Done cards also change fill and semantic wording. Allocation ownership uses violet plus text/relationship context. Tabs use fill, text, outline-like inset, and count treatment. These mostly survive grayscale.
- **Focus:** `.bq-auto-reserve-btn:focus-visible` and broad `.bq-page :where(button,input,label):focus-visible` coverage are positive. Verify links and custom role controls are included; the broad selector omits anchors and `[role=button]`.
- **Warnings/status:** warning banner uses amber fill + border + copy; danger and completion states include words/icons rather than hue only. Green is currently aliased toward teal in the local token system, reducing the visible distinction between success and interaction.
- **Fatigue:** three columns create long left-to-right scanning at 1920 and even longer travel at 2560 unless max-widths constrain it. Many low-level glows and rarity accents can make routine content look active. Tabular numerics are used well; alignment is stronger than in Carrier.

### Carrier Logistics

- **Text failures:** `.clog-room-stat-label` and `.clog-cap-row-sublabel` (1.79:1); `.clog-room-capacity` (~1.96:1); `.clog-cap-bar-total`, `.clog-inline-card-label`, `.clog-capability-desc` (2.13:1); `.clog-field-label`, `.clog-inline-card-unit`, `.clog-cap-row-label` (2.43:1); and `.clog-override-label`/inactive toggles (2.54:1) all fail. They are also only 0.49–0.63rem. This is the audit's most consequential defect.
- **Controls:** selects and number inputs remove native outlines. Their focus state changes only to `rgba(255,153,0,.4)` border; no `:focus-visible` ring exists. Slider thumbs are amber but no keyboard focus treatment is defined. Disabled quick buttons use global opacity `.25`, making both label and boundary virtually disappear; disabled content need not meet normal contrast, but the control must remain identifiable where discovery matters.
- **Boundaries:** `.clog-panel` white `.07` is about 1.19:1; nested cards use `.06–.08`, and inputs `.09–.10`. These fail as boundaries. The 1920 capture visibly shows room grids and service cards blending into their parents.
- **State/non-color cues:** active toggle buttons use fill + border + brighter text, good in principle. Cargo categories use colored swatch + persistent text + fixed row position, so they are not hue-only. Room bars also have numeric “used/free/fill” labels. Empty grid cells, however, are so low contrast that capacity structure becomes difficult to perceive.
- **Fatigue:** the page does not overuse glow; its problem is visual suppression. Reading requires sustained effort because most secondary information sits near the canvas luminance. The service-capability rail is especially difficult: long vertical scanning, tiny repeated labels, and right-aligned low-contrast numbers. At 2560×1440 extra space does not solve the token/size failure.

## Cross-page control and non-color assessment

- **Good patterns:** Build Queue selected cards; Blueprint accordion/disclosure structure; Dashboard primary versus secondary CTA; labelled status dots; Carrier cargo swatches paired with names; tabular numerics in Dashboard/Fitting/Build Queue/Carrier.
- **Weak patterns:** colored glow counted as a second cue; hover and selected sharing nearly the same fill; focus indicated by border-color alone; category hue without a legend; opacity-based disabling that erases control shape.
- **Grayscale resilience:** Dashboard CTAs, Build Queue cards/tabs, Blueprint disclosure rails, and labelled cargo rows remain understandable. Fitting equipment selection, Mining active chips, and Mission selected variants lose much of their distinction because their cues are primarily hue and subtle glow.

## Visual-fatigue and layout assessment

| Risk | Most affected | Notes |
|---|---|---|
| Saturated glow / competing accents | Mining, Mission, Build Queue | Routine selected filters/rows carry multiple cool hues; reserve glow for focus or exceptional state. |
| Similar dark surfaces | Carrier, Mission, Fitting | Very low-contrast borders are asked to define nesting; use fewer, clearer luminance levels. |
| Small faint uppercase labels | Carrier, Mining, Dashboard, Build Queue | Most serious systemic readability issue; wide tracking does not compensate for sub-11px size. |
| Excessive card nesting | Mission, Mining, Carrier service rail | Parent/child boundaries collapse and scanning becomes slower. |
| Poor numeric alignment | Minor overall; Carrier mixed | Most dense pages use tabular numerics. Carrier's scattered right-edge values and tiny units weaken comparison. |
| Long horizontal scanning | Build Queue, Mining, Fitting | 2560×1440 increases travel unless content columns/max-widths constrain it; keep key label/value pairs proximal. |

## Recommended remediation order (no implementation in this pass)

1. Raise operational text roles to 4.5:1 after compositing; fix Carrier first, then Mining/Dashboard microcopy and Fitting/Blueprint faint tokens.
2. Establish a consistent `:focus-visible` ring with at least 3:1 contrast and 2px effective thickness; never remove native outline without a replacement.
3. Separate true structural boundaries from decorative hairlines. Required input/card/selected boundaries must reach 3:1 or be backed by a clear fill/luminance/spacing cue.
4. Set an effective minimum of 11–12px for metadata and 12–13px for operational labels; avoid sub-10px uppercase text at both target resolutions.
5. Require every selected/status state to combine color with fill, shape, marker/icon, underline, or explicit text. Simplify cyan+violet+blue combinations rather than treating multiple hues as redundancy.
6. Preserve tabular numerics and constrain dense multi-column layouts so label/value pairs remain near each other at 2560×1440.

## Tooling limits and unknowns

- I had comparable PNG captures at both requested resolutions, but no live browser accessibility tree or computed-style automation session. Measurements therefore use declared final-looking selectors and known opaque ancestors rather than browser-returned computed pixels for every node.
- Long stylesheets (especially Mining and Blueprint Tracker) contain later overrides; an unusual runtime class combination could change an individual declared value. Failures listed with exact selectors were chosen where the visible capture and effective source agree.
- Screenshot resampling can make 1px borders look dimmer or brighter, so ratios are based on CSS colors, not sampled antialiased pixels.
- I did not test browser zoom, forced colors, OS high-contrast mode, keyboard traversal order, screen-reader announcements, or motion preferences. Those require a separate interactive accessibility pass.

## Repository/build status

- Changed file: `.agents/theme-audit/agent4-accessibility.md` only.
- Application source, data, behavior, routing, and Mining were not touched.
- `npm run build` was not run because this investigation added only a Markdown report outside application source; no compiled input changed.
