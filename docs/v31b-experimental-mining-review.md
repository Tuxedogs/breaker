# Breaker V31.b | Experimental Mining UI Review

Status: EXPERIMENT ONLY. Not approved for React, API, or production.
Baseline: C:\Users\shane\Downloads\Breaker_V31_Responsive_Motion.html
Experiment: D:\Moonbreaker-mockup-current\Breaker_V31b_Responsive_Motion.html
Review gallery: D:\Moonbreaker-mockup-current\artifacts\V31b_Mining_Review\index.html

## Changes

- Ranked Locations now uses per-selected-material coverage chips instead of N of M. Chips preserve selection order, use the preexisting Mining material accent colors, and distinguish covered versus missing with both muted color and underline.
- The Location Profile places Covered in the metric heading and Not Covered beneath it, with muted chips, borders and background contrast. Ranked Locations uses the same abbreviations. All material chips use three letters except Titanium = Ti. Stable collision labels: Beryl / Bexalite / Beradom = Byl / Bex / Bdm; Sadaryx / Savrilium / Saldynium = Sdx / Sav / Sal; Copper / Corundum = Cop / Cor; Jaclium / Janalite = Jac / Jan; Quantanium / Quartz = Qtm / Qtz; Carinite / Carinite Pure = Car / Pur. Quantanium spelling is normalized throughout V31.b. Hover, focus and tap expose full names/status.
- The Missing Targets metric is replaced by Clutter: Low, Medium, or High. These labels are wholly illustrative and not produced by the API.
- The selected-source panel contains location type, climate, and a red-only oxygen indicator. The Specialized Equipment group shows Cold then Hot, and Hazards shows Radiation (green), Biological (unchanged), Wildlife/WIDLF (orange) and Pirate threats (red) when active. All six fixed indicator slots remain visible in the same position when inactive, using the muted existing treatment; there is no Normal armor slot, C/N/H temperature state or risk calculation.
- Three review screenshot fixtures (space/full, moon/partial, planet/missing) remain accessible via the v31b query parameter for reproducible capture, but the three unused on-page scene buttons have been removed. Existing location selection, rank semantics, material and competition tables, saved states and other mockup pages are preserved.
- The V31-approved removal of method percentages in Ranked Locations is retained. The separate approved V31 HTML remains unmodified.
- Location images reuse original mockup artwork and are not verified images of the named sites.

## Example fixtures (none are game-verified environmental classifications)

| Scene | Viewport | Source | Coverage | Clutter | Environment |
| --- | --- | --- | --- | --- | --- |
| Space/full | 1920 x 1080 | Keeger Belt | 4/4 | Low | Space, red oxygen indicator |
| Moon/partial | 900 x 1100 | Daymar | 2/4 | Medium | Moon, red oxygen indicator |
| Planet/missing | 390 x 844 | Hurston | 1/4 | High | Planet, red oxygen indicator |

The example environmental data, climate, oxygen, armor, threats and clutter are fictional UI fixtures. Risk and C/N/H temperature status have been removed from the interface and fixture schema. The location imagery is illustrative and is not source evidence.

## Screenshots and comparisons

The folder artifacts/V31b_Mining_Review contains the individual baseline and experimental PNGs, the QA results and a responsive local gallery, index.html. Side-by-side comparison files:

- desktop_full_space_COMPARE_overview.png
- tablet_partial_moon_COMPARE_overview.png
- tablet_partial_moon_COMPARE_profile.png
- mobile_missing_planet_COMPARE_locations.png
- mobile_missing_planet_COMPARE_profile.png
- mobile_missing_planet_COMPARE_selected-card.png

## API / data investigation required before React migration

| UI feature | Additional data needed? | Suggested ownership |
| --- | --- | --- |
| Per-material coverage chips | No new source fields expected | Existing location-to-material membership plus canonical selected-material IDs and order |
| Three-letter abbreviations, Titanium Ti and collision overrides | Shared presentation metadata is advisable | Reuse canonical material IDs and preserve one unique visible code per material, regardless of selected subset. The V31.b fixture now uses the canonical Quantanium spelling. |
| Clutter | YES, pending independent model | Defined clutter semantics, inputs, confidence, unknown state, model version and source attribution |
| Planet/Moon/Space | Likely location-catalog normalization | Verified hierarchical location type; unavailable distinct from guessed |
| Climate | YES | Sourced environmental conditions, version and variability |
| Breathability / ambient O2 | YES | Sourced oxygen/atmosphere status, including vacuum and unknown; never infer from type |
| Normal, cold and hot protective equipment | YES | Environmental thresholds and verified protection requirements, not ad hoc location labels |
| Radiation / biological / Kopion / pirates | YES | Threat evidence, geographic scope, source, confidence and update cadence |
| Location-specific image | Curated asset mapping | Verified image rights and identity; may be static data rather than a new API response |

## Design assessment

Recommended to pursue after review: per-material coverage chips and matching profile chips, because they distinguish what is available without forcing interpretation of a fraction. A fixed-position oxygen indicator and fixed equipment slots also improve quick scanning.

Conditional: Clutter has value only with a separately validated model; Low must not mean unknown. Environment data should not be promoted to React until verified and display labels can handle unavailable information.

Potential unnecessary complexity: the entire hazard-and-protection grid is dense on mobile and could be collapsed behind a compact environment summary. Do not create a new styling/icon framework for placeholder symbols; replace them only after receiving the owner's SVGs. Test 6+ simultaneous selected materials before approving any chip-width and row-height tradeoff.

## Verification

Chromium screenshots and DOM checks succeeded at 1920x1080, 900x1100 and 390x844; both V31 and V31.b had no captured JavaScript errors and no horizontal page overflow. Verified the three fixture coverage states 4/4, 2/4, 1/4 and corresponding clutter labels Low, Medium, High. Verified no method percentages were restored on Ranked Locations, that Risk/C/N/H and the scene buttons are absent, that Covered is the metric title and that the Craft mockup remains renderable. No production React or APIs were edited, so app lint/build is not applicable.

STOP: No production migration, merge or push. Await explicit design approval.
