import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { buildIndexedDiscovery, buildRecommendationRequest, getMiningRecommendations } from "../../../features/mining/recommenderAdapter";
import { type MiningCoverageMode } from "../../../features/mining/coveragePlan";
import { useMiningPlannerState } from "../../../features/mining/useMiningPlannerState";
import { loadStantonLagrangeGroupData } from "../../../features/locations/stantonLagrangeChildren";
import type { RequiredMaterial } from "../../../features/mining/types";
import { canonicalMiningMaterial, canonicalMiningMaterialKey } from "../../../features/mining/materialIdentity";
import { loadStaticMiningIndex, type StaticMiningIndex } from "../../../features/mining/staticMiningIndex";
import "./mining.css";
import "./mining-typography.css";
import "../../shared/resource-filter-chip.css";
import "./mining-source-chips.css";
import { loadManifest } from "../../../features/mining/planetAssets";
import type { PlanetAsset } from "../../../features/mining/planetAssets";
import { useLogisticsStore } from "../../../stores/logisticsStore";
import { projectQueueMiningDemand } from "../../../features/mining/queueMiningDemand";
import {
  EMPTY_MINING_SIDEBAR_STATE,
  MINING_COVERAGE_MODES,
  MINING_COVERAGE_MODE_STORAGE_KEY,
  MINING_FILTER_STORAGE_KEY,
  MINING_QUEUE_FOCUS_STORAGE_KEY,
  MINING_RANKING_MODE_STORAGE_KEY,
  MINING_SYSTEM_FILTERS,
  readStoredCoverageMode,
  readStoredQueueFocus,
  readStoredRankingMode,
  readStoredSidebarState,
  writeStoredSidebarState,
  type LoadState,
  type MiningEncounterTier,
  type MiningRankingMode,
  type MiningSidebarState,
} from "./miningTypes";
import { isIndexableMiningResource } from "./miningScoring";
import { getLocationCardKey, getLocationSelectedCoverage, buildQueueFocusLabel, materialKeyOf, miningRouteSentence } from "./miningFormatters";
import { useMiningLocations } from "./useMiningLocations";
import { buildMiningPresenceIndex, deriveMiningFilterState, projectMiningRequestMaterials, restoreMiningSystemSelection } from "./miningFilterState";
import { MiningFilterBar, MiningScopeActions, type MiningResourceChip } from "./MiningFilterBar";
import { JournalEvidenceSection, JournalLocationDetail, JournalLocationListItem } from "./JournalLocation";
import { loadSourceJournalEvidence } from "../../../features/source/sourceCatalogClient";
import {
  PLANT_LIFE_RESOURCE_NAMES, WILDLIFE_RESOURCE_NAMES,
  UNKNOWN_JOURNAL_EVIDENCE, journalResourceKey, reportedHabitatLocations,
  deriveJournalChipAvailability, type JournalEvidence, type JournalCategory,
  type JournalHabitatReport,
} from "../../../features/source/sourceResources";
import { getStaticLocationDisplayName } from "../../../features/mining/staticMiningIndex";
import { LocationListItem } from "./LocationListItem";
import { getDisplayedLocationRank } from "./miningScoring";
import { LocationDetail } from "./LocationDetail";
import { MaterialNameCell } from "./MiningShared";
import { useMiningHoverTooltip } from "./MiningHoverTooltip";
import { useShellBreadcrumbDetail } from "../../dashboard/shellNavigation";

/** V31 responsive section navigation: phone tabs and tablet scroll shortcuts. */
const MINING_SECTIONS = [
  { key: "filters", label: "Filters", sub: "Targets" },
  { key: "locations", label: "Locations", sub: "Ranked" },
  { key: "profile", label: "Profile", sub: "Source" },
] as const;
type MiningSectionKey = (typeof MINING_SECTIONS)[number]["key"];

const MIN_VISIBLE_ROUTE_LOCATIONS = 8;
/** Editorial starter picks for the first-visit state; not usage data. */
const MINING_START_PICKS = ["Quantanium", "Laranite", "Taranite", "Bexalite", "Agricium", "Hadanite"];
const SOURCE_JOURNAL_SELECTION_STORAGE_KEY = "breaker:source-journal-chips-v1";
const ALL_JOURNAL_CHIP_KEYS = [
  ...PLANT_LIFE_RESOURCE_NAMES.map((name) => journalResourceKey("plant", name)),
  ...WILDLIFE_RESOURCE_NAMES.map((name) => journalResourceKey("wildlife", name)),
];
function readJournalSelection(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(SOURCE_JOURNAL_SELECTION_STORAGE_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((item): item is string =>
      typeof item === "string" && ALL_JOURNAL_CHIP_KEYS.includes(item)) : []);
  } catch { return new Set(); }
}
const SYSTEM_SELECTOR_ORDER = ["Stanton", "Pyro", "Nyx"];
const DORMANT_MINING_TYPE_FILTERS = new Set<string>();
const DORMANT_ENCOUNTER_TIER_FILTERS = new Set<MiningEncounterTier>();
const MINING_LOCATION_PANEL_STORAGE_KEY = "moonbreaker:mining-location-panel-v1";
function readMiningLocationPanelCollapsedState(): boolean {
  try {
    const stored = JSON.parse(localStorage.getItem(MINING_LOCATION_PANEL_STORAGE_KEY) ?? "{}") as Partial<{ collapsed: boolean; mode: string }>;
    if (typeof stored.collapsed === "boolean") return stored.collapsed;
    return stored.mode === "collapsed";
  } catch {
    return false;
  }
}
const debugMiningIdentity = Boolean(
  import.meta.env.DEV &&
  typeof localStorage !== "undefined" &&
  localStorage.getItem("debug:mining-materials") === "1"
);

