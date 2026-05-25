import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { buildRecommendationRequest, getMiningRecommendations } from "../../../features/mining/recommenderAdapter";
import { type MiningCoverageMode } from "../../../features/mining/coveragePlan";
import { useMiningPlannerState } from "../../../features/mining/useMiningPlannerState";
import { loadStantonLagrangeChildrenData } from "../../../features/locations/stantonLagrangeChildren";
import type { RequiredMaterial } from "../../../features/mining/types";
import { canonicalMiningMaterial, canonicalMiningMaterialKey } from "../../../features/mining/materialIdentity";
import { loadStaticMiningIndex, type StaticMiningIndex } from "../../../features/mining/staticMiningIndex";
import "./mining.css";
import { loadManifest, type PlanetAsset } from "../../../features/mining/planetAssets";
import { useLogisticsStore } from "../../../stores/logisticsStore";
import { getQueueLedgerModel } from "../../../lib/logistics/queueLedger";
import { buildResourceGroups } from "../shared/msbResourceGroups";
import {
  EMPTY_MINING_SIDEBAR_STATE,
  MINING_COVERAGE_MODES,
  MINING_COVERAGE_MODE_STORAGE_KEY,
  MINING_FILTER_STORAGE_KEY,
  MINING_QUEUE_FOCUS_STORAGE_KEY,
  MINING_QUEUE_SCOPES,
  MINING_QUEUE_SCOPE_STORAGE_KEY,
  MINING_RANKING_MODE_STORAGE_KEY,
  readStoredCoverageMode,
  readStoredQueueFocus,
  readStoredQueueScope,
  readStoredRankingMode,
  readStoredSidebarState,
  writeStoredSidebarState,
  queueScopeMatches,
  type LoadState,
  type MiningQueueScope,
  type MiningRankingMode,
  type MiningSidebarState,
} from "./miningTypes";
import { isIndexableMiningResource } from "./miningScoring";
import { getLocationCardKey, buildQueueFocusLabel, materialKeyOf } from "./miningFormatters";
import { useMiningLocations } from "./useMiningLocations";
import { MiningFilterBar, MiningDrawer } from "./MiningFilterBar";
import { LocationListItem } from "./LocationListItem";
import { LocationDetail, CoveragePlanSummaryPanel } from "./LocationDetail";

const debugMiningIdentity = Boolean(
  import.meta.env.DEV &&
  typeof localStorage !== "undefined" &&
  localStorage.getItem("debug:mining-materials") === "1"
);

