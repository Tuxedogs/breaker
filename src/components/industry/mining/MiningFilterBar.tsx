import { useMemo, useState } from "react";
import { MINING_SYSTEM_FILTERS } from "./miningTypes";

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
  selectedSystems,
  selectedMaterials,
  buildQueueSelectionActive,
  buildQueueMaterials,
  showOnlyStarred,
  visibleResourceGroups,
  hasActiveFilters,
  searchQuery,
  onToggleSystem,
  onClearAllFilters,
  onSelectBuildQueueMaterials,
  onToggleStarred,
  onToggleMaterial,
  onSearchChange,
}: {
  selectedSystems: Set<string>;
  selectedMaterials: Set<string>;
  buildQueueSelectionActive: boolean;
  buildQueueMaterials: Set<string>;
  showOnlyStarred: boolean;
  visibleResourceGroups: ResourceGroups;
  hasActiveFilters: boolean;
  searchQuery: string;
  onToggleSystem: (sys: string) => void;
  onClearAllFilters: () => void;
  onSelectBuildQueueMaterials: () => void;
  onToggleStarred: () => void;
  onToggleMaterial: (id: string) => void;
  onSearchChange: (q: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { shipAndHarvestable, vehicle, hand } = visibleResourceGroups;
  const handFiltered = hand.filter((c) => c.label.trim().toLowerCase() !== "pure carinite");

  const allMaterialChips = useMemo(
    () => [...shipAndHarvestable, ...vehicle, ...handFiltered],
    [handFiltered, shipAndHarvestable, vehicle],
  );

  const activeFilterCount = useMemo(
    () =>
      selectedSystems.size
      + selectedMaterials.size
      + (showOnlyStarred ? 1 : 0)
      + (buildQueueSelectionActive ? 1 : 0),
    [buildQueueSelectionActive, selectedMaterials.size, selectedSystems.size, showOnlyStarred],
  );

  const scopeIsDefault = !buildQueueSelectionActive && selectedMaterials.size === 0 && !showOnlyStarred;

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = [];
    if (buildQueueSelectionActive) chips.push({ key: "scope:queue", label: "Queue" });
    if (showOnlyStarred) chips.push({ key: "scope:starred", label: "Starred" });
    for (const sys of [...selectedSystems].sort()) chips.push({ key: `system:${sys}`, label: sys });
    for (const chip of allMaterialChips) {
      if (selectedMaterials.has(chip.id)) chips.push({ key: `material:${chip.id}`, label: chip.label });
    }
    return chips;
  }, [allMaterialChips, buildQueueSelectionActive, selectedMaterials, selectedSystems, showOnlyStarred]);

  return (
    <div
      className={[
        "mining-filter-compact",
        buildQueueSelectionActive ? "mining-filter-compact--queue" : "",
        expanded ? "mining-filter-compact--expanded" : "",
      ].filter(Boolean).join(" ")}
    >
      <div className="mining-filter-bar">
        <div className="mining-filter-search">
          <div className="mfp-search-wrap">
            <input
              type="search"
              className="mfp-search-input"
              placeholder="Search locations…"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchQuery && (
              <button type="button" className="mfp-search-clear" onClick={() => onSearchChange("")} aria-label="Clear search">×</button>
            )}
          </div>
        </div>

        {hasActiveFilters && (
          <span className="mining-filter-active-count">{activeFilterCount} active</span>
        )}

        {!expanded && activeFilterChips.length > 0 && (
          <div className="mining-filter-active-chips" aria-label="Active filters">
            {activeFilterChips.slice(0, 4).map((chip) => (
              <span key={chip.key} className="mining-filter-active-chip">{chip.label}</span>
            ))}
            {activeFilterChips.length > 4 && (
              <span className="mining-filter-active-chip">+{activeFilterChips.length - 4}</span>
            )}
          </div>
        )}

        {hasActiveFilters && (
          <button type="button" className="mining-filter-clear" onClick={onClearAllFilters}>
            Clear
          </button>
        )}

        <button
          type="button"
          className="mining-filter-toggle"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse filters" : "Expand filters"}
          onClick={() => setExpanded((open) => !open)}
        >
          <span className="mining-filter-chevron" aria-hidden="true">{expanded ? "▴" : "▾"}</span>
        </button>
      </div>

      {expanded && (
        <div className="mining-filter-drawer">
          <div className="mining-filter-drawer-row">
            <span className="mining-filter-label">System</span>
            <div className="mining-filter-chips" role="group" aria-label="System filters">
              {MINING_SYSTEM_FILTERS.map((sys) => (
                <button
                  key={sys}
                  type="button"
                  className={`craft-frl-chip craft-frl-chip--sm${selectedSystems.has(sys) ? " craft-frl-chip--active" : ""}`}
                  onClick={() => onToggleSystem(sys)}
                >
                  {sys}
                </button>
              ))}
            </div>
          </div>

          <div className="mining-filter-drawer-row">
            <span className="mining-filter-label">Scope</span>
            <div className="mining-filter-chips" role="group" aria-label="Scope filters">
              <button
                type="button"
                className={`craft-frl-chip craft-frl-chip--sm${scopeIsDefault ? " craft-frl-chip--active" : ""}`}
                onClick={onClearAllFilters}
              >
                All
              </button>
              <button
                type="button"
                className={`craft-frl-chip craft-frl-chip--sm${buildQueueSelectionActive ? " craft-frl-chip--active mfr-chip--bq" : ""}`}
                onClick={onSelectBuildQueueMaterials}
              >
                Queue
                {buildQueueMaterials.size > 0 && <span className="mfr-chip-count">{buildQueueMaterials.size}</span>}
              </button>
              <button
                type="button"
                className={`craft-frl-chip craft-frl-chip--sm${showOnlyStarred ? " craft-frl-chip--active" : ""}`}
                onClick={onToggleStarred}
              >
                Starred
              </button>
            </div>
          </div>

          {allMaterialChips.length > 0 && (
            <div className="mining-filter-drawer-row mining-filter-drawer-row--materials">
              <span className="mining-filter-label">Type</span>
              <div className="mining-filter-chips mining-filter-chips--wrap" role="group" aria-label="Material filters">
                {allMaterialChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className={`craft-frl-chip craft-frl-chip--sm${selectedMaterials.has(chip.id) ? " craft-frl-chip--active" : ""}`}
                    onClick={() => onToggleMaterial(chip.id)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeFilterChips.length > 0 && (
            <div className="mining-filter-drawer-row">
              <span className="mining-filter-label">Active</span>
              <div className="mining-filter-active-chips mining-filter-active-chips--expanded" aria-label="Active filters">
                {activeFilterChips.map((chip) => (
                  <span key={chip.key} className="mining-filter-active-chip">{chip.label}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}