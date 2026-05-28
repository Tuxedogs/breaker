import { MINING_QUEUE_SCOPES, MINING_SYSTEM_FILTERS, type MiningQueueScope } from "./miningTypes";
import { queueScopeDescription } from "./miningFormatters";

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
  drawerOpen,
  drawerGroup,
  filterSearch,
  visibleResourceGroups,
  hasActiveFilters,
  onToggleSystem,
  onClearAllFilters,
  onSelectBuildQueueMaterials,
  onToggleStarred,
  onOpenDrawer,
  onCloseDrawer,
  onSetFilterSearch,
}: {
  selectedSystems: Set<string>;
  selectedMaterials: Set<string>;
  buildQueueSelectionActive: boolean;
  buildQueueMaterials: Set<string>;
  showOnlyStarred: boolean;
  drawerOpen: boolean;
  drawerGroup: "system" | "ship" | "vehicle" | "hand";
  filterSearch: string;
  visibleResourceGroups: ResourceGroups;
  hasActiveFilters: boolean;
  onToggleSystem: (sys: string) => void;
  onClearAllFilters: () => void;
  onSelectBuildQueueMaterials: () => void;
  onToggleStarred: () => void;
  onOpenDrawer: (group: "ship" | "vehicle" | "hand") => void;
  onCloseDrawer: () => void;
  onSetFilterSearch: (v: string) => void;
}) {
  const allMaterialChips = [
    ...visibleResourceGroups.shipAndHarvestable,
    ...visibleResourceGroups.vehicle,
    ...visibleResourceGroups.hand,
  ];
  const totalMaterialCount = allMaterialChips.length;
  const selectedMaterialCount = allMaterialChips.filter((c) => selectedMaterials.has(c.id)).length;
  const materialDrawerOpen = drawerOpen && (drawerGroup === "ship" || drawerGroup === "vehicle" || drawerGroup === "hand");

  return (
    <div className={`mfb-bar${materialDrawerOpen ? " mfb-bar--open" : ""}${buildQueueSelectionActive ? " mfb-bar--queue" : ""}`}>

      {/* System chips */}
      <span className="mining-filter-label">System</span>
      <div className="mfb-chips">
        {MINING_SYSTEM_FILTERS.map((sys) => (
          <button
            key={sys}
            type="button"
            className={`mfr-chip${selectedSystems.has(sys) ? " mfr-chip--active" : ""}`}
            onClick={() => onToggleSystem(sys)}
          >{sys}</button>
        ))}
      </div>

      <div className="mfb-divider" />

      {/* Mode chips */}
      <div className="mfb-chips">
        <button
          type="button"
          className={`mfr-chip${!buildQueueSelectionActive && selectedMaterials.size === 0 && !showOnlyStarred ? " mfr-chip--active" : ""}`}
          onClick={onClearAllFilters}
        >All</button>
        <button
          type="button"
          className={`mfr-chip${buildQueueSelectionActive ? " mfr-chip--active mfr-chip--bq" : ""}`}
          onClick={onSelectBuildQueueMaterials}
        >
          Queue
          {buildQueueMaterials.size > 0 && <span className="mfr-chip-count">{buildQueueMaterials.size}</span>}
        </button>
        <button
          type="button"
          className={`mfr-chip${showOnlyStarred ? " mfr-chip--active" : ""}`}
          onClick={onToggleStarred}
        >Starred</button>
      </div>

      <div className="mfb-divider" />

      {/* Materials group chip */}
      {totalMaterialCount > 0 && (
        <button
          type="button"
          className={`mfr-chip mfb-group-chip${selectedMaterialCount > 0 ? " mfr-chip--active" : ""}${materialDrawerOpen ? " mfb-group-chip--open" : ""}`}
          onClick={() => materialDrawerOpen ? onCloseDrawer() : onOpenDrawer("ship")}
        >
          Materials
          {selectedMaterialCount > 0
            ? <span className="mfr-chip-count">{selectedMaterialCount}</span>
            : <span className="mfb-group-total">{totalMaterialCount}</span>
          }
          <span className="mfb-chevron">{materialDrawerOpen ? "▲" : "▼"}</span>
        </button>
      )}

      {/* Search */}
      <div className="mfb-search-wrap">
        <input
          type="text"
          className="mfb-search"
          placeholder="Filter materials…"
          value={filterSearch}
          onChange={(e) => {
            onSetFilterSearch(e.target.value);
            if (e.target.value.trim() && !drawerOpen) onOpenDrawer("ship");
          }}
        />
      </div>

      <div className="mfb-spacer" />

      <button type="button" className="mfr-clear-btn" onClick={onClearAllFilters} disabled={!hasActiveFilters}>
        Clear
      </button>
    </div>
  );
}