export default function MiningModule() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [staticMiningIndex, setStaticMiningIndex] = useState<StaticMiningIndex | null>(null);
  const [planetAssetMap, setPlanetAssetMap] = useState<Map<string, PlanetAsset> | null>(null);
  const recommendationRequestSeqRef = useRef(0);
  const [, setLagrangeChildrenDataVersion] = useState(0);
  const planner = useMiningPlannerState();
  const [rankingMode] = useState<MiningRankingMode>(() => readStoredRankingMode());
  const [coverageMode, setCoverageMode] = useState<MiningCoverageMode>(() => readStoredCoverageMode());
  const [queueScope, setQueueScope] = useState<MiningQueueScope>(() => readStoredQueueScope());
  const [queueFocusItemId, setQueueFocusItemId] = useState<string>(() => readStoredQueueFocus());
  const previousQueueFocusItemIdRef = useRef(queueFocusItemId);
  const buildQueue = useLogisticsStore((store) => store.buildQueue);
  const recipeInputsByRecipeId = useLogisticsStore((store) => store.recipeInputTemplates);
  const inventoryEntries = useLogisticsStore((store) => store.inventoryEntries);
  const materials = useLogisticsStore((store) => store.materialTemplates);

  const initialSidebarState = useMemo(() => readStoredSidebarState(MINING_FILTER_STORAGE_KEY, EMPTY_MINING_SIDEBAR_STATE), []);
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(() => {
    const canonical = initialSidebarState.resources
      .map((r) => canonicalMiningMaterial({ id: r, label: r }))
      .filter((r) => !r.unresolvedUuid)
      .map((r) => r.key);
    return new Set(canonical);
  });
  const [selectedSystems, setSelectedSystems] = useState<Set<string>>(() => new Set(initialSidebarState.systems));
  const [selectedMiningTypes] = useState<Set<string>>(() => new Set(initialSidebarState.miningTypes));
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(null);
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [buildQueueSelectionActive, setBuildQueueSelectionActive] = useState(initialSidebarState.buildQueueActive);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerGroup, setDrawerGroup] = useState<"system" | "ship" | "vehicle" | "hand">("ship");
  const [filterSearch, setFilterSearch] = useState("");

  // Persist settings
  useEffect(() => { try { localStorage.setItem(MINING_RANKING_MODE_STORAGE_KEY, rankingMode); } catch { /* ignore */ } }, [rankingMode]);
  useEffect(() => { try { localStorage.setItem(MINING_COVERAGE_MODE_STORAGE_KEY, coverageMode); } catch { /* ignore */ } }, [coverageMode]);
  useEffect(() => { try { localStorage.setItem(MINING_QUEUE_SCOPE_STORAGE_KEY, queueScope); } catch { /* ignore */ } }, [queueScope]);
  useEffect(() => { try { if (queueFocusItemId) localStorage.setItem(MINING_QUEUE_FOCUS_STORAGE_KEY, queueFocusItemId); else localStorage.removeItem(MINING_QUEUE_FOCUS_STORAGE_KEY); } catch { /* ignore */ } }, [queueFocusItemId]);

  useEffect(() => {
    let cancelled = false;
    loadStaticMiningIndex().then((index) => { if (!cancelled) setStaticMiningIndex(index); }).catch((e) => { if (import.meta.env.DEV) console.warn("[mining] static index failed", e); });
    loadStantonLagrangeChildrenData().then(() => { if (!cancelled) setLagrangeChildrenDataVersion((v) => v + 1); }).catch(() => {});
    loadManifest().then((map) => { if (!cancelled) setPlanetAssetMap(map); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Build queue / demand pipeline
  const queueFocusOptions = useMemo(() => buildQueue.filter((item) => item.status !== "complete"), [buildQueue]);
  useEffect(() => { if (queueFocusItemId && !queueFocusOptions.some((item) => item.id === queueFocusItemId)) setQueueFocusItemId(""); }, [queueFocusItemId, queueFocusOptions]);
  useEffect(() => {
    if (!buildQueueSelectionActive) return;
    if (previousQueueFocusItemIdRef.current === queueFocusItemId) return;
    previousQueueFocusItemIdRef.current = queueFocusItemId;
    setQueueScope("all-shortfalls");
  }, [buildQueueSelectionActive, queueFocusItemId]);

  const focusedBuildQueue = useMemo(() => buildQueueSelectionActive && queueFocusItemId ? buildQueue.filter((item) => item.id === queueFocusItemId) : buildQueue, [buildQueue, buildQueueSelectionActive, queueFocusItemId]);
  const queueLedger = useMemo(() => getQueueLedgerModel({ buildQueue: focusedBuildQueue, inventoryEntries, materials, recipeInputsByRecipeId }), [focusedBuildQueue, inventoryEntries, materials, recipeInputsByRecipeId]);
  const scopedShortfallLines = useMemo(() => queueLedger.refinedShortfallLines.filter((line) => queueScopeMatches(line, queueScope)), [queueLedger.refinedShortfallLines, queueScope]);
  const queueScopeCounts = useMemo(() => new Map(MINING_QUEUE_SCOPES.map((s) => [s.value, queueLedger.refinedShortfallLines.filter((l) => queueScopeMatches(l, s.value)).length])), [queueLedger.refinedShortfallLines]);

  const miningRequiredMaterials = useMemo<RequiredMaterial[]>(() => {
    const requirements = scopedShortfallLines.map((line) => {
      const miningTargetQuantity = line.isRefinable ? line.rawOreNeeded : line.netMissingRefined;
      const canonical = canonicalMiningMaterial({ materialKey: line.materialKey, materialId: line.materialId, displayName: line.displayName, materialName: line.displayName });
      return { materialKey: canonical.key, materialId: canonical.key, displayName: canonical.label, materialName: canonical.label, quantity: miningTargetQuantity, originalRequiredQuantity: line.grossRequired, requiredQuantity: miningTargetQuantity, estimatedRawOreNeeded: line.isRefinable ? line.rawOreNeeded : undefined, unitType: line.unitType, usedBy: [], slots: [] };
    }).filter((r) => r.requiredQuantity > 0);
    if (debugMiningIdentity) { console.groupCollapsed("[mining] build queue raw ore requirements"); console.debug("queue ledger", queueLedger); console.debug("mining targets", requirements); console.groupEnd(); }
    return requirements;
  }, [queueLedger, scopedShortfallLines]);

  const buildQueueMaterials = useMemo(() => new Set(miningRequiredMaterials.map(materialKeyOf)), [miningRequiredMaterials]);
  const buildQueueMaterialsKey = [...buildQueueMaterials].sort().join(",");
  useEffect(() => { if (!buildQueueSelectionActive || buildQueueMaterials.size === 0) return; setSelectedMaterials((prev) => new Set([...prev, ...buildQueueMaterials])); }, [buildQueueMaterialsKey, buildQueueSelectionActive]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { writeStoredSidebarState<MiningSidebarState>(MINING_FILTER_STORAGE_KEY, { buildQueueActive: buildQueueSelectionActive, systems: [...selectedSystems], miningTypes: [...selectedMiningTypes], resources: [...selectedMaterials] }); }, [buildQueueSelectionActive, selectedMaterials, selectedMiningTypes, selectedSystems]);

  const activeBuildQueueMaterialKeys = useMemo(() => buildQueueSelectionActive ? buildQueueMaterials : new Set<string>(), [buildQueueMaterials, buildQueueSelectionActive]);
  const activeBuildQueueDemandMaterials = useMemo(() => buildQueueSelectionActive ? miningRequiredMaterials : [], [buildQueueSelectionActive, miningRequiredMaterials]);

  // Material resource list (for filter chips)
  const allMaterialResources = useMemo(() => {
    const byKey = new Map<string, { id: string; label: string; miningType?: string }>();
    for (const mat of materials) {
      if (!isIndexableMiningResource(mat.name)) continue;
      const sourceGroups = (mat as { sourceGroups?: string[] }).sourceGroups;
      let miningType: string | undefined;
      if (sourceGroups?.includes("vehicleMining")) miningType = "Ground Vehicle";
      else if (sourceGroups?.includes("fpsMining")) miningType = "Hand";
      else if (sourceGroups?.includes("ores")) miningType = "Ship";
      const canonical = canonicalMiningMaterial({ materialId: mat.id, displayName: mat.name, materialName: mat.name });
      if (!canonical.key || canonical.unresolvedUuid) continue;
      byKey.set(canonical.key, { id: canonical.key, label: canonical.label, miningType });
    }
    for (const req of miningRequiredMaterials) {
      const canonical = canonicalMiningMaterial({ materialKey: req.materialKey, materialId: req.materialId, displayName: req.displayName, materialName: req.materialName });
      if (!canonical.unresolvedUuid && !byKey.has(canonical.key) && isIndexableMiningResource(canonical.label)) byKey.set(canonical.key, { id: canonical.key, label: canonical.label });
    }
    for (const demand of planner.manualDemand) {
      const canonical = canonicalMiningMaterial({ materialKey: (demand as { materialKey?: string }).materialKey, materialId: (demand as { materialId?: string }).materialId, displayName: (demand as { displayName?: string }).displayName, materialName: demand.materialName });
      if (!canonical.unresolvedUuid && canonical.key && !byKey.has(canonical.key) && isIndexableMiningResource(canonical.label)) byKey.set(canonical.key, { id: canonical.key, label: canonical.label });
    }
    for (const resource of staticMiningIndex?.materialResources ?? []) {
      if (!resource.id || byKey.has(resource.id) || !isIndexableMiningResource(resource.label)) continue;
      byKey.set(resource.id, resource);
    }
    return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [materials, miningRequiredMaterials, planner.manualDemand, staticMiningIndex]);

  const allMaterials = useMemo(() => allMaterialResources.map((r) => r.label), [allMaterialResources]);
  const materialOptionByKey = useMemo(() => new Map(allMaterialResources.map((r) => [r.id, r])), [allMaterialResources]);

  const migrationDoneRef = useRef(false);
  useEffect(() => {
    if (migrationDoneRef.current || materialOptionByKey.size === 0) return;
    migrationDoneRef.current = true;
    setSelectedMaterials((prev) => {
      const cleaned = new Set([...prev].map((key) => canonicalMiningMaterial({ id: key, label: key })).filter((m) => !m.unresolvedUuid && materialOptionByKey.has(m.key)).map((m) => m.key));
      return cleaned.size === prev.size && [...cleaned].every((key) => prev.has(key)) ? prev : cleaned;
    });
  }, [materialOptionByKey]);

  const resourceGroups = useMemo(() => buildResourceGroups(allMaterialResources), [allMaterialResources]);
  const visibleResourceGroups = useMemo(() => {
    if (!buildQueueSelectionActive || buildQueueMaterials.size === 0) return resourceGroups;
    const keep = <T extends { id: string }>(chips: T[]) => chips.filter((c) => buildQueueMaterials.has(c.id));
    return { shipAndHarvestable: keep(resourceGroups.shipAndHarvestable), vehicle: keep(resourceGroups.vehicle), hand: keep(resourceGroups.hand) };
  }, [buildQueueMaterials, buildQueueSelectionActive, resourceGroups]);

  const sidebarOnlyMaterials = useMemo<RequiredMaterial[]>(() => {
    const bqKeys = new Set(miningRequiredMaterials.map(materialKeyOf));
    return [...selectedMaterials].filter((key) => !bqKeys.has(key)).map((key) => {
      const canonical = canonicalMiningMaterial({ materialKey: key, displayName: materialOptionByKey.get(key)?.label, materialName: materialOptionByKey.get(key)?.label });
      return { materialId: canonical.key, materialKey: canonical.key, materialName: canonical.label, displayName: canonical.label, requiredQuantity: 1, usedBy: [], slots: [] };
    });
  }, [materialOptionByKey, miningRequiredMaterials, selectedMaterials]);

  const recommenderRequiredMaterials = useMemo(() => [...(buildQueueSelectionActive ? miningRequiredMaterials : []), ...sidebarOnlyMaterials], [buildQueueSelectionActive, miningRequiredMaterials, sidebarOnlyMaterials]);
  const favoriteLocationIds = useMemo(() => planner.favorites.map((f) => f.key), [planner.favorites]);

  // Recommendation fetch
  const recommendationRequestKey = useMemo(() => JSON.stringify({
    materials: recommenderRequiredMaterials.map((m) => ({ key: m.materialKey ?? m.materialId, qty: m.requiredQuantity })),
    favorites: favoriteLocationIds,
    filters: planner.filters,
    rankingMode,
    priorityStack: planner.priorityStack.map((p) => p.id),
    manualDemand: planner.manualDemand.map((d) => d.id),
  }), [recommenderRequiredMaterials, favoriteLocationIds, planner.filters, rankingMode, planner.priorityStack, planner.manualDemand]);

  const recommendationRequestRef = useRef(buildRecommendationRequest({ priorityStack: planner.priorityStack, manualDemand: planner.manualDemand, favoriteLocationIds, filters: planner.filters }, null, recommenderRequiredMaterials, rankingMode));
  const recommendationRequestKeyRef = useRef<string | null>(null);
  if (recommendationRequestKeyRef.current !== recommendationRequestKey) {
    recommendationRequestKeyRef.current = recommendationRequestKey;
    recommendationRequestRef.current = buildRecommendationRequest({ priorityStack: planner.priorityStack, manualDemand: planner.manualDemand, favoriteLocationIds, filters: planner.filters }, null, recommenderRequiredMaterials, rankingMode);
  }

  useEffect(() => {
    const controller = new AbortController();
    const requestSeq = ++recommendationRequestSeqRef.current;
    setState((prev) => prev.status === "loading" ? prev : { status: "loading", data: "data" in prev ? prev.data : undefined });
    getMiningRecommendations(recommendationRequestRef.current, controller.signal)
      .then((data) => { if (requestSeq !== recommendationRequestSeqRef.current) return; setState({ status: "loaded", data }); })
      .catch((err) => { if (controller.signal.aborted || requestSeq !== recommendationRequestSeqRef.current) return; setState((prev) => ({ status: "error", message: String(err), data: "data" in prev ? prev.data : undefined })); });
    return () => controller.abort();
  }, [recommendationRequestKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const recommendationData = "data" in state ? state.data : undefined;
  const locations = useMemo(() => recommendationData ? [...recommendationData.recommendations].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) : [], [recommendationData]);
  const hasRecommendationData = recommendationData !== undefined;

  const materialFilterKeys = useMemo(() => buildQueueSelectionActive ? buildQueueMaterials : selectedMaterials, [buildQueueMaterials, buildQueueSelectionActive, selectedMaterials]);

  // All location filtering/ranking in one hook
  const { locationMaterialKeysByLocationKey, displayRankedFilteredLocations, coveragePlan, unfilteredCoveragePlan, coveragePlanLocationByKey, selectedEntry } = useMiningLocations({
    locations,
    loadingState: state.status,
    selectedSystems,
    selectedMiningTypes,
    materialFilterKeys,
    activeBuildQueueMaterialKeys,
    activeBuildQueueDemandMaterials,
    sidebarOnlyMaterials,
    buildQueueSelectionActive,
    coverageMode,
    rankingMode,
    selectedLocationKey,
    staticMiningIndex,
    materials,
    allMaterials,
    planner,
  });

  const listLocations = showAllLocations ? displayRankedFilteredLocations : displayRankedFilteredLocations.slice(0, 12);

  useEffect(() => { setSelectedLocationKey(null); }, [selectedMaterials, selectedSystems, selectedMiningTypes]);

  // Filter handlers
  function toggleMaterial(id: string) {
    const key = canonicalMiningMaterialKey(id);
    setSelectedMaterials((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); if (next.size === 0) setBuildQueueSelectionActive(false); return next; });
  }
  function toggleSystem(sys: string) {
    setSelectedSystems((prev) => { const next = new Set(prev); if (next.has(sys)) next.delete(sys); else next.add(sys); return next; });
  }
  function selectBuildQueueMaterials() {
    setBuildQueueSelectionActive((active) => { if (active) return false; if (planner.filters.showOnlyStarred) planner.toggleShowOnlyStarred(); setQueueScope("all-shortfalls"); setSelectedMaterials((prev) => new Set([...prev, ...buildQueueMaterials])); return true; });
  }
  function clearAllFilters() {
    setBuildQueueSelectionActive(false);
    if (planner.filters.showOnlyStarred) planner.toggleShowOnlyStarred();
    setSelectedMaterials(new Set());
    setSelectedSystems(new Set());
  }

  const hasActiveFilters = selectedSystems.size > 0 || selectedMaterials.size > 0 || selectedMiningTypes.size > 0 || buildQueueSelectionActive;

  return (
    <div className="mine-page mine-page--v2">
      {hasRecommendationData && (
        <>
          <MiningFilterBar
            selectedSystems={selectedSystems}
            selectedMaterials={selectedMaterials}
            buildQueueSelectionActive={buildQueueSelectionActive}
            buildQueueMaterials={buildQueueMaterials}
            showOnlyStarred={planner.filters.showOnlyStarred}
            drawerOpen={drawerOpen}
            drawerGroup={drawerGroup}
            filterSearch={filterSearch}
            visibleResourceGroups={visibleResourceGroups}
            hasActiveFilters={hasActiveFilters}
            onToggleSystem={toggleSystem}
            onClearAllFilters={clearAllFilters}
            onSelectBuildQueueMaterials={selectBuildQueueMaterials}
            onToggleStarred={() => planner.toggleShowOnlyStarred()}
            onOpenDrawer={(group) => { setDrawerGroup(group); setDrawerOpen(true); setFilterSearch(""); }}
            onCloseDrawer={() => setDrawerOpen(false)}
            onSetFilterSearch={setFilterSearch}
          />

          {drawerOpen && (
            <MiningDrawer
              drawerGroup={drawerGroup}
              filterSearch={filterSearch}
              selectedMaterials={selectedMaterials}
              buildQueueSelectionActive={buildQueueSelectionActive}
              showOnlyStarred={planner.filters.showOnlyStarred}
              queueScope={queueScope}
              queueScopeCounts={queueScopeCounts}
              shortfallLineCount={queueLedger.refinedShortfallLines.length}
              visibleResourceGroups={visibleResourceGroups}
              displayRankedFilteredLocationsCount={displayRankedFilteredLocations.length}
              hasActiveFilters={hasActiveFilters}
              onSetDrawerGroup={(g) => { setDrawerGroup(g); setFilterSearch(""); }}
              onSetFilterSearch={setFilterSearch}
              onSetQueueScope={setQueueScope}
              onToggleMaterial={toggleMaterial}
              onSetSelectedMaterials={setSelectedMaterials}
              onSetBuildQueueSelectionActive={setBuildQueueSelectionActive}
            />
          )}

          <CoveragePlanSummaryPanel plan={coveragePlan} unfilteredPlan={unfilteredCoveragePlan} />

          {displayRankedFilteredLocations.length === 0 ? (
            <div className="mine-empty-state">
              <p className="mine-empty-text">{planner.filters.showOnlyStarred ? "No starred locations. Click ☆ on a location to star it." : "No locations match the current filters."}</p>
            </div>
          ) : (
            <div className="mconsole-layout">
              <div className="mlist-panel">
                <div className="mlist-header">
                  <span className="mlist-header-label">RECOMMENDED LOCATIONS</span>
                  <span className="mlist-header-count">{displayRankedFilteredLocations.length}</span>
                </div>
                <div className="mlist-header-rank">
                  {buildQueueSelectionActive && queueFocusOptions.length > 0 && (
                    <label className="mlist-focus-control">
                      <span>Priority Focus</span>
                      <select value={queueFocusItemId} onChange={(e) => setQueueFocusItemId(e.target.value)}>
                        <option value="">All queue items</option>
                        {queueFocusOptions.map((item) => <option key={item.id} value={item.id}>{buildQueueFocusLabel(item)}</option>)}
                      </select>
                    </label>
                  )}
                  {buildQueueSelectionActive && (
                    <div className="mlist-rank-toggle" role="group" aria-label="Coverage mode">
                      {MINING_COVERAGE_MODES.map((mode) => (
                        <button key={mode.value} type="button" className={`mlist-rank-btn${coverageMode === mode.value ? " is-active" : ""}`} aria-pressed={coverageMode === mode.value} onClick={() => setCoverageMode(mode.value)}>{mode.label}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mlist-items">
                  {listLocations.map((entry) => {
                    const plannedLocation = coveragePlanLocationByKey.get(entry.locationKey);
                    return (
                      <Fragment key={getLocationCardKey(entry)}>
                        <LocationListItem
                          rank={displayRankedFilteredLocations.findIndex((item) => item.locationKey === entry.locationKey) + 1}
                          entry={entry}
                          coveragePlanLocation={plannedLocation}
                          selectedMaterials={materialFilterKeys}
                          activeDemandMaterials={activeBuildQueueDemandMaterials}
                          buildQueueMaterialKeys={activeBuildQueueMaterialKeys}
                          locationMaterialKeys={locationMaterialKeysByLocationKey.get(entry.locationKey) ?? []}
                          staticMiningIndex={staticMiningIndex}
                          planetAssetMap={planetAssetMap}
                          starred={planner.isFavorite({ system: entry.systemName, location: entry.locationName, spawnType: entry.spawnType })}
                          selected={selectedEntry?.locationKey === entry.locationKey}
                          onSelect={() => setSelectedLocationKey(entry.locationKey)}
                          onToggleStar={(e) => { e.stopPropagation(); planner.toggleFavorite({ system: entry.systemName, location: entry.locationName, spawnType: entry.spawnType }); }}
                        />
                        {plannedLocation?.isCompletionLocation && <div className="mlist-stop-marker">Coverage complete above this line</div>}
                      </Fragment>
                    );
                  })}
                  {displayRankedFilteredLocations.length > 12 && (
                    <button type="button" className="mlist-view-all-btn" onClick={() => setShowAllLocations((p) => !p)}>
                      {showAllLocations ? "Show top 12 ↑" : `View all ${displayRankedFilteredLocations.length} locations ↓`}
                    </button>
                  )}
                </div>
              </div>

              <div className="mdet-col">
                {selectedEntry ? (
                  <LocationDetail entry={selectedEntry} activeDemandMaterials={buildQueueSelectionActive ? activeBuildQueueDemandMaterials : sidebarOnlyMaterials} buildQueueMaterialKeys={materialFilterKeys} locationMaterialKeys={locationMaterialKeysByLocationKey.get(selectedEntry.locationKey) ?? []} staticMiningIndex={staticMiningIndex} planetAssetMap={planetAssetMap} />
                ) : (
                  <div className="mdet-empty"><span>Select a location to view details</span></div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {state.status === "loading" && <div className="mine-status-state"><span className="mine-status-text">Loading recommendations…</span></div>}
      {state.status === "error" && <div className="mine-status-state mine-status-state--error"><span className="mine-status-text">Failed to load: {state.message}</span></div>}
    </div>
  );
}
