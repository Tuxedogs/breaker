import { useEffect, useMemo, useRef } from "react";
import { buildCoveragePlan, type CoveragePlan, type CoveragePlanLocation, type MiningCoverageMode } from "../../../features/mining/coveragePlan";
import type { PublicLocationEntry, RequiredMaterial } from "../../../features/mining/types";
import { canonicalMiningMaterial, canonicalMiningMaterialKey } from "../../../features/mining/materialIdentity";
import { getStaticLocationMaterialKeys, type StaticMiningIndex } from "../../../features/mining/staticMiningIndex";
import { createMaterialResolver } from "../../../lib/logistics/materialResolver";
import type { MaterialTemplate } from "../../../stores/logisticsStore";
import { compareLocationsByRecommendationScore, demandWeightedLocationScore, diversifyLocationsByMaterials, locationMatchesMaterialKey } from "./miningScoring";
import { miningTypeFromSpawn, targetabilityLabel } from "./miningFormatters";
import type { MiningRankingMode } from "./miningTypes";
import type { UseMiningPlannerStateReturn } from "../../../features/mining/useMiningPlannerState";

export interface MiningLocationsResult {
  locationMaterialKeysByLocationKey: Map<string, string[]>;
  indexedMaterialKeysByLocationKey: Map<string, string[]>;
  filteredLocations: PublicLocationEntry[];
  rankedFilteredLocations: PublicLocationEntry[];
  displayRankedFilteredLocations: PublicLocationEntry[];
  coveragePlan: CoveragePlan | null;
  unfilteredCoveragePlan: CoveragePlan | null;
  coveragePlanLocationByKey: Map<string, CoveragePlanLocation>;
  selectedEntry: PublicLocationEntry | null;
}