export function MiningDrawer({
  drawerGroup,
  filterSearch,
  selectedMaterials,
  buildQueueSelectionActive,
  showOnlyStarred,
  queueScope,
  queueScopeCounts,
  shortfallLineCount,
  visibleResourceGroups,
  displayRankedFilteredLocationsCount,
  hasActiveFilters,
  onSetDrawerGroup,
  onSetFilterSearch,
  onSetQueueScope,
  onToggleMaterial,
  onSetSelectedMaterials,
  onSetBuildQueueSelectionActive,
}: {
  drawerGroup: "system" | "ship" | "vehicle" | "hand";
  filterSearch: string;
  selectedMaterials: Set<string>;
  buildQueueSelectionActive: boolean;
  showOnlyStarred: boolean;
  queueScope: MiningQueueScope;
  queueScopeCounts: Map<MiningQueueScope, number>;
  shortfallLineCount: number;
  visibleResourceGroups: ResourceGroups;
  displayRankedFilteredLocationsCount: number;
  hasActiveFilters: boolean;
  onSetDrawerGroup: (group: "ship" | "vehicle" | "hand") => void;
  onSetFilterSearch: (v: string) => void;
  onSetQueueScope: (scope: MiningQueueScope) => void;
  onToggleMaterial: (id: string) => void;
  onSetSelectedMaterials: (fn: (prev: Set<string>) => Set<string>) => void;
  onSetBuildQueueSelectionActive: (fn: (prev: boolean) => boolean) => void;
}) {
  const activeGroup: "ship" | "vehicle" | "hand" =
    drawerGroup === "vehicle" ? "vehicle" : drawerGroup === "hand" ? "hand" : "ship";

  function filterChips<T extends { label: string }>(chips: T[]): T[] {
    if (!filterSearch.trim()) return chips;
    const q = filterSearch.trim().toLowerCase();
    return chips.filter((c) => c.label.toLowerCase().includes(q));
  }

  const allGroupChips = [
    ...visibleResourceGroups.shipAndHarvestable,
    ...visibleResourceGroups.vehicle,
    ...visibleResourceGroups.hand.filter((c) => c.label.trim().toLowerCase() !== "pure carinite"),
  ];

  const selectedCount = allGroupChips.filter((c) => selectedMaterials.has(c.id)).length;
  const totalCount = allGroupChips.length;

  const shipChips = filterChips(visibleResourceGroups.shipAndHarvestable);
  const vehicleChips = filterChips(visibleResourceGroups.vehicle);
  const handChips = filterChips(
    visibleResourceGroups.hand.filter((c) => c.label.trim().toLowerCase() !== "pure carinite")
  );

  // When searching: show all matching chips across groups with sublabels
  // When not searching: show only the active group's chips
  const isSearching = Boolean(filterSearch.trim());

  return (
    <div className="mfb-drawer">

      {/* Left rail */}
      <div className="mfb-drawer-rail">
        {buildQueueSelectionActive && !showOnlyStarred && shortfallLineCount > 0 && (
          <>
            <span className="mining-filter-label" style={{ paddingLeft: "0.5rem" }}>Queue Scope</span>
            {MINING_QUEUE_SCOPES.map((scope) => {
              const count = queueScopeCounts.get(scope.value) ?? 0;
              return (
                <button
                  key={scope.value}
                  type="button"
                  className={`mfb-rail-btn${queueScope === scope.value ? " mfb-rail-btn--active" : ""}${count === 0 ? " mfb-rail-btn--disabled" : ""}`}
                  onClick={() => onSetQueueScope(scope.value)}
                  disabled={count === 0}
                  title={queueScopeDescription(scope.value, count, shortfallLineCount)}
                >
                  {scope.label}<span className="mfr-chip-count">{count}</span>
                </button>
              );
            })}
            <div className="mfb-drawer-rail-sep" />
          </>
        )}

        <span className="mining-filter-label" style={{ paddingLeft: "0.5rem" }}>Materials</span>
        {(["ship", "vehicle", "hand"] as const).map((group) => {
          const chips = group === "ship"
            ? visibleResourceGroups.shipAndHarvestable
            : group === "vehicle"
            ? visibleResourceGroups.vehicle
            : visibleResourceGroups.hand.filter((c) => c.label.trim().toLowerCase() !== "pure carinite");
          const sel = chips.filter((c) => selectedMaterials.has(c.id)).length;
          const lbl = group === "ship" ? "Ship" : group === "vehicle" ? "Vehicle" : "Hand";
          if (chips.length === 0) return null;
          return (
            <button
              key={group}
              type="button"
              className={`mfb-rail-btn${activeGroup === group && !isSearching ? " mfb-rail-btn--active" : ""}`}
              onClick={() => { onSetDrawerGroup(group); onSetFilterSearch(""); }}
            >
              {lbl}{sel > 0 && <span className="mfr-chip-count">{sel}</span>}
            </button>
          );
        })}
      </div>

      {/* Center chip area */}
      <div className="mfb-drawer-chips">
        {isSearching ? (
          <>
            {shipChips.length > 0 && <span className="mfb-sublabel">Ship</span>}
            {shipChips.map((chip) => (
              <button key={chip.id} type="button"
                className={`mfr-chip${selectedMaterials.has(chip.id) ? " mfr-chip--active" : ""}`}
                onClick={() => onToggleMaterial(chip.id)}
              >{chip.label}</button>
            ))}
            {vehicleChips.length > 0 && <span className="mfb-sublabel">Vehicle</span>}
            {vehicleChips.map((chip) => (
              <button key={chip.id} type="button"
                className={`mfr-chip${selectedMaterials.has(chip.id) ? " mfr-chip--active" : ""}`}
                onClick={() => onToggleMaterial(chip.id)}
              >{chip.label}</button>
            ))}
            {handChips.length > 0 && <span className="mfb-sublabel">Hand</span>}
            {handChips.map((chip) => (
              <button key={chip.id} type="button"
                className={`mfr-chip${selectedMaterials.has(chip.id) ? " mfr-chip--active" : ""}`}
                onClick={() => onToggleMaterial(chip.id)}
              >{chip.label}</button>
            ))}
            {shipChips.length === 0 && vehicleChips.length === 0 && handChips.length === 0 && (
              <span className="mfb-sublabel">No materials match</span>
            )}
          </>
        ) : (
          <>
            {activeGroup === "ship" && visibleResourceGroups.shipAndHarvestable.map((chip) => (
              <button key={chip.id} type="button"
                className={`mfr-chip${selectedMaterials.has(chip.id) ? " mfr-chip--active" : ""}`}
                onClick={() => onToggleMaterial(chip.id)}
              >{chip.label}</button>
            ))}
            {activeGroup === "vehicle" && visibleResourceGroups.vehicle.map((chip) => (
              <button key={chip.id} type="button"
                className={`mfr-chip${selectedMaterials.has(chip.id) ? " mfr-chip--active" : ""}`}
                onClick={() => onToggleMaterial(chip.id)}
              >{chip.label}</button>
            ))}
            {activeGroup === "hand" && visibleResourceGroups.hand
              .filter((c) => c.label.trim().toLowerCase() !== "pure carinite")
              .map((chip) => (
                <button key={chip.id} type="button"
                  className={`mfr-chip${selectedMaterials.has(chip.id) ? " mfr-chip--active" : ""}`}
                  onClick={() => onToggleMaterial(chip.id)}
                >{chip.label}</button>
              ))}
          </>
        )}
      </div>

      {/* Right summary */}
      <div className="mfb-drawer-summary">
        <div className="mfb-summary-count">
          <span className="mfb-summary-num">{selectedCount}</span>
          <span className="mfb-summary-of">/ {totalCount}</span>
        </div>
        <div className="mfb-summary-label">Materials selected</div>
        {selectedCount > 0 && (
          <button
            type="button"
            className="mfb-summary-action"
            onClick={() => {
              onSetSelectedMaterials((prev) => {
                const next = new Set(prev);
                allGroupChips.forEach((c) => next.delete(c.id));
                if (next.size === 0) onSetBuildQueueSelectionActive(() => false);
                return next;
              });
            }}
          >Clear all</button>
        )}
        {selectedCount < totalCount && (
          <button
            type="button"
            className="mfb-summary-action mfb-summary-action--all"
            onClick={() => onSetSelectedMaterials((prev) => new Set([...prev, ...allGroupChips.map((c) => c.id)]))}
          >Select all</button>
        )}
        {displayRankedFilteredLocationsCount === 0 && hasActiveFilters && (
          <div className="mfb-summary-warn">No locations match</div>
        )}
      </div>

    </div>
  );
}
