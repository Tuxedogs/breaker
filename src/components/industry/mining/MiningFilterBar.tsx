import { useMemo } from "react";
import {
  MINING_ENCOUNTER_TIER_FILTERS,
  MINING_METHOD_FILTERS,
  type MiningEncounterTier,
} from "./miningTypes";
import MiningBookmarkIcon from "./MiningBookmarkIcon";
import { useMiningHoverTooltip } from "./MiningHoverTooltip";

interface ResourceGroup {
  id: string;
  label: string;
}

interface ResourceGroups {
  shipAndHarvestable: ResourceGroup[];
  vehicle: ResourceGroup[];
  hand: ResourceGroup[];
}

export function MiningFilterBar({
  selectedMaterials,
  selectedMiningTypes,
  selectedEncounterTiers,
  buildQueueSelectionActive,
  buildQueueMaterials,
  showOnlyStarred,
  visibleResourceGroups,
  hasActiveFilters,
  searchQuery,
  onToggleMiningType,
  onToggleEncounterTier,
  onClearAllFilters,
  onSelectBuildQueueMaterials,
  onToggleStarred,
  onToggleMaterial,
  onSearchChange,
  isMobileViewport = false,
}: {
  selectedMaterials: Set<string>;
  selectedMiningTypes: Set<string>;
  selectedEncounterTiers: Set<MiningEncounterTier>;
  buildQueueSelectionActive: boolean;
  buildQueueMaterials: Set<string>;
  showOnlyStarred: boolean;
  visibleResourceGroups: ResourceGroups;
  hasActiveFilters: boolean;
  searchQuery: string;
  onToggleMiningType: (type: string) => void;
  onToggleEncounterTier: (tier: MiningEncounterTier) => void;
  onClearAllFilters: () => void;
  onSelectBuildQueueMaterials: () => void;
  onToggleStarred: () => void;
  onToggleMaterial: (id: string) => void;
  onSearchChange: (q: string) => void;
  isMobileViewport?: boolean;
}) {
  const { shipAndHarvestable, vehicle, hand } = visibleResourceGroups;
  const handFiltered = hand.filter((c) => c.label.trim().toLowerCase() !== "pure carinite");

  const allMaterialChips = useMemo(
    () => [...shipAndHarvestable, ...vehicle, ...handFiltered],
    [handFiltered, shipAndHarvestable, vehicle],
  );

  const activeFilterCount = useMemo(
    () =>
      selectedMaterials.size
      + selectedMiningTypes.size
      + selectedEncounterTiers.size
      + (showOnlyStarred ? 1 : 0)
      + (buildQueueSelectionActive ? 1 : 0),
    [buildQueueSelectionActive, selectedEncounterTiers.size, selectedMaterials.size, selectedMiningTypes.size, showOnlyStarred],
  );

  const savedTooltip = useMiningHoverTooltip("Saved");

  return (
    <div
      className={[
        "scintel-filter-shell",
        "mining-filter-compact",
        buildQueueSelectionActive ? "scintel-filter-shell--queue mining-filter-compact--queue" : "",
      ].filter(Boolean).join(" ")}
    >
      <div className="scintel-filter-header mining-filter-bar">
        <div className="scintel-filter-search mining-filter-search">
          <label className="component-browser-search mining-browser-search">
            <span className="craft-search-icon" aria-hidden="true">/</span>
            <input
              type="search"
              className="mfp-search-input"
              aria-label="Search mining locations"
              placeholder={isMobileViewport ? "Search locations..." : "Search locations, planets, moons, materials..."}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchQuery && (
              <button type="button" className="mfp-search-clear" onClick={() => onSearchChange("")} aria-label="Clear search">x</button>
            )}
            {!searchQuery && <span className="crb-search-slash" aria-hidden="true">/</span>}
          </label>
        </div>

        <div className="scintel-filter-actions mining-filter-actions">
          {hasActiveFilters && !isMobileViewport && activeFilterCount > 0 && (
            <span className="scintel-filter-summary">{activeFilterCount} active</span>
          )}
          {hasActiveFilters && (
            <button type="button" className="scintel-filter-clear" onClick={onClearAllFilters}>
              Clear all
            </button>
          )}
        </div>

        <div className="mining-scope-switch" role="group" aria-label="Mining location scope">
          <button
            type="button"
            className={`mining-scope-button mining-scope-button--queue${buildQueueSelectionActive ? " mining-scope-button--active" : ""}`}
            aria-pressed={buildQueueSelectionActive}
            onClick={onSelectBuildQueueMaterials}
          >
            Queue
            {buildQueueMaterials.size > 0 && <span className="mfr-chip-count">{buildQueueMaterials.size}</span>}
          </button>
          <button
            type="button"
            className={`mining-scope-button mining-scope-button--bookmark${showOnlyStarred ? " mining-scope-button--active" : ""}`}
            aria-pressed={showOnlyStarred}
            aria-label="Saved"
            aria-describedby={savedTooltip.open ? savedTooltip.tooltipId : undefined}
            onClick={onToggleStarred}
            {...savedTooltip.triggerProps}
          >
            <MiningBookmarkIcon className="mining-scope-button__icon" />
          </button>
        </div>
        {savedTooltip.tooltip}
      </div>

      <div className="scintel-filter-body mining-filter-drawer">
        {allMaterialChips.length > 0 && (
          <div className="mining-filter-drawer-row mining-filter-drawer-row--materials">
            <span className="mining-filter-label">Materials</span>
            <div className="mining-filter-chips mining-filter-chips--wrap" role="group" aria-label="Material filters">
              {allMaterialChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className={`mining-filter-chip mining-filter-chip--material${selectedMaterials.has(chip.id) ? " is-active" : ""}`}
                  aria-pressed={selectedMaterials.has(chip.id)}
                  onClick={() => onToggleMaterial(chip.id)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mining-filter-drawer-row">
          <span className="mining-filter-label">Method</span>
          <div className="mining-filter-chips" role="group" aria-label="Mining method filters">
            {MINING_METHOD_FILTERS.map((method) => (
              <button
                key={method.value}
                type="button"
                className={`mining-filter-chip mining-filter-chip--method mining-filter-chip--method-${method.value.toLowerCase().replace(/\s+/g, "-")}${selectedMiningTypes.has(method.value) ? " is-active" : ""}`}
                aria-pressed={selectedMiningTypes.has(method.value)}
                onClick={() => onToggleMiningType(method.value)}
              >
                {method.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mining-filter-drawer-row">
          <span className="mining-filter-label">Encounter Tier</span>
          <div className="mining-filter-chips" role="group" aria-label="Encounter tier filters">
            {MINING_ENCOUNTER_TIER_FILTERS.map((tier) => (
              <button
                key={tier}
                type="button"
                className={`mining-filter-chip mining-filter-chip--tier mining-filter-chip--tier-${tier.toLowerCase()}${selectedEncounterTiers.has(tier) ? " is-active" : ""}`}
                aria-pressed={selectedEncounterTiers.has(tier)}
                onClick={() => onToggleEncounterTier(tier)}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