const COVERAGE_MODE_DESCRIPTIONS: Record<MiningCoverageMode, string> = {
  "complete-set": "Each next location adds the most queue materials you still need until no location can add more.",
  "best-single": "Locations that cover more selected queue materials appear first, then stronger material fit breaks ties.",
  "rare-first": "Give extra priority to needed materials that appear at fewer locations.",
  "quality-hunt": "Multi-stop route and prefer better-ranked material locations while still adding materials you do not yet cover.",
};

function CoverageModeButton({
  mode,
  active,
  onSelect,
}: {
  mode: (typeof MINING_COVERAGE_MODES)[number];
  active: boolean;
  onSelect: () => void;
}) {
  const tooltip = useMiningHoverTooltip(COVERAGE_MODE_DESCRIPTIONS[mode.value]);
  return (
    <>
      <button
        type="button"
        className={`mlist-rank-btn${active ? " is-active" : ""}`}
        aria-pressed={active}
        aria-describedby={tooltip.open ? tooltip.tooltipId : undefined}
        onClick={onSelect}
        {...tooltip.triggerProps}
      >
        {mode.label}
      </button>
      {tooltip.tooltip}
    </>
  );
}

function useMediaQuery(queryText: string) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(queryText);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [queryText]);

  return isMobile;
}

function useIsMobileMiningViewport() {
  return useMediaQuery("(max-width: 699px)");
}

function useIsTabletMiningViewport() {
  return useMediaQuery("(min-width: 700px) and (max-width: 1100px)");
}

