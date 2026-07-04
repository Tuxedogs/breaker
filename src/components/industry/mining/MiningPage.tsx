import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { buildRecommendationRequest, getMiningRecommendations } from "../../../features/mining/recommenderAdapter";
import { type MiningCoverageMode } from "../../../features/mining/coveragePlan";
import { useMiningPlannerState } from "../../../features/mining/useMiningPlannerState";
import { loadStantonLagrangeChildrenData } from "../../../features/locations/stantonLagrangeChildren";
import type { RequiredMaterial } from "../../../features/mining/types";
import { canonicalMiningMaterial, canonicalMiningMaterialKey } from "../../../features/mining/materialIdentity";
import { getStaticMethodBiasForLocation, loadStaticMiningIndex, type StaticMiningIndex } from "../../../features/mining/staticMiningIndex";
import "./mining.css";
import "../crafting/recipe-browser.css";
import { loadManifest } from "../../../features/mining/planetAssets";
import type { PlanetAsset } from "../../../features/mining/planetAssets";
import { useLogisticsStore } from "../../../stores/logisticsStore";
import { getQueueLedgerModel } from "../../../lib/logistics/queueLedger";
import { buildResourceGroups } from "../shared/msbResourceGroups";
import {
  EMPTY_MINING_SIDEBAR_STATE,
  MINING_COVERAGE_MODES,
  MINING_COVERAGE_MODE_STORAGE_KEY,
  MINING_FILTER_STORAGE_KEY,
  MINING_QUEUE_FOCUS_STORAGE_KEY,
  MINING_QUEUE_SCOPE_STORAGE_KEY,
  MINING_RANKING_MODE_STORAGE_KEY,
  MINING_SYSTEM_FILTERS,
  readStoredCoverageMode,
  readStoredQueueFocus,
  readStoredQueueScope,
  readStoredRankingMode,
  readStoredSidebarState,
  writeStoredSidebarState,
  queueScopeMatches,
  type LoadState,
  type MiningEncounterTier,
  type MiningQueueScope,
  type MiningRankingMode,
  type MiningSidebarState,
} from "./miningTypes";
import { isIndexableMiningResource } from "./miningScoring";
import { getLocationCardKey, buildQueueFocusLabel, materialKeyOf } from "./miningFormatters";
import { useMiningLocations } from "./useMiningLocations";
import { MiningFilterBar } from "./MiningFilterBar";
import { LocationListItem } from "./LocationListItem";
import { LocationDetail } from "./LocationDetail";

const DEFAULT_VISIBLE_LOCATIONS = 12;
const MIN_VISIBLE_ROUTE_LOCATIONS = 8;
const DEFAULT_MINING_SYSTEM = "Stanton";
const SYSTEM_SELECTOR_ORDER = ["Stanton", "Pyro", "Nyx"];
const SYSTEM_DESCRIPTIONS: Record<string, string> = {
  Stanton: "The Federation's economic and industrial core. Rich in minerals and diverse geological compositions.",
  Pyro: "A volatile frontier system with harsh worlds, sparse infrastructure, and high-value mineral routes.",
  Nyx: "A remote system of rugged worlds and hidden belts, favored by careful surveyors and small crews.",
};

const debugMiningIdentity = Boolean(
  import.meta.env.DEV &&
  typeof localStorage !== "undefined" &&
  localStorage.getItem("debug:mining-materials") === "1"
);

function useIsMobileMiningViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isMobile;
}

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
  const [selectedSystems, setSelectedSystems] = useState<Set<string>>(() => new Set(initialSidebarState.systems.length > 0 ? initialSidebarState.systems : [DEFAULT_MINING_SYSTEM]));
  const [selectedMiningTypes, setSelectedMiningTypes] = useState<Set<string>>(() => new Set(initialSidebarState.miningTypes));
  const [selectedEncounterTiers, setSelectedEncounterTiers] = useState<Set<MiningEncounterTier>>(() => new Set(initialSidebarState.encounterTiers ?? []));
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(null);
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [buildQueueSelectionActive, setBuildQueueSelectionActive] = useState(initialSidebarState.buildQueueActive);
  const isMobileViewport = useIsMobileMiningViewport();

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
  useEffect(() => {
    if (!queueFocusItemId || queueFocusOptions.some((item) => item.id === queueFocusItemId)) return;
    queueMicrotask(() => setQueueFocusItemId(""));
  }, [queueFocusItemId, queueFocusOptions]);
  useEffect(() => {
    if (!buildQueueSelectionActive) return;
    if (previousQueueFocusItemIdRef.current === queueFocusItemId) return;
    previousQueueFocusItemIdRef.current = queueFocusItemId;
    queueMicrotask(() => setQueueScope("all-shortfalls"));
  }, [buildQueueSelectionActive, queueFocusItemId]);

  const focusedBuildQueue = useMemo(() => buildQueueSelectionActive && queueFocusItemId ? buildQueue.filter((item) => item.id === queueFocusItemId) : buildQueue, [buildQueue, buildQueueSelectionActive, queueFocusItemId]);
  const queueLedger = useMemo(() => getQueueLedgerModel({ buildQueue: focusedBuildQueue, inventoryEntries, materials, recipeInputsByRecipeId }), [focusedBuildQueue, inventoryEntries, materials, recipeInputsByRecipeId]);
  const scopedShortfallLines = useMemo(() => queueLedger.refinedShortfallLines.filter((line) => queueScopeMatches(line, queueScope)), [queueLedger.refinedShortfallLines, queueScope]);

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
  useEffect(() => {
    if (!buildQueueSelectionActive || buildQueueMaterials.size === 0) return;
    queueMicrotask(() => setSelectedMaterials((prev) => new Set([...prev, ...buildQueueMaterials])));
  }, [buildQueueMaterials, buildQueueMaterialsKey, buildQueueSelectionActive]);
  useEffect(() => { writeStoredSidebarState<MiningSidebarState>(MINING_FILTER_STORAGE_KEY, { buildQueueActive: buildQueueSelectionActive, systems: [...selectedSystems], miningTypes: [...selectedMiningTypes], encounterTiers: [...selectedEncounterTiers], resources: [...selectedMaterials] }); }, [buildQueueSelectionActive, selectedEncounterTiers, selectedMaterials, selectedMiningTypes, selectedSystems]);

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
    queueMicrotask(() => setSelectedMaterials((prev) => {
      const cleaned = new Set([...prev].map((key) => canonicalMiningMaterial({ id: key, label: key })).filter((m) => !m.unresolvedUuid && materialOptionByKey.has(m.key)).map((m) => m.key));
      return cleaned.size === prev.size && [...cleaned].every((key) => prev.has(key)) ? prev : cleaned;
    }));
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

  const recommendationRequest = useMemo(
    () => buildRecommendationRequest({ priorityStack: planner.priorityStack, manualDemand: planner.manualDemand, favoriteLocationIds, filters: planner.filters }, null, recommenderRequiredMaterials, rankingMode),
    [favoriteLocationIds, planner.filters, planner.manualDemand, planner.priorityStack, rankingMode, recommenderRequiredMaterials],
  );

  useEffect(() => {
    const controller = new AbortController();
    const requestSeq = ++recommendationRequestSeqRef.current;
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setState((prev) => prev.status === "loading" ? prev : { status: "loading", data: "data" in prev ? prev.data : undefined });
      }
    });
    getMiningRecommendations(recommendationRequest, controller.signal)
      .then((data) => { if (requestSeq !== recommendationRequestSeqRef.current) return; setState({ status: "loaded", data }); })
      .catch((err) => { if (controller.signal.aborted || requestSeq !== recommendationRequestSeqRef.current) return; setState((prev) => ({ status: "error", message: String(err), data: "data" in prev ? prev.data : undefined })); });
    return () => controller.abort();
  }, [recommendationRequest, recommendationRequestKey]);

  const recommendationData = "data" in state ? state.data : undefined;
  const locations = useMemo(() => recommendationData ? [...recommendationData.recommendations].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) : [], [recommendationData]);
  const hasRecommendationData = recommendationData !== undefined;

  const materialFilterKeys = useMemo(() => buildQueueSelectionActive ? buildQueueMaterials : selectedMaterials, [buildQueueMaterials, buildQueueSelectionActive, selectedMaterials]);

  // All location filtering/ranking in one hook
  const { locationMaterialKeysByLocationKey, displayRankedFilteredLocations, coveragePlan, coveragePlanLocationByKey, selectedEntry } = useMiningLocations({
    locations,
    loadingState: state.status,
    selectedSystems,
    selectedMiningTypes,
    selectedEncounterTiers,
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

  const mobileQueueRouteLocations = useMemo(() => {
    if (!isMobileViewport || !buildQueueSelectionActive || !coveragePlan || showAllLocations) return null;
    const neededCount = coveragePlan.locations.filter((location) => !location.isAfterCompletion).length;
    const visibleCount = Math.min(coveragePlan.locations.length, Math.max(neededCount, MIN_VISIBLE_ROUTE_LOCATIONS));
    return coveragePlan.locations
      .slice(0, visibleCount)
      .map((location) => location.entry);
  }, [buildQueueSelectionActive, coveragePlan, isMobileViewport, showAllLocations]);

  const displayedRankedLocations = mobileQueueRouteLocations ?? displayRankedFilteredLocations;
  const mobileQueueDemandSatisfied = isMobileViewport && buildQueueSelectionActive && activeBuildQueueDemandMaterials.length === 0;
  const mobileHiddenAlternateCount = useMemo(() => {
    if (!isMobileViewport || !buildQueueSelectionActive || !coveragePlan || showAllLocations) return 0;
    const neededCount = coveragePlan.locations.filter((location) => !location.isAfterCompletion).length;
    const visibleCount = Math.min(coveragePlan.locations.length, Math.max(neededCount, MIN_VISIBLE_ROUTE_LOCATIONS));
    return Math.max(0, coveragePlan.locations.length - visibleCount);
  }, [buildQueueSelectionActive, coveragePlan, isMobileViewport, showAllLocations]);

  const searchFilteredLocations = useMemo(() => {
    const q = locationSearch.trim().toLowerCase();
    if (!q) return displayedRankedLocations;
    return displayedRankedLocations.filter(
      (e) => e.locationName.toLowerCase().includes(q) || e.systemName.toLowerCase().includes(q)
    );
  }, [displayedRankedLocations, locationSearch]);

  const listLocations = mobileQueueDemandSatisfied
    ? []
    : showAllLocations ? searchFilteredLocations : searchFilteredLocations.slice(0, DEFAULT_VISIBLE_LOCATIONS);
  const explicitSelectedEntry = useMemo(() => {
    if (mobileQueueDemandSatisfied || !selectedLocationKey) return null;
    return searchFilteredLocations.find((entry) => entry.locationKey === selectedLocationKey) ?? null;
  }, [mobileQueueDemandSatisfied, searchFilteredLocations, selectedLocationKey]);
  const effectiveSelectedEntry = useMemo(() => {
    if (mobileQueueDemandSatisfied) return null;
    if (isMobileViewport) return explicitSelectedEntry;
    if (selectedLocationKey) {
      return explicitSelectedEntry ?? searchFilteredLocations[0] ?? null;
    }
    return searchFilteredLocations[0] ?? selectedEntry;
  }, [explicitSelectedEntry, isMobileViewport, mobileQueueDemandSatisfied, searchFilteredLocations, selectedEntry, selectedLocationKey]);

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedLocationKey(null);
      setLocationSearch("");
      setShowAllLocations(false);
    });
  }, [selectedEncounterTiers, selectedMaterials, selectedSystems, selectedMiningTypes, buildQueueSelectionActive]);

  // Filter handlers
  function toggleMaterial(id: string) {
    const key = canonicalMiningMaterialKey(id);
    setSelectedMaterials((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); if (next.size === 0) setBuildQueueSelectionActive(false); return next; });
  }
  function toggleSystem(sys: string) {
    setSelectedSystems(new Set([sys]));
  }
  function toggleMiningType(type: string) {
    setSelectedMiningTypes((prev) => { const next = new Set(prev); if (next.has(type)) next.delete(type); else next.add(type); return next; });
  }
  function toggleEncounterTier(tier: MiningEncounterTier) {
    setSelectedEncounterTiers((prev) => { const next = new Set(prev); if (next.has(tier)) next.delete(tier); else next.add(tier); return next; });
  }
  function selectBuildQueueMaterials() {
    setBuildQueueSelectionActive((active) => { if (active) return false; if (planner.filters.showOnlyStarred) planner.toggleShowOnlyStarred(); setQueueScope("all-shortfalls"); setSelectedMaterials((prev) => new Set([...prev, ...buildQueueMaterials])); return true; });
  }
  function clearAllFilters() {
    setBuildQueueSelectionActive(false);
    if (planner.filters.showOnlyStarred) planner.toggleShowOnlyStarred();
    setSelectedMaterials(new Set());
    setSelectedSystems(new Set([DEFAULT_MINING_SYSTEM]));
    setSelectedMiningTypes(new Set());
    setSelectedEncounterTiers(new Set());
  }
  function toggleSelectedLocation(locationKey: string) {
    if (!isMobileViewport) {
      setSelectedLocationKey(locationKey);
      return;
    }
    setSelectedLocationKey((current) => current === locationKey ? null : locationKey);
  }

  const hasActiveFilters = selectedSystems.size > 0
    || selectedMaterials.size > 0
    || selectedMiningTypes.size > 0
    || selectedEncounterTiers.size > 0
    || buildQueueSelectionActive
    || planner.filters.showOnlyStarred;

  const systemContextName = selectedSystems.size === 1 ? [...selectedSystems][0] : DEFAULT_MINING_SYSTEM;
  const systemContextLocations = searchFilteredLocations.length;
  const systemContextMaterials = useMemo(() => {
    const keys = new Set<string>();
    for (const entry of searchFilteredLocations) {
      for (const key of locationMaterialKeysByLocationKey.get(entry.locationKey) ?? []) keys.add(key);
    }
    return keys.size;
  }, [locationMaterialKeysByLocationKey, searchFilteredLocations]);
  const systemContextMethods = useMemo(() => {
    const methods = new Set<string>();
    for (const entry of searchFilteredLocations) {
      for (const item of getStaticMethodBiasForLocation(entry, staticMiningIndex)) {
        if (item.share > 0) methods.add(item.method);
      }
    }
    return methods.size;
  }, [searchFilteredLocations, staticMiningIndex]);
  const systemDescription = SYSTEM_DESCRIPTIONS[systemContextName] ?? "Indexed mining locations and material profiles for this system.";
  const orderedSystemFilters = useMemo(
    () => SYSTEM_SELECTOR_ORDER.filter((system) => MINING_SYSTEM_FILTERS.includes(system)),
    [],
  );

  return (
    <div className="mine-page mine-page--v2">
      {hasRecommendationData && (
        <>
          <div className="mine-body">
            <aside className="mine-filter-aside">
              <MiningFilterBar
                selectedMaterials={selectedMaterials}
                selectedMiningTypes={selectedMiningTypes}
                selectedEncounterTiers={selectedEncounterTiers}
                buildQueueSelectionActive={buildQueueSelectionActive}
                buildQueueMaterials={buildQueueMaterials}
                showOnlyStarred={planner.filters.showOnlyStarred}
                visibleResourceGroups={visibleResourceGroups}
                hasActiveFilters={hasActiveFilters}
                searchQuery={locationSearch}
                onToggleMiningType={toggleMiningType}
                onToggleEncounterTier={toggleEncounterTier}
                onClearAllFilters={clearAllFilters}
                onSelectBuildQueueMaterials={selectBuildQueueMaterials}
                onToggleStarred={() => planner.toggleShowOnlyStarred()}
                onToggleMaterial={toggleMaterial}
                onSearchChange={setLocationSearch}
                isMobileViewport={isMobileViewport}
              />
            </aside>

            <div className="mine-main">
              {mobileQueueDemandSatisfied ? (
                <div className="mine-empty-state mine-empty-state--queue-covered">
                  <p className="mine-empty-text">Inventory covers the current queue shortfalls. No mining route needed.</p>
                </div>
              ) : searchFilteredLocations.length === 0 ? (
                <div className="mine-empty-state">
                  <p className="mine-empty-text">{locationSearch ? `No locations match "${locationSearch}".` : planner.filters.showOnlyStarred ? "No bookmarked locations. Bookmark a location from the list." : "No locations match the current filters."}</p>
                  <button type="button" className="mlist-view-all-btn" onClick={clearAllFilters}>Clear filters</button>
                </div>
              ) : (
                <div className="mconsole-layout">
              <div className="mlist-panel">
                <div className="mine-browse-header">
                  <h1>Mining Locations</h1>
                  <p>Explore systems, locations and mineral compositions.</p>
                </div>
                <div className="mine-browse-section">
                  <span className="mine-browse-section-label">System</span>
                  <div className="mine-system-selector" role="group" aria-label="System filters">
                    {orderedSystemFilters.map((sys) => (
                      <button
                        key={sys}
                        type="button"
                        className={`mine-system-button${selectedSystems.has(sys) ? " is-active" : ""}`}
                        aria-pressed={selectedSystems.has(sys)}
                        onClick={() => toggleSystem(sys)}
                      >
                        {sys}
                      </button>
                    ))}
                  </div>
                </div>
                <section className="mine-system-card" aria-label="Browse System">
                  <div className="mine-system-card-main">
                    <div className={`mine-system-emblem mine-system-emblem--${systemContextName.toLowerCase()}`} aria-hidden="true">
                      <span>{systemContextName.slice(0, 1)}</span>
                    </div>
                    <div>
                      <span className="mine-system-card-label">Browse System</span>
                      <h2>{systemContextName}</h2>
                      <p>{systemDescription}</p>
                    </div>
                  </div>
                  <div className="mine-system-stats">
                    <span><strong>{systemContextLocations}</strong> Locations</span>
                    <span><strong>{systemContextMaterials}</strong> Materials</span>
                    <span><strong>{systemContextMethods}</strong> Methods</span>
                  </div>
                </section>
                <div className="mlist-header">
                  <span className="mlist-header-label">All Locations</span>
                  <span className="mlist-header-count">{searchFilteredLocations.length}</span>
                </div>
                <div className="mlist-header-rank">
                  {!buildQueueSelectionActive && (
                    <div className="mlist-mode-hint">
                      <span className="mlist-mode-hint-tip">Click a location to view details</span>
                    </div>
                  )}
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
                    const isSelected = effectiveSelectedEntry?.locationKey === entry.locationKey;
                    return (
                      <Fragment key={getLocationCardKey(entry)}>
                        <div
                          className={isMobileViewport && isSelected ? 'mlist-inline-stack mlist-inline-stack--expanded' : undefined}
                        >
                          <LocationListItem
                            entry={entry}
                            selectedMaterials={materialFilterKeys}
                            buildQueueMaterialKeys={activeBuildQueueMaterialKeys}
                            locationMaterialKeys={locationMaterialKeysByLocationKey.get(entry.locationKey) ?? []}
                            staticMiningIndex={staticMiningIndex}
                            planetAssetMap={planetAssetMap}
                            starred={planner.isFavorite({ system: entry.systemName, location: entry.locationName, spawnType: entry.spawnType })}
                            selected={isSelected}
                            onSelect={() => toggleSelectedLocation(entry.locationKey)}
                            onToggleStar={(e) => { e.stopPropagation(); planner.toggleFavorite({ system: entry.systemName, location: entry.locationName, spawnType: entry.spawnType }); }}
                          />
                          {isMobileViewport && isSelected && (
                            <div className="mlist-inline-detail">
                              <LocationDetail
                                entry={entry}
                                activeDemandMaterials={buildQueueSelectionActive ? activeBuildQueueDemandMaterials : sidebarOnlyMaterials}
                                buildQueueMaterialKeys={materialFilterKeys}
                                locationMaterialKeys={locationMaterialKeysByLocationKey.get(entry.locationKey) ?? []}
                                staticMiningIndex={staticMiningIndex}
                                planetAssetMap={planetAssetMap}
                                starred={planner.isFavorite({ system: entry.systemName, location: entry.locationName, spawnType: entry.spawnType })}
                                onToggleStar={(e) => { e.stopPropagation(); planner.toggleFavorite({ system: entry.systemName, location: entry.locationName, spawnType: entry.spawnType }); }}
                                hideHeader
                              />
                            </div>
                          )}
                        </div>
                        {plannedLocation?.isCompletionLocation && <div className="mlist-stop-marker">Coverage complete above this line</div>}
                      </Fragment>
                    );
                  })}
                  {mobileHiddenAlternateCount > 0 && (
                    <button type="button" className="mlist-view-all-btn" onClick={() => setShowAllLocations(true)}>
                      Show {mobileHiddenAlternateCount} alternates
                    </button>
                  )}
                  {showAllLocations && isMobileViewport && buildQueueSelectionActive && coveragePlan && (
                    <button type="button" className="mlist-view-all-btn" onClick={() => setShowAllLocations(false)}>
                      Show needed route
                    </button>
                  )}
                  {(!isMobileViewport || !buildQueueSelectionActive || !coveragePlan) && searchFilteredLocations.length > DEFAULT_VISIBLE_LOCATIONS && (
                    <button type="button" className="mlist-view-all-btn" onClick={() => setShowAllLocations((p) => !p)}>
                      {showAllLocations ? "Show top 12" : `View all ${searchFilteredLocations.length} locations`}
                    </button>
                  )}
                </div>
              </div>

              <div className="mdet-col">
                {!isMobileViewport && effectiveSelectedEntry ? (
                  <LocationDetail
                    entry={effectiveSelectedEntry}
                    activeDemandMaterials={buildQueueSelectionActive ? activeBuildQueueDemandMaterials : sidebarOnlyMaterials}
                    buildQueueMaterialKeys={materialFilterKeys}
                    locationMaterialKeys={locationMaterialKeysByLocationKey.get(effectiveSelectedEntry.locationKey) ?? []}
                    staticMiningIndex={staticMiningIndex}
                    planetAssetMap={planetAssetMap}
                    starred={planner.isFavorite({ system: effectiveSelectedEntry.systemName, location: effectiveSelectedEntry.locationName, spawnType: effectiveSelectedEntry.spawnType })}
                    onToggleStar={(e) => { e.stopPropagation(); planner.toggleFavorite({ system: effectiveSelectedEntry.systemName, location: effectiveSelectedEntry.locationName, spawnType: effectiveSelectedEntry.spawnType }); }}
                  />
                ) : !isMobileViewport ? (
                  <div className="mdet-empty"><span>Select a location to view details</span></div>
                ) : null}
              </div>
            </div>
              )}
            </div>
          </div>
        </>
      )}

      {state.status === "loading" && <div className="mine-status-state"><span className="mine-status-text">Loading recommendations…</span></div>}
      {state.status === "error" && <div className="mine-status-state mine-status-state--error"><span className="mine-status-text">Failed to load: {state.message}</span></div>}
    </div>
  );
}
