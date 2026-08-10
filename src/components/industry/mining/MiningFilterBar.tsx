import { useMemo } from "react";
import MiningBookmarkIcon from "./MiningBookmarkIcon";
import { useMiningHoverTooltip } from "./MiningHoverTooltip";

interface ResourceGroup {
  id: string;
  label: string;
  disabled?: boolean;
}

interface ResourceGroups {
  shipAndHarvestable: ResourceGroup[];
  vehicle: ResourceGroup[];
  hand: ResourceGroup[];
}

export function MiningScopeActions({
  exploreActive,
  buildQueueSelectionActive,
  buildQueueMaterials,
  showOnlyStarred,
  onSelectExplore,
  onSelectBuildQueueMaterials,
  onToggleStarred,
}: {
  exploreActive: boolean;
  buildQueueSelectionActive: boolean;
  buildQueueMaterials: Set<string>;
  showOnlyStarred: boolean;
  onSelectExplore: () => void;
  onSelectBuildQueueMaterials: () => void;
  onToggleStarred: () => void;
}) {
  const savedTooltip = useMiningHoverTooltip("Saved");

  return (
    <div className="mining-filter-rail-actions">
      <div className="mining-scope-switch" role="group" aria-label="Mining location scope">
        <button
          type="button"
          className={`mining-scope-button mining-scope-button--explore${exploreActive ? " mining-scope-button--active" : ""}`}
          aria-pressed={exploreActive}
          onClick={onSelectExplore}
        >
          Explore
        </button>
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
          <span>Saved</span>
          <MiningBookmarkIcon className="mining-scope-button__icon" />
        </button>
      </div>
      {savedTooltip.tooltip}
    </div>
  );
}

export function MiningFilterBar({
  selectedMaterials,
  visibleResourceGroups,
  onToggleMaterial,
  onClearMaterials,
}: {
  selectedMaterials: Set<string>;
  visibleResourceGroups: ResourceGroups;
  onToggleMaterial: (id: string) => void;
  onClearMaterials: () => void;
}) {
  const { shipAndHarvestable, vehicle, hand } = visibleResourceGroups;
  const handFiltered = hand.filter((c) => c.label.trim().toLowerCase() !== "pure carinite");

  const allMaterialChips = useMemo(
    () => [...shipAndHarvestable, ...vehicle, ...handFiltered],
    [handFiltered, shipAndHarvestable, vehicle],
  );

  const renderMaterialChips = (chips: ResourceGroup[], ariaLabel: string) => (
    <div className="mining-filter-chips mining-filter-chips--wrap" role="group" aria-label={ariaLabel}>
      {chips.map((chip) => {
        const selected = selectedMaterials.has(chip.id);
        return (
          <button
            key={chip.id}
            type="button"
            className={`mining-filter-chip mining-filter-chip--material${chip.label.length > 12 ? " mining-filter-chip--long" : ""}${selected ? " is-active" : ""}${chip.disabled ? " is-disabled" : ""}`}
            aria-pressed={selected}
            aria-disabled={chip.disabled || undefined}
            disabled={chip.disabled}
            onClick={() => onToggleMaterial(chip.id)}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className={[
        "scintel-filter-shell",
        "mining-filter-compact mining-left-rail-filters",
      ].filter(Boolean).join(" ")}
    >
      <div className="scintel-filter-body mining-filter-drawer">
        {allMaterialChips.length > 0 && (
          <div className="mining-filter-chip-block">
            <div className="mining-material-index-head">
              <span>Materials</span>
              <div className="mining-material-selection-summary">
                <span>
                  <strong>{selectedMaterials.size}</strong> selected · {allMaterialChips.length} total
                </span>
                <button
                  type="button"
                  className="mining-material-clear-button"
                  disabled={selectedMaterials.size === 0}
                  aria-disabled={selectedMaterials.size === 0}
                  onClick={onClearMaterials}
                >
                  Clear all
                </button>
              </div>
            </div>
            {renderMaterialChips(shipAndHarvestable, "Ship material filters")}
            {vehicle.length > 0 && (
              <div className="mining-material-subgroup">
                <span className="mining-material-subgroup-label">Vehicle minables</span>
                {renderMaterialChips(vehicle, "Vehicle-minable material filters")}
              </div>
            )}
            {handFiltered.length > 0 && (
              <div className="mining-material-subgroup">
                <span className="mining-material-subgroup-label">Hand minables</span>
                {renderMaterialChips(handFiltered, "Hand-minable material filters")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