export function useMiningLocations({
  locations,
  loadingState,
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
}: {
  locations: PublicLocationEntry[];
  loadingState: string;
  selectedSystems: Set<string>;
  selectedMiningTypes: Set<string>;
  materialFilterKeys: Set<string>;
  activeBuildQueueMaterialKeys: Set<string>;
  activeBuildQueueDemandMaterials: RequiredMaterial[];
  sidebarOnlyMaterials: RequiredMaterial[];
  buildQueueSelectionActive: boolean;
  coverageMode: MiningCoverageMode;
  rankingMode: MiningRankingMode;
  selectedLocationKey: string | null;
  staticMiningIndex: StaticMiningIndex | null;
  materials: MaterialTemplate[];
  allMaterials: string[];
  planner: UseMiningPlannerStateReturn;
}): MiningLocationsResult {
  const showOnlyStarred = planner.filters.showOnlyStarred;
  const isFavoriteLocation = planner.isFavorite;

  const materialKeyByDisplayName = useMemo(() => {
    const resolve = createMaterialResolver(materials);
    return new Map(allMaterials.map((name) => [
      name,
      canonicalMiningMaterialKey(resolve({ displayName: name, materialName: name })?.materialKey ?? name),
    ]));
  }, [allMaterials, materials]);

  const locationMaterialKeysByLocationKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const location of locations) {
      map.set(location.locationKey, getStaticLocationMaterialKeys(location, staticMiningIndex));
    }
    return map;
  }, [locations, staticMiningIndex]);

  const indexedMaterialKeysByLocationKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const location of locations) {
      const staticKeys = getStaticLocationMaterialKeys(location, staticMiningIndex);
      const indexedKeys = (location.indexedResources ?? []).flatMap((resource) => {
        const keys: string[] = [canonicalMiningMaterial({
          materialId: resource.materialId,
          materialName: resource.materialName,
          displayName: resource.materialName,
        }).key];
        const resolvedKey = materialKeyByDisplayName.get(resource.materialName);
        if (resolvedKey) keys.push(resolvedKey);
        return keys;
      });
      const matchedKeys = locationMaterialKeysByLocationKey.get(location.locationKey) ?? [];
      map.set(location.locationKey, Array.from(new Set([...matchedKeys, ...staticKeys, ...indexedKeys])));
    }
    return map;
  }, [locations, locationMaterialKeysByLocationKey, materialKeyByDisplayName, staticMiningIndex]);

  const filteredLocations = useMemo(() => {
    let result = locations;
    if (selectedSystems.size > 0) result = result.filter((l) => selectedSystems.has(l.systemName));
    if (selectedMiningTypes.size > 0) result = result.filter((l) => selectedMiningTypes.has(miningTypeFromSpawn(l.spawnType)));
    if (materialFilterKeys.size > 0) result = result.filter((l) =>
      (indexedMaterialKeysByLocationKey.get(l.locationKey) ?? []).some((key) => materialFilterKeys.has(key))
    );
    if (showOnlyStarred) result = result.filter((l) => isFavoriteLocation({ system: l.systemName, location: l.locationName, spawnType: l.spawnType }));
    return [...result].sort(compareLocationsByRecommendationScore);
  }, [locations, selectedSystems, selectedMiningTypes, materialFilterKeys, indexedMaterialKeysByLocationKey, showOnlyStarred, isFavoriteLocation]);

  const activeDiversityMaterialKeys = buildQueueSelectionActive
    ? activeBuildQueueMaterialKeys
    : materialFilterKeys.size > 0 ? materialFilterKeys : activeBuildQueueMaterialKeys;

  const baseRankedFilteredLocations = useMemo(() => {
    const ranked = activeDiversityMaterialKeys.size === 1
      ? [...filteredLocations]
      : diversifyLocationsByMaterials(filteredLocations, activeDiversityMaterialKeys, indexedMaterialKeysByLocationKey);
    const modeDemandMaterials = activeBuildQueueDemandMaterials.length > 0 ? activeBuildQueueDemandMaterials : sidebarOnlyMaterials;
    if (modeDemandMaterials.length > 0) {
      return ranked.sort((a, b) => {
        const as_ = demandWeightedLocationScore(a, modeDemandMaterials, locationMaterialKeysByLocationKey, staticMiningIndex, rankingMode);
        const bs_ = demandWeightedLocationScore(b, modeDemandMaterials, locationMaterialKeysByLocationKey, staticMiningIndex, rankingMode);
        return bs_.covered - as_.covered || bs_.score - as_.score || a.locationName.localeCompare(b.locationName);
      });
    }
    return ranked.sort(compareLocationsByRecommendationScore);
  }, [activeBuildQueueDemandMaterials, activeDiversityMaterialKeys, filteredLocations, indexedMaterialKeysByLocationKey, locationMaterialKeysByLocationKey, rankingMode, sidebarOnlyMaterials, staticMiningIndex]);

  const coverageRankedFilteredLocations = useMemo(() => {
    if (activeBuildQueueDemandMaterials.length === 0) return baseRankedFilteredLocations;
    return baseRankedFilteredLocations.map((entry) => {
      const score = Math.round(demandWeightedLocationScore(entry, activeBuildQueueDemandMaterials, locationMaterialKeysByLocationKey, staticMiningIndex, rankingMode).score);
      return { ...entry, score, routeTargetabilityScore: score, routeTargetabilityLabel: targetabilityLabel(score) };
    });
  }, [activeBuildQueueDemandMaterials, baseRankedFilteredLocations, locationMaterialKeysByLocationKey, rankingMode, staticMiningIndex]);

  const coveragePlan = useMemo(
    () => buildQueueSelectionActive && activeBuildQueueDemandMaterials.length > 0
      ? buildCoveragePlan({ mode: coverageMode, demandMaterials: activeBuildQueueDemandMaterials, locations: coverageRankedFilteredLocations, locationMaterialKeysByLocationKey })
      : null,
    [activeBuildQueueDemandMaterials, buildQueueSelectionActive, coverageMode, coverageRankedFilteredLocations, locationMaterialKeysByLocationKey],
  );

  const unfilteredCoveragePlan = useMemo(
    () => buildQueueSelectionActive && activeBuildQueueDemandMaterials.length > 0
      ? buildCoveragePlan({ mode: coverageMode, demandMaterials: activeBuildQueueDemandMaterials, locations, locationMaterialKeysByLocationKey })
      : null,
    [activeBuildQueueDemandMaterials, buildQueueSelectionActive, coverageMode, locations, locationMaterialKeysByLocationKey],
  );

  const coveragePlanLocationByKey = useMemo(
    () => new Map((coveragePlan?.locations ?? []).map((l) => [l.entry.locationKey, l])),
    [coveragePlan],
  );

  const rankedFilteredLocations = useMemo(
    () => coveragePlan ? coveragePlan.locations.map((l) => l.entry) : baseRankedFilteredLocations,
    [baseRankedFilteredLocations, coveragePlan],
  );

  const previousRankedLocationsRef = useRef<PublicLocationEntry[]>([]);
  useEffect(() => {
    if (loadingState !== "loading" && rankedFilteredLocations.length > 0) {
      previousRankedLocationsRef.current = rankedFilteredLocations;
    }
  }, [rankedFilteredLocations, loadingState]);

  const displayRankedFilteredLocations =
    loadingState === "loading" && rankedFilteredLocations.length === 0 && previousRankedLocationsRef.current.length > 0
      ? previousRankedLocationsRef.current
      : rankedFilteredLocations;

  const selectedEntry = useMemo(() => {
    if (selectedLocationKey) {
      return displayRankedFilteredLocations.find((l) => l.locationKey === selectedLocationKey) ?? displayRankedFilteredLocations[0] ?? null;
    }
    return displayRankedFilteredLocations[0] ?? null;
  }, [selectedLocationKey, displayRankedFilteredLocations]);

  return {
    locationMaterialKeysByLocationKey,
    indexedMaterialKeysByLocationKey,
    filteredLocations,
    rankedFilteredLocations,
    displayRankedFilteredLocations,
    coveragePlan,
    unfilteredCoveragePlan,
    coveragePlanLocationByKey,
    selectedEntry,
  };
}