export default function MiningModule() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [staticMiningIndex, setStaticMiningIndex] = useState<StaticMiningIndex | null>(null);
  const [staticIndexStatus, setStaticIndexStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [planetAssetMap, setPlanetAssetMap] = useState<Map<string, PlanetAsset> | null>(null);
  const recommendationRequestSeqRef = useRef(0);
  const [, setLagrangeChildrenDataVersion] = useState(0);
  const planner = useMiningPlannerState();
  const [rankingMode] = useState<MiningRankingMode>(() => readStoredRankingMode());
  const [coverageMode, setCoverageMode] = useState<MiningCoverageMode>(() => readStoredCoverageMode());
  const [queueFocusItemId, setQueueFocusItemId] = useState<string>(() => readStoredQueueFocus());
  const buildQueue = useLogisticsStore((store) => store.buildQueue);
  const recipeInputsByRecipeId = useLogisticsStore((store) => store.recipeInputTemplates);
  const materials = useLogisticsStore((store) => store.materialTemplates);

  const initialSidebarState = useMemo(() => readStoredSidebarState(MINING_FILTER_STORAGE_KEY, EMPTY_MINING_SIDEBAR_STATE), []);
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(() => {
    const canonical = initialSidebarState.resources
      .map((r) => canonicalMiningMaterial({ id: r, label: r }))
      .filter((r) => !r.unresolvedUuid)
      .map((r) => r.key);
    return new Set(canonical);
  });
  const [selectedSystems, setSelectedSystems] = useState<Set<string>>(() => restoreMiningSystemSelection(initialSidebarState.systems, MINING_SYSTEM_FILTERS));
  const [selectedJournalResources, setSelectedJournalResources] = useState<Set<string>>(readJournalSelection);
  const [journalEvidence, setJournalEvidence] = useState<JournalEvidence>(UNKNOWN_JOURNAL_EVIDENCE);
  const [selectedJournalLocationKey, setSelectedJournalLocationKey] = useState<string | null>(null);
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(null);
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [activeSection, setActiveSection] = useState<MiningSectionKey>("locations");
  const pageRef = useRef<HTMLDivElement>(null);
  const locationSearchRef = useRef<HTMLInputElement>(null);
  const [buildQueueSelectionActive, setBuildQueueSelectionActive] = useState(initialSidebarState.buildQueueActive);
  const isMobileViewport = useIsMobileMiningViewport();
  const isTabletViewport = useIsTabletMiningViewport();
  const [locationPanelCollapsed, setLocationPanelCollapsed] = useState(() => readMiningLocationPanelCollapsedState());

  // Persist settings
  useEffect(() => { try { localStorage.setItem(MINING_RANKING_MODE_STORAGE_KEY, rankingMode); } catch { /* ignore */ } }, [rankingMode]);
  useEffect(() => { try { localStorage.setItem(MINING_COVERAGE_MODE_STORAGE_KEY, coverageMode); } catch { /* ignore */ } }, [coverageMode]);
  useEffect(() => { try { if (queueFocusItemId) localStorage.setItem(MINING_QUEUE_FOCUS_STORAGE_KEY, queueFocusItemId); else localStorage.removeItem(MINING_QUEUE_FOCUS_STORAGE_KEY); } catch { /* ignore */ } }, [queueFocusItemId]);
  useEffect(() => {
    try { localStorage.setItem(MINING_LOCATION_PANEL_STORAGE_KEY, JSON.stringify({ collapsed: locationPanelCollapsed })); } catch { /* local preferences are optional */ }
  }, [locationPanelCollapsed]);

  useEffect(() => {
    let cancelled = false;
    loadStaticMiningIndex()
      .then((index) => {
        if (cancelled) return;
        setStaticMiningIndex(index);
        setStaticIndexStatus("loaded");
      })
      .catch((e) => {
        if (cancelled) return;
        setStaticIndexStatus("error");
        if (import.meta.env.DEV) console.warn("[mining] static index failed", e);
      });
    loadStantonLagrangeGroupData().then(() => { if (!cancelled) setLagrangeChildrenDataVersion((v) => v + 1); }).catch(() => {});
    loadManifest().then((map) => { if (!cancelled) setPlanetAssetMap(map); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(SOURCE_JOURNAL_SELECTION_STORAGE_KEY, JSON.stringify([...selectedJournalResources])); }
    catch { /* optional local preference */ }
  }, [selectedJournalResources]);
  useEffect(() => {
    const controller = new AbortController();
    loadSourceJournalEvidence(controller.signal)
      .then((evidence) => { if (!controller.signal.aborted) setJournalEvidence(evidence); })
      .catch(() => { if (!controller.signal.aborted) setJournalEvidence(UNKNOWN_JOURNAL_EVIDENCE); });
    return () => controller.abort();
  }, []);

  // Build queue / demand pipeline
  const queueFocusOptions = useMemo(() => buildQueue.filter((item) => item.status !== "complete"), [buildQueue]);
  useEffect(() => {
    if (!queueFocusItemId || queueFocusOptions.some((item) => item.id === queueFocusItemId)) return;
    queueMicrotask(() => setQueueFocusItemId(""));
  }, [queueFocusItemId, queueFocusOptions]);
  const miningRequiredMaterials = useMemo<RequiredMaterial[]>(() => {
    const requirements = projectQueueMiningDemand({
      buildQueue,
      materials,
      recipeInputsByRecipeId,
      focusItemId: buildQueueSelectionActive ? queueFocusItemId : undefined,
    });
    if (debugMiningIdentity) { console.groupCollapsed("[mining] gross queue mining requirements"); console.debug("mining targets", requirements); console.groupEnd(); }
    return requirements;
  }, [buildQueue, buildQueueSelectionActive, materials, queueFocusItemId, recipeInputsByRecipeId]);

  const buildQueueMaterials = useMemo(() => new Set(miningRequiredMaterials.map(materialKeyOf)), [miningRequiredMaterials]);
  const buildQueueMaterialsKey = [...buildQueueMaterials].sort().join(",");
  useEffect(() => {
    if (!buildQueueSelectionActive || buildQueueMaterials.size === 0) return;
    queueMicrotask(() => setSelectedMaterials((prev) => new Set([...prev, ...buildQueueMaterials])));
  }, [buildQueueMaterials, buildQueueMaterialsKey, buildQueueSelectionActive]);
  useEffect(() => { writeStoredSidebarState<MiningSidebarState>(MINING_FILTER_STORAGE_KEY, { buildQueueActive: buildQueueSelectionActive, systems: [...selectedSystems], miningTypes: [], encounterTiers: [], resources: [...selectedMaterials] }); }, [buildQueueSelectionActive, selectedMaterials, selectedSystems]);

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

  // Chip availability, muting, and request scope derive from public presence only, never from recommendation results.
  const presence = useMemo(() => buildMiningPresenceIndex(staticMiningIndex?.rows ?? []), [staticMiningIndex]);
  const chipSelectedMaterials = buildQueueSelectionActive ? buildQueueMaterials : selectedMaterials;
  const filterState = useMemo(() => deriveMiningFilterState({
    presence,
    selectedSystems,
    selectedMaterials: chipSelectedMaterials,
    materialKeys: allMaterialResources.map((r) => r.id),
    systemOrder: SYSTEM_SELECTOR_ORDER,
  }), [allMaterialResources, chipSelectedMaterials, presence, selectedSystems]);
  const { activeSystems, availableMaterials } = filterState;

  useEffect(() => {
    if (filterState.systemsShown.length === 0) return;
    const known = new Set(filterState.systemsShown);
    if ([...selectedSystems].every((system) => known.has(system))) return;
    queueMicrotask(() => setSelectedSystems((prev) => restoreMiningSystemSelection([...prev], filterState.systemsShown)));
  }, [filterState.systemsShown, selectedSystems]);

  const sidebarSelectedMaterials = useMemo<RequiredMaterial[]>(() => {
    return [...selectedMaterials].map((key) => {
      const canonical = canonicalMiningMaterial({ materialKey: key, displayName: materialOptionByKey.get(key)?.label, materialName: materialOptionByKey.get(key)?.label });
      return { materialId: canonical.key, materialKey: canonical.key, materialName: canonical.label, displayName: canonical.label, requiredQuantity: 1, usedBy: [], slots: [] };
    });
  }, [materialOptionByKey, selectedMaterials]);

  const { sidebarOnlyMaterials, recommenderRequiredMaterials } = useMemo(
    () => projectMiningRequestMaterials(sidebarSelectedMaterials, miningRequiredMaterials, buildQueueSelectionActive, availableMaterials),
    [availableMaterials, buildQueueSelectionActive, miningRequiredMaterials, sidebarSelectedMaterials],
  );
  const favoriteLocationIds = useMemo(() => planner.favorites.map((f) => f.key), [planner.favorites]);

  // Recommendation fetch
  const recommendationRequest = useMemo(
    () => buildRecommendationRequest({ priorityStack: planner.priorityStack, manualDemand: planner.manualDemand, favoriteLocationIds, filters: planner.filters }, null, recommenderRequiredMaterials, rankingMode),
    [favoriteLocationIds, planner.filters, planner.manualDemand, planner.priorityStack, rankingMode, recommenderRequiredMaterials],
  );
  // The complete request payload is the fetch identity. Recreating an equivalent
  // object during render must not cancel and restart the current request.
  const recommendationRequestKey = JSON.stringify(recommendationRequest);

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
  // Request object identity is intentionally excluded: only payload changes refetch.
  }, [recommendationRequestKey]);

  const recommendationData = "data" in state ? state.data : undefined;
  const locations = useMemo(() => recommendationData ? [...recommendationData.recommendations].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) : [], [recommendationData]);
  const hasRecommendationData = recommendationData !== undefined;
  const activeSystemLabel = activeSystems.size > 0 ? [...activeSystems].join(" + ") : null;

  // Canonical mining chips originate in the published Mining location/material index.
  // Passive normal/muted/disabled/selectedUnavailable remains owned by
  // deriveMiningFilterState, not by the displayed rankings or Journal reports.
  const miningResources = useMemo<MiningResourceChip[]>(() => {
    const indexChips = staticMiningIndex?.materialResources;
    const indexed = indexChips?.length ? indexChips : allMaterialResources;
    return indexed.map((chip) => ({
      id: chip.id,
      label: chip.label,
      availability: filterState.chipStateByMaterial.get(chip.id)?.availability ?? "normal",
      miningType: chip.miningType,
    }));
  }, [allMaterialResources, filterState.chipStateByMaterial, staticMiningIndex]);

  const journalAvailability = useMemo(
    () => deriveJournalChipAvailability(journalEvidence, selectedJournalResources, activeSystems, ALL_JOURNAL_CHIP_KEYS),
    [activeSystems, journalEvidence, selectedJournalResources],
  );
  const journalLocations = useMemo(
    () => reportedHabitatLocations(journalEvidence, selectedJournalResources, activeSystems, locationSearch),
    [activeSystems, journalEvidence, locationSearch, selectedJournalResources],
  );
  const journalOnlySelection = selectedJournalResources.size > 0 && selectedMaterials.size === 0 && !buildQueueSelectionActive;

  const effectiveMaterialFilterKeys = filterState.requestMaterials;

  // All location filtering/ranking in one hook
  const { locationMaterialKeysByLocationKey, displayRankedFilteredLocations, coveragePlan, coveragePlanLocationByKey } = useMiningLocations({
    locations,
    loadingState: state.status,
    selectedSystems: activeSystems,
    selectedMiningTypes: DORMANT_MINING_TYPE_FILTERS,
    selectedEncounterTiers: DORMANT_ENCOUNTER_TIER_FILTERS,
    materialFilterKeys: effectiveMaterialFilterKeys,
    activeBuildQueueMaterialKeys,
    activeBuildQueueDemandMaterials,
    sidebarOnlyMaterials,
    buildQueueSelectionActive,
    coverageMode,
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
  const systemLocations = useMemo(
    () => activeSystems.size > 0 ? locations.filter((entry) => activeSystems.has(entry.systemName)) : locations,
    [activeSystems, locations],
  );
  const mobileQueueDemandEmpty = isMobileViewport && buildQueueSelectionActive && activeBuildQueueDemandMaterials.length === 0;
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
  const indexedDiscovery = useMemo(() => {
    if (!staticMiningIndex || !recommendationData || mobileQueueDemandEmpty) return [];
    const query = locationSearch.trim().toLowerCase();
    return buildIndexedDiscovery(recommendationRequest, staticMiningIndex, locations).filter(({ entry }) =>
      (activeSystems.size === 0 || activeSystems.has(entry.systemName)) &&
      (!query || entry.locationName.toLowerCase().includes(query) || entry.systemName.toLowerCase().includes(query)) &&
      (!planner.filters.showOnlyStarred || planner.isFavorite({ system: entry.systemName, location: entry.locationName, spawnType: entry.spawnType }))
    );
  }, [staticMiningIndex, recommendationData, recommendationRequest, locations, mobileQueueDemandEmpty, locationSearch, activeSystems, planner]);
  const visibleLocations = useMemo(() => [...searchFilteredLocations, ...indexedDiscovery.map((item) => item.entry)], [searchFilteredLocations, indexedDiscovery]);

  // Keep the Mining ranked result order unchanged. Qualitative Journal matches
  // never enter the Mining recommender or its competition calculations.
  const journalByBody = useMemo(() => new Map(journalLocations.map((location) => [
    location.system.toLowerCase() + ":" + location.body.toLowerCase(), location,
  ])), [journalLocations]);
  const reportsForMiningLocation = (entry: (typeof visibleLocations)[number]): JournalHabitatReport[] => {
    const displayed = getStaticLocationDisplayName(entry, staticMiningIndex);
    return (journalByBody.get(entry.systemName.toLowerCase() + ":" + displayed.toLowerCase()) ??
      journalByBody.get(entry.systemName.toLowerCase() + ":" + entry.locationName.toLowerCase()))?.reports ?? [];
  };
  const extraJournalLocations = journalOnlySelection
    ? journalLocations
    : journalLocations.filter((location) => !visibleLocations.some((entry) =>
      entry.systemName.toLowerCase() === location.system.toLowerCase() &&
      [entry.locationName, getStaticLocationDisplayName(entry, staticMiningIndex)]
        .some((name) => name.toLowerCase() === location.body.toLowerCase())));
  const selectedJournalLocation = extraJournalLocations.find((location) => location.key === selectedJournalLocationKey) ?? null;
  const hasMaterialFilters = effectiveMaterialFilterKeys.size > 0;
  const hasOptionalFiltersActive = hasMaterialFilters
    || selectedJournalResources.size > 0
    || buildQueueSelectionActive
    || planner.filters.showOnlyStarred
    || locationSearch.trim().length > 0;
  const selectedSystemHasLocations = systemLocations.length > 0;
  const noResultsMessage = locationSearch.trim()
    ? `No locations match "${locationSearch.trim()}".`
    : planner.filters.showOnlyStarred
      ? "No bookmarked locations. Bookmark a location from the list."
      : hasMaterialFilters
        ? "No locations match the current material filters."
        : "No locations match the current filters.";

  const listLocations = journalOnlySelection || mobileQueueDemandEmpty ? [] : searchFilteredLocations;
  const explicitSelectedEntry = useMemo(() => {
    if (mobileQueueDemandEmpty || !selectedLocationKey) return null;
    return visibleLocations.find((entry) => entry.locationKey === selectedLocationKey) ?? null;
  }, [mobileQueueDemandEmpty, visibleLocations, selectedLocationKey]);
  // First visit: nothing selected and no location chosen yet. Ask what to mine
  // instead of auto-opening the first tied location.
  const showStartState = !buildQueueSelectionActive && selectedMaterials.size === 0 && selectedJournalResources.size === 0
    && !selectedLocationKey && !planner.filters.showOnlyStarred && locationSearch.trim().length === 0;
  const startPicks = useMemo(() => MINING_START_PICKS.flatMap((name) => {
    const chip = miningResources.find((item) => item.label.toLowerCase() === name.toLowerCase());
    return chip && chip.availability !== "disabled" ? [chip] : [];
  }), [miningResources]);
  const effectiveSelectedEntry = useMemo(() => {
    if (mobileQueueDemandEmpty || journalOnlySelection || showStartState) return null;
    if (selectedLocationKey) {
      return explicitSelectedEntry ?? visibleLocations[0] ?? null;
    }
    // No visible results means no profile: never fall back to an unsearched
    // location. Selection state itself is untouched.
    return visibleLocations[0] ?? null;
  }, [explicitSelectedEntry, journalOnlySelection, mobileQueueDemandEmpty, showStartState, visibleLocations, selectedLocationKey]);
  useShellBreadcrumbDetail(selectedJournalLocation?.body ?? effectiveSelectedEntry?.locationName);

  useEffect(() => {
    queueMicrotask(() => {
      setShowAllLocations(false);
    });
  }, [selectedMaterials, selectedSystems, selectedJournalResources, buildQueueSelectionActive]);

  useEffect(() => {
    if (!selectedLocationKey) return;
    if (visibleLocations.some((entry) => entry.locationKey === selectedLocationKey)) return;
    queueMicrotask(() => setSelectedLocationKey(null));
  }, [visibleLocations, selectedLocationKey]);

  useEffect(() => {
    if (!selectedJournalLocationKey || extraJournalLocations.some((location) => location.key === selectedJournalLocationKey)) return;
    queueMicrotask(() => setSelectedJournalLocationKey(null));
  }, [extraJournalLocations, selectedJournalLocationKey]);

  // Filter handlers
  function toggleJournalResource(category: JournalCategory, name: string) {
    const key = journalResourceKey(category, name);
    setSelectedJournalResources((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setSelectedJournalLocationKey(null);
  }
  function toggleMaterial(id: string) {
    const key = canonicalMiningMaterialKey(id);
    if (filterState.chipStateByMaterial.get(key)?.availability === "disabled") return;
    setSelectedMaterials((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); if (next.size === 0) setBuildQueueSelectionActive(false); return next; });
  }
  function selectAllSystems() {
    // An empty system selection already means every system (see deriveMiningFilterState).
    setSelectedSystems(new Set());
  }
  function toggleSystem(sys: string) {
    setSelectedSystems((prev) => {
      const next = new Set(prev);
      if (next.has(sys)) next.delete(sys); else next.add(sys);
      return next;
    });
  }
  function selectBuildQueueMaterials() {
    setBuildQueueSelectionActive((active) => { if (active) return false; if (planner.filters.showOnlyStarred) planner.toggleShowOnlyStarred(); setSelectedMaterials((prev) => new Set([...prev, ...buildQueueMaterials])); return true; });
  }
  function selectExploreMode() {
    setBuildQueueSelectionActive(false);
    if (planner.filters.showOnlyStarred) planner.toggleShowOnlyStarred();
  }
  function clearAllFilters() {
    setBuildQueueSelectionActive(false);
    if (planner.filters.showOnlyStarred) planner.toggleShowOnlyStarred();
    setLocationSearch("");
    setSelectedMaterials(new Set());
    setSelectedSystems(new Set());
    setSelectedJournalResources(new Set());
    setSelectedJournalLocationKey(null);
  }
  function clearSelectedMaterials() {
    setBuildQueueSelectionActive(false);
    setSelectedMaterials(new Set());
    setSelectedJournalResources(new Set());
    setSelectedJournalLocationKey(null);
  }
  function scrollWorkspaceToTop() {
    const scroller = pageRef.current?.closest<HTMLElement>(".app-page-shell");
    if (scroller) scroller.scrollTop = 0;
  }
  function showSection(section: MiningSectionKey) {
    setActiveSection(section);
    if (isMobileViewport) {
      scrollWorkspaceToTop();
    } else if (isTabletViewport) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      pageRef.current?.querySelector(`[data-mining-section="${section}"]`)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }
  }
  function browseLocations() {
    if (isMobileViewport || isTabletViewport) showSection("locations");
    locationSearchRef.current?.focus();
  }
  function toggleSelectedLocation(locationKey: string) {
    setSelectedJournalLocationKey(null);
    setSelectedLocationKey(locationKey);
    // Phones follow the V31 flow: choosing a ranked location opens its profile tab.
    if (isMobileViewport) {
      setActiveSection("profile");
      scrollWorkspaceToTop();
    }
  }

  const locationCoverage = (entry: (typeof listLocations)[number]) => getLocationSelectedCoverage({
    entry,
    locationMaterialKeys: locationMaterialKeysByLocationKey.get(entry.locationKey) ?? [],
    selectedMaterials,
    buildQueueMaterialKeys: activeBuildQueueMaterialKeys,
  });
  const orderedSystemFilters = useMemo(
    () => filterState.systemsShown.length > 0 ? filterState.systemsShown : SYSTEM_SELECTOR_ORDER.filter((system) => MINING_SYSTEM_FILTERS.includes(system)),
    [filterState.systemsShown],
  );
  const shouldShowFilteredNoResults = selectedSystemHasLocations && hasOptionalFiltersActive && searchFilteredLocations.length === 0;
  const emptyStateMessage = shouldShowFilteredNoResults
    ? noResultsMessage
    : selectedSystemHasLocations
      ? "No locations available to display."
      : activeSystemLabel
        ? `No indexed mining locations are available for ${activeSystemLabel}.`
        : "No indexed mining locations are available.";
  const routeSentence = buildQueueSelectionActive && coverageMode !== "best-single"
    ? miningRouteSentence(coveragePlan, (entry) => getStaticLocationDisplayName(entry, staticMiningIndex))
    : null;
  const activeMaterialCount = (buildQueueSelectionActive ? buildQueueMaterials.size : effectiveMaterialFilterKeys.size) + selectedJournalResources.size;
  const miningRankingContext = effectiveMaterialFilterKeys.size > 0
    ? coveragePlan
      ? `${coveragePlan.coveredCount}/${coveragePlan.totalMaterials} materials covered · ${searchFilteredLocations.length} locations`
      : `${effectiveMaterialFilterKeys.size} material${effectiveMaterialFilterKeys.size === 1 ? "" : "s"} · ${searchFilteredLocations.length} locations`
    : `${searchFilteredLocations.length} locations`;
  const rankingContext = selectedJournalResources.size > 0
    ? journalOnlySelection
      ? journalEvidence.availability === "reported"
        ? `${extraJournalLocations.length} reported locations · unranked`
        : "Journal habitat evidence not published"
      : miningRankingContext + ` · ${journalLocations.length} Journal matches`
    : miningRankingContext;

  return (
    <div ref={pageRef} className="mine-page mine-page--v2" data-mobile-section={activeSection}>
      {hasRecommendationData && (
        <div className="mine-body">
          {(state.status === "loading" || state.status === "error") && <div className="mining-recommendation-status">
            {state.status === "loading" && <span className="mining-command-status" role="status">Refreshing recommendations…</span>}
            {state.status === "error" && <span className="mining-command-status mining-command-status--error" role="status">Could not refresh recommendations. Showing previous results.</span>}
          </div>}

          <div className="mining-section-tabs" role="tablist" aria-label="Workspace sections">
            <span className="mining-section-tabs__prefix" aria-hidden="true">Section navigation</span>
            {MINING_SECTIONS.map((section) => (
              <button
                key={section.key}
                type="button"
                role="tab"
                id={`mining-section-tab-${section.key}`}
                aria-selected={activeSection === section.key}
                aria-controls={`mining-section-${section.key}`}
                aria-label={section.key === "filters" && activeMaterialCount ? `${section.label} section, ${activeMaterialCount} materials selected` : `${section.label} section`}
                tabIndex={activeSection === section.key ? 0 : -1}
                className={activeSection === section.key ? "is-active" : undefined}
                onClick={() => showSection(section.key)}
              >
                <span>{section.label}</span>
                <small>{section.key === "locations" && journalOnlySelection ? "Reported" : section.sub}</small>
              </button>
            ))}
          </div>

          <div className={`mining-shell${locationPanelCollapsed ? " mining-shell--locations-collapsed" : ""}`}>
            <div className="mining-browser-column">
            <aside id="mining-section-filters" data-mining-section="filters" className="mining-filter-panel" aria-label="Mining filters and constraints">
              <div className="mining-control-deck">
                <div className="mining-scope-section">
                  <MiningScopeActions
                    exploreActive={!buildQueueSelectionActive && !planner.filters.showOnlyStarred}
                    buildQueueSelectionActive={buildQueueSelectionActive}
                    buildQueueMaterials={buildQueueMaterials}
                    showOnlyStarred={planner.filters.showOnlyStarred}
                    onSelectExplore={selectExploreMode}
                    onSelectBuildQueueMaterials={selectBuildQueueMaterials}
                    onToggleStarred={() => planner.toggleShowOnlyStarred()}
                  />
                </div>
                <div className="mine-browse-section">
                  <div className="mine-system-selector" role="group" aria-label="System filters">
                    <button
                      type="button"
                      className={`mine-system-button mine-system-button--all${activeSystems.size === 0 ? " is-active" : ""}`}
                      aria-pressed={activeSystems.size === 0}
                      onClick={selectAllSystems}
                    >
                      All
                    </button>
                    {orderedSystemFilters.map((sys) => (
                      <button
                        key={sys}
                        type="button"
                        className={`mine-system-button${activeSystems.has(sys) ? " is-active" : ""}`}
                        data-system={sys.toLowerCase()}
                        aria-pressed={activeSystems.has(sys)}
                        onClick={() => toggleSystem(sys)}
                      >
                        {sys}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <MiningFilterBar
                selectedMaterials={chipSelectedMaterials}
                miningResources={miningResources}
                selectedJournalResources={selectedJournalResources}
                journalAvailability={journalAvailability}
                journalEvidenceKnown={journalEvidence.availability === "reported"}
                selectionLocked={buildQueueSelectionActive}
                onToggleMaterial={toggleMaterial}
                onToggleJournalResource={toggleJournalResource}
                onClearMaterials={clearSelectedMaterials}
              />
            </aside>

            <aside id="mining-ranked-locations" data-mining-section="locations" className={`mlist-panel mining-location-panel${locationPanelCollapsed ? " mining-location-panel--collapsed" : ""}`} aria-label="Ranked mining locations">
              <div className={`mlist-header${buildQueueSelectionActive ? " mlist-header--with-tools" : ""}`}>
                <div className="mlist-header-line mining-region-label">
                  <span className="mlist-header-label">{journalOnlySelection ? "Reported locations" : "Best matches"}</span>
                  <span className="mlist-header-count">{rankingContext}</span>
                </div>
                <label className="mining-location-search mining-location-search--primary">
                  <span className="sr-only">Search mining locations</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="11" cy="11" r="6" />
                    <path d="m16 16 4 4" />
                  </svg>
                  <input
                    type="search"
                    value={locationSearch}
                    onChange={(event) => setLocationSearch(event.target.value)}
                    ref={locationSearchRef}
                    placeholder="Search mining locations"
                    aria-label="Search mining locations"
                  />
                  {locationSearch && (
                    <button type="button" onClick={() => setLocationSearch("")} aria-label="Clear location search">&#215;</button>
                  )}
                </label>
                {routeSentence && <p className="mlist-route-sentence" role="status">{routeSentence}</p>}
                {buildQueueSelectionActive && (
                  <div className="mlist-tools-row">
                    {queueFocusOptions.length > 0 && (
                      <label className="mlist-focus-control">
                        <span className="sr-only">Priority focus</span>
                        <select value={queueFocusItemId} onChange={(e) => setQueueFocusItemId(e.target.value)} aria-label="Priority focus">
                          <option value="">All queue items</option>
                          {queueFocusOptions.map((item) => <option key={item.id} value={item.id}>{buildQueueFocusLabel(item)}</option>)}
                        </select>
                      </label>
                    )}
                    <div className="mlist-route-strategy">
                      <span className="sr-only">Route strategy</span>
                      <div className="mlist-rank-toggle" role="group" aria-label="Coverage mode">
                        {MINING_COVERAGE_MODES.map((mode) => (
                          <CoverageModeButton key={mode.value} mode={mode} active={coverageMode === mode.value} onSelect={() => setCoverageMode(mode.value)} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="mlist-browser-section">
                <div className="mlist-items">
                  {journalOnlySelection ? (
                    <div className="source-journal-only-locations">
                      {journalEvidence.availability !== "reported" ? (
                        <div className="mine-empty-state">
                          <p className="mine-empty-text">Journal habitat evidence is not published yet. Resource selections remain saved; no locations are inferred.</p>
                        </div>
                      ) : extraJournalLocations.length === 0 ? (
                        <div className="mine-empty-state">
                          <p className="mine-empty-text">No reported habitat matches these filters. Missing reports do not prove absence.</p>
                        </div>
                      ) : extraJournalLocations.map((location) => (
                        <JournalLocationListItem key={location.key} location={location}
                          planetAssetMap={planetAssetMap}
                          selected={selectedJournalLocation?.key === location.key ||
                            (!selectedJournalLocation && location.key === extraJournalLocations[0]?.key)}
                          onSelect={() => {
                            setSelectedJournalLocationKey(location.key);
                            if (isMobileViewport) { setActiveSection("profile"); scrollWorkspaceToTop(); }
                          }} />
                      ))}
                    </div>
                  ) : mobileQueueDemandEmpty ? (
                    <div className="mine-empty-state mine-empty-state--queue-covered">
                      <p className="mine-empty-text">No active Queue material requirements need a mining route.</p>
                    </div>
                  ) : listLocations.length === 0 && indexedDiscovery.length === 0 ? (
                    <div className="mine-empty-state">
                      <p className="mine-empty-text">{emptyStateMessage}</p>
                      {shouldShowFilteredNoResults && (
                        <button type="button" className="mlist-view-all-btn" onClick={clearAllFilters}>Clear filters</button>
                      )}
                    </div>
                  ) : listLocations.map((entry) => {
                    const plannedLocation = coveragePlanLocationByKey.get(entry.locationKey);
                    const isSelected = effectiveSelectedEntry?.locationKey === entry.locationKey;
                    return (
                      <Fragment key={getLocationCardKey(entry)}>
                        <div>
                          <LocationListItem
                            rank={getDisplayedLocationRank(
                              entry,
                              listLocations,
                              buildQueueSelectionActive ? activeBuildQueueDemandMaterials : sidebarOnlyMaterials,
                              { routeOrdered: buildQueueSelectionActive && coveragePlan !== null && coverageMode !== "best-single" },
                            )}
                            entry={entry}
                            selectedMaterials={selectedMaterials}
                            buildQueueMaterialKeys={activeBuildQueueMaterialKeys}
                            locationMaterialKeys={locationMaterialKeysByLocationKey.get(entry.locationKey) ?? []}
                            staticMiningIndex={staticMiningIndex}
                            planetAssetMap={planetAssetMap}
                            journalReports={reportsForMiningLocation(entry)}
                            starred={planner.isFavorite({ system: entry.systemName, location: entry.locationName, spawnType: entry.spawnType })}
                            selected={isSelected}
                            alternate={buildQueueSelectionActive && plannedLocation?.isAfterCompletion === true}
                            collapsed={locationPanelCollapsed}
                            showSystemBadge={activeSystems.size !== 1}
                            onSelect={() => toggleSelectedLocation(entry.locationKey)}
                            onToggleStar={(e) => { e.stopPropagation(); planner.toggleFavorite({ system: entry.systemName, location: entry.locationName, spawnType: entry.spawnType }); }}
                          />
                        </div>
                        {plannedLocation?.isCompletionLocation && <div className="mlist-stop-marker mlist-stop-marker--complete" role="separator"><span aria-hidden="true">✓</span> Coverage complete above this line</div>}
                      </Fragment>
                    );
                  })}
                  {!journalOnlySelection && indexedDiscovery.length > 0 && <div className="mlist-stop-marker">Additional indexed locations (not ranked)</div>}
                  {!journalOnlySelection && indexedDiscovery.map(({ entry }) => (
                    <div key={`${entry.systemName}::${entry.locationKey}`}>
                      <LocationListItem entry={entry} selectedMaterials={selectedMaterials} buildQueueMaterialKeys={activeBuildQueueMaterialKeys}
                        locationMaterialKeys={[]} staticMiningIndex={staticMiningIndex} planetAssetMap={planetAssetMap}
                        journalReports={reportsForMiningLocation(entry)}
                        starred={planner.isFavorite({ system: entry.systemName, location: entry.locationName, spawnType: entry.spawnType })}
                        selected={effectiveSelectedEntry?.locationKey === entry.locationKey} collapsed={locationPanelCollapsed}
                        showSystemBadge={activeSystems.size !== 1} onSelect={() => toggleSelectedLocation(entry.locationKey)}
                        onToggleStar={(e) => { e.stopPropagation(); planner.toggleFavorite({ system: entry.systemName, location: entry.locationName, spawnType: entry.spawnType }); }} />
                    </div>
                  ))}
                  {!journalOnlySelection && extraJournalLocations.length > 0 && (
                    <div className="source-journal-extra-locations">
                      <div className="mlist-stop-marker">Additional reported habitats (unranked)</div>
                      {extraJournalLocations.map((location) => (
                        <JournalLocationListItem key={location.key} location={location}
                          planetAssetMap={planetAssetMap} selected={selectedJournalLocation?.key === location.key}
                          onSelect={() => {
                            setSelectedJournalLocationKey(location.key);
                            if (isMobileViewport) { setActiveSection("profile"); scrollWorkspaceToTop(); }
                          }} />
                      ))}
                    </div>
                  )}
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
                </div>

              </div>
            </aside>
            </div>

            <div className="mining-location-divider">
              <button
                type="button"
                className="mining-location-divider-toggle"
                aria-controls="mining-ranked-locations"
                aria-expanded={!locationPanelCollapsed}
                aria-label={locationPanelCollapsed ? "Expand ranked locations method availability" : "Collapse ranked locations method availability"}
                onClick={() => setLocationPanelCollapsed((collapsed) => !collapsed)}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
              </button>
            </div>

            <div id="mining-section-profile" data-mining-section="profile" className="mdet-col mining-detail-column">

              {showStartState && !selectedJournalLocation ? (
                <section className="mining-start-state" aria-labelledby="mining-start-title">
                  <h2 id="mining-start-title">What do you want to mine?</h2>
                  <p>Pick a material to see the best places to find it. You can choose more than one.</p>
                  {startPicks.length > 0 && <div className="mining-start-picks" role="group" aria-label="Popular picks">
                    <span className="mining-start-picks-label">Popular picks</span>
                    {startPicks.map((chip) => (
                      <button key={chip.id} type="button" className="mining-start-pick" onClick={() => toggleMaterial(chip.id)}>
                        <MaterialNameCell name={chip.label} iconSize={16} />
                      </button>
                    ))}
                  </div>}
                  <button type="button" className="mining-start-browse" onClick={browseLocations}>Browse locations</button>
                </section>
              ) : selectedJournalLocation || (journalOnlySelection && extraJournalLocations.length > 0) ? (
                <JournalLocationDetail location={selectedJournalLocation ?? extraJournalLocations[0]} />
              ) : effectiveSelectedEntry ? (
                <>
                <LocationDetail
                  entry={effectiveSelectedEntry}
                  activeDemandMaterials={buildQueueSelectionActive ? activeBuildQueueDemandMaterials : sidebarSelectedMaterials}
                  buildQueueMaterialKeys={buildQueueSelectionActive ? activeBuildQueueMaterialKeys : new Set()}
                  selectedMaterials={selectedMaterials}
                  locationMaterialKeys={locationMaterialKeysByLocationKey.get(effectiveSelectedEntry.locationKey) ?? []}
                  staticMiningIndex={staticMiningIndex}
                  staticIndexStatus={staticIndexStatus}
                  planetAssetMap={planetAssetMap}
                  coverage={locationCoverage(effectiveSelectedEntry)}
                  starred={planner.isFavorite({ system: effectiveSelectedEntry.systemName, location: effectiveSelectedEntry.locationName, spawnType: effectiveSelectedEntry.spawnType })}
                  onToggleStar={(e) => { e.stopPropagation(); planner.toggleFavorite({ system: effectiveSelectedEntry.systemName, location: effectiveSelectedEntry.locationName, spawnType: effectiveSelectedEntry.spawnType }); }}
                />
                <JournalEvidenceSection reports={reportsForMiningLocation(effectiveSelectedEntry)} />
                </>
              ) : (
                <div className="mdet-empty"><span>{journalOnlySelection
                  ? journalEvidence.availability === "reported" ? "No reported habitat matches this selection." : "Journal habitat evidence not published."
                  : mobileQueueDemandEmpty ? "No active Queue material requirements need a mining route."
                  : searchFilteredLocations.length === 0 ? emptyStateMessage : "Select a location to view details"}</span></div>
              )}
            </div>
          </div>
        </div>
      )}

      {!hasRecommendationData && state.status === "loading" && <div className="mine-status-state" role="status"><span className="mine-status-text">Loading recommendations…</span></div>}
      {!hasRecommendationData && state.status === "error" && <div className="mine-status-state mine-status-state--error" role="alert"><span className="mine-status-text">Failed to load: {state.message}</span></div>}
    </div>
  );
}
