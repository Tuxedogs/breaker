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
  const { shipAndHarvestable, vehicle, hand } = visibleResourceGroups;
  const handFiltered = hand.filter((c) => c.label.trim().toLowerCase() !== "pure carinite");

  return (
    <div className={`mining-browser-toolbar${buildQueueSelectionActive ? " mining-browser-toolbar--queue" : ""}`}>

      {/* Row: Search */}
      <div className="crb-row crb-row--search">
        <div className="mfp-search-wrap">
          <input
            type="search"
            className="mfp-search-input"
            placeholder="Filter locations…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button type="button" className="mfp-search-clear" onClick={() => onSearchChange("")} aria-label="Clear search">×</button>
          )}
        </div>
      </div>

      {/* Row: System */}
      <div className="crb-row">
        <span className="crb-section-label">System</span>
        <span className="crb-section-divider" aria-hidden="true" />
        <div className="crb-chip-group" role="group" aria-label="System filters">
          {MINING_SYSTEM_FILTERS.map((sys) => (
            <button
              key={sys}
              type="button"
              className={`craft-frl-chip${selectedSystems.has(sys) ? " craft-frl-chip--active" : ""}`}
              onClick={() => onToggleSystem(sys)}
            >{sys}</button>
          ))}
        </div>
      </div>

      {/* Row: Scope */}
      <div className="crb-row">
        <span className="crb-section-label">Scope</span>
        <span className="crb-section-divider" aria-hidden="true" />
        <div className="crb-chip-group" role="group" aria-label="Scope filters">
          <button
            type="button"
            className={`craft-frl-chip${!buildQueueSelectionActive && selectedMaterials.size === 0 && !showOnlyStarred ? " craft-frl-chip--active" : ""}`}
            onClick={onClearAllFilters}
          >All</button>
          <button
            type="button"
            className={`craft-frl-chip${buildQueueSelectionActive ? " craft-frl-chip--active mfr-chip--bq" : ""}`}
            onClick={onSelectBuildQueueMaterials}
          >
            Queue
            {buildQueueMaterials.size > 0 && <span className="mfr-chip-count">{buildQueueMaterials.size}</span>}
          </button>
          <button
            type="button"
            className={`craft-frl-chip${showOnlyStarred ? " craft-frl-chip--active" : ""}`}
            onClick={onToggleStarred}
          >Starred</button>
        </div>
      </div>

      {/* Separator before materials */}
      {(shipAndHarvestable.length > 0 || vehicle.length > 0 || handFiltered.length > 0) && (
        <div className="crb-row crb-row--separator" aria-hidden="true" />
      )}

      {/* Row: Ship materials */}
      {shipAndHarvestable.length > 0 && (
        <div className="crb-row crb-row--wrap">
          <span className="crb-section-label">Ship</span>
          <div className="crb-chip-group mfp-chips--ship" role="group" aria-label="Ship material filters">
            {shipAndHarvestable.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={`craft-frl-chip craft-frl-chip--sm${selectedMaterials.has(chip.id) ? " craft-frl-chip--active" : ""}`}
                onClick={() => onToggleMaterial(chip.id)}
              >{chip.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Row: FPS + Vehicle on the same line */}
      {(handFiltered.length > 0 || vehicle.length > 0) && (
        <div className="crb-row">
          {handFiltered.length > 0 && (
            <>
              <span className="crb-section-label crb-section-label--fps">FPS</span>
              <span className="crb-section-divider" aria-hidden="true" />
              <div className="crb-chip-group" role="group" aria-label="FPS material filters">
                {handFiltered.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className={`craft-frl-chip craft-frl-chip--sm${selectedMaterials.has(chip.id) ? " craft-frl-chip--active" : ""}`}
                    onClick={() => onToggleMaterial(chip.id)}
                  >{chip.label}</button>
                ))}
              </div>
            </>
          )}
          {handFiltered.length > 0 && vehicle.length > 0 && (
            <span className="crb-group-divider" aria-hidden="true" />
          )}
          {vehicle.length > 0 && (
            <>
              <span className="crb-section-label crb-section-label--vehicle">Vehicle</span>
              <span className="crb-section-divider" aria-hidden="true" />
              <div className="crb-chip-group" role="group" aria-label="Vehicle material filters">
                {vehicle.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className={`craft-frl-chip craft-frl-chip--sm${selectedMaterials.has(chip.id) ? " craft-frl-chip--active" : ""}`}
                    onClick={() => onToggleMaterial(chip.id)}
                  >{chip.label}</button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Clear */}
      {hasActiveFilters && (
        <div className="crb-row crb-row--active-filters">
          <span className="crb-section-label">Active</span>
          <span className="crb-section-divider" aria-hidden="true" />
          <button type="button" className="mfr-clear-btn" onClick={onClearAllFilters}>
            Clear filters
          </button>
        </div>
      )}

    </div>
  );
}
