import { MINING_QUEUE_SCOPES, MINING_SYSTEM_FILTERS, type MiningQueueScope } from "./miningTypes";
import { queueScopeDescription, buildQueueFocusLabel } from "./miningFormatters";
import type { QueueLedgerLine } from "../../../lib/logistics/queueLedger";

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
  onSetDrawerGroup,
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
  onSetDrawerGroup: (group: "ship" | "vehicle" | "hand") => void;
  onSetFilterSearch: (v: string) => void;
}) {
  return (
    <div className={`mfb-bar${buildQueueSelectionActive ? " mfb-bar--queue" : ""}${drawerOpen ? " mfb-bar--open" : ""}`}>
      <span className="mining-filter-label">System</span>
      <div className="mfb-chips">
        {MINING_SYSTEM_FILTERS.map((sys) => (
          <button key={sys} type="button" className={`mfr-chip${selectedSystems.has(sys) ? " mfr-chip--active" : ""}`} onClick={() => onToggleSystem(sys)}>{sys}</button>
        ))}
      </div>
      <div className="mfb-divider" />
      <div className="mfb-chips">
        <button type="button" className={`mfr-chip${!buildQueueSelectionActive && selectedMaterials.size === 0 && !showOnlyStarred ? " mfr-chip--active" : ""}`} onClick={onClearAllFilters}>All</button>
        <button type="button" className={`mfr-chip${buildQueueSelectionActive ? " mfr-chip--active mfr-chip--bq" : ""}`} onClick={onSelectBuildQueueMaterials}>
          Queue
          {buildQueueMaterials.size > 0 && <span className="mfr-chip-count">{buildQueueMaterials.size}</span>}
        </button>
        <button type="button" className={`mfr-chip${showOnlyStarred ? " mfr-chip--active" : ""}`} onClick={onToggleStarred}>Starred</button>
      </div>
      <div className="mfb-divider" />
      {(["ship", "vehicle", "hand"] as const).map((group) => {
        const groupChips = group === "ship" ? visibleResourceGroups.shipAndHarvestable : group === "vehicle" ? visibleResourceGroups.vehicle : visibleResourceGroups.hand.filter((c) => c.label.trim().toLowerCase() !== "pure carinite");
        const selectedCount = groupChips.filter((c) => selectedMaterials.has(c.id)).length;
        const label = group === "ship" ? "Ship" : group === "vehicle" ? "Vehicle" : "Hand";
        if (groupChips.length === 0) return null;
        const isOpen = drawerOpen && drawerGroup === group;
        return (
          <button key={group} type="button" className={`mfr-chip mfb-group-chip${selectedCount > 0 ? " mfr-chip--active" : ""}${isOpen ? " mfb-group-chip--open" : ""}`}
            onClick={() => isOpen ? onCloseDrawer() : onOpenDrawer(group)}>
            {label}
            {selectedCount > 0 ? <span className="mfr-chip-count">{selectedCount}</span> : <span className="mfb-group-total">{groupChips.length}</span>}
            <span className="mfb-chevron">{isOpen ? "▲" : "▼"}</span>
          </button>
        );
      })}
      <div className="mfb-search-wrap">
        <input type="text" className="mfb-search" placeholder="Search materials…" value={filterSearch} onChange={(e) => { onSetFilterSearch(e.target.value); if (e.target.value.trim() && !drawerOpen) onOpenDrawer(drawerGroup as "ship" | "vehicle" | "hand"); }} />
      </div>
      <div className="mfb-spacer" />
      <button type="button" className="mfr-clear-btn" onClick={onClearAllFilters} disabled={!hasActiveFilters}>Clear</button>
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
  function isChipEnabled(chipKey: string, materialToLocations: Map<string, Set<string>>, selectedLocationIntersection: Set<string> | null): boolean {
    if (selectedMaterials.has(chipKey)) return true;
    if (selectedLocationIntersection === null) return true;
    if (selectedLocationIntersection.size === 0) return false;
    const chipLocs = materialToLocations.get(chipKey);
    if (!chipLocs) return false;
    for (const loc of selectedLocationIntersection) { if (chipLocs.has(loc)) return true; }
    return false;
  }

  const activeGroup = drawerGroup === "ship" || drawerGroup === "vehicle" || drawerGroup === "hand" ? drawerGroup : "ship";
  const groupChips = activeGroup === "ship" ? visibleResourceGroups.shipAndHarvestable : activeGroup === "vehicle" ? visibleResourceGroups.vehicle : visibleResourceGroups.hand.filter((c) => c.label.trim().toLowerCase() !== "pure carinite");
  const filteredChips = filterSearch.trim() ? groupChips.filter((c) => c.label.toLowerCase().includes(filterSearch.trim().toLowerCase())) : groupChips;
  const selectedCount = groupChips.filter((c) => selectedMaterials.has(c.id)).length;
  const groupLabel = activeGroup === "ship" ? "Ship Mineables" : activeGroup === "vehicle" ? "Vehicle" : "Hand";

  return (
    <div className="mfb-drawer">
      <div className="mfb-drawer-rail">
        {buildQueueSelectionActive && !showOnlyStarred && shortfallLineCount > 0 && (
          <>
            <span className="mining-filter-label" style={{ paddingLeft: "0.5rem" }}>Queue Scope</span>
            {MINING_QUEUE_SCOPES.map((scope) => {
              const count = queueScopeCounts.get(scope.value) ?? 0;
              return (
                <button key={scope.value} type="button" className={`mfb-rail-btn${queueScope === scope.value ? " mfb-rail-btn--active" : ""}${count === 0 ? " mfb-rail-btn--disabled" : ""}`} onClick={() => onSetQueueScope(scope.value)} disabled={count === 0} title={queueScopeDescription(scope.value, count, shortfallLineCount)}>
                  {scope.label}<span className="mfr-chip-count">{count}</span>
                </button>
              );
            })}
            <div className="mfb-drawer-rail-sep" />
          </>
        )}
        <span className="mining-filter-label" style={{ paddingLeft: "0.5rem" }}>Filter Group</span>
        {(["ship", "vehicle", "hand"] as const).map((group) => {
          const chips = group === "ship" ? visibleResourceGroups.shipAndHarvestable : group === "vehicle" ? visibleResourceGroups.vehicle : visibleResourceGroups.hand.filter((c) => c.label.trim().toLowerCase() !== "pure carinite");
          const sel = chips.filter((c) => selectedMaterials.has(c.id)).length;
          const lbl = group === "ship" ? "Ship Mineables" : group === "vehicle" ? "Vehicle" : "Hand";
          if (chips.length === 0) return null;
          return (
            <button key={group} type="button" className={`mfb-rail-btn${activeGroup === group ? " mfb-rail-btn--active" : ""}`} onClick={() => { onSetDrawerGroup(group); onSetFilterSearch(""); }}>
              {lbl}{sel > 0 && <span className="mfr-chip-count">{sel}</span>}
            </button>
          );
        })}
      </div>
      <div className="mfb-drawer-chips">
        {filteredChips.map((chip) => (
          <button key={chip.id} type="button" className={`mfr-chip${selectedMaterials.has(chip.id) ? " mfr-chip--active" : ""}`} onClick={() => onToggleMaterial(chip.id)}>
            {chip.label}
          </button>
        ))}
      </div>
      <div className="mfb-drawer-summary">
        <div className="mfb-summary-count">
          <span className="mfb-summary-num">{selectedCount}</span>
          <span className="mfb-summary-of">/ {groupChips.length}</span>
        </div>
        <div className="mfb-summary-label">{groupLabel} selected</div>
        {selectedCount > 0 && (
          <button type="button" className="mfb-summary-action" onClick={() => onSetSelectedMaterials((prev) => { const next = new Set(prev); groupChips.forEach((c) => next.delete(c.id)); if (next.size === 0) onSetBuildQueueSelectionActive(() => false); return next; })}>Clear group</button>
        )}
        {selectedCount < groupChips.length && (
          <button type="button" className="mfb-summary-action mfb-summary-action--all" onClick={() => onSetSelectedMaterials((prev) => new Set([...prev, ...groupChips.map((c) => c.id)]))}>Select all</button>
        )}
        {displayRankedFilteredLocationsCount === 0 && hasActiveFilters && (
          <div className="mfb-summary-warn">No locations match</div>
        )}
      </div>
    </div>
  );
}
