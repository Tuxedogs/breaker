import { useMemo, type KeyboardEvent, type MouseEvent } from "react";
import { resolveRecommenderStantonLagrangeChildren } from "../../../features/locations/stantonLagrangeChildren";
import type { PublicLocationEntry, RequiredMaterial } from "../../../features/mining/types";
import { canonicalMiningMaterial } from "../../../features/mining/materialIdentity";
import {
  getStaticDensityScore,
  getStaticLocationDisplayName,
  getStaticMaterialQualityRow,
  getStaticMaterialKey,
  getStaticResourcesForLocation,
  type StaticMiningIndex,
} from "../../../features/mining/staticMiningIndex";
import type { CoveragePlanLocation } from "../../../features/mining/coveragePlan";
import type { PlanetAsset } from "../../../features/mining/planetAssets";
import { getPlanetAsset } from "../../../features/mining/planetAssets";
import {
  spawnTypeLabel,
  spawnTypeBadgeClass,
  systemBadgeClass,
  buildQualityDisplay,
  encounterSignalFromWeight,
  demandMaterialLabel,
  pickWeightedQualityChances,
  formatEncounterTier,
} from "./miningFormatters";
import type { MiningQueueScope } from "./miningTypes";

export function StantonLagrangeChildrenSummary({
  entry,
  compact = false,
}: {
  entry: PublicLocationEntry;
  compact?: boolean;
}) {
  if (entry.systemName.toLowerCase() !== "stanton") return null;

  const resolved = resolveRecommenderStantonLagrangeChildren(
    entry.locationName,
    entry.matchedLocationCodes,
  );

  if (resolved.points.length === 0) return null;

  return (
    <div className={`mloc-lagrange-children${compact ? " mloc-lagrange-children--compact" : ""}`}>
      {resolved.points.map((point) => (
        <div key={`${entry.locationKey}:lagrange:${point.code}`} className="mloc-lagrange-point">
          <div className="mloc-lagrange-point-head">
            <span>{point.code}</span>
            <span>{point.bodyName}</span>
            <span>{point.pointKey}</span>
            {point.children.length > 0 && (
              <span className="mloc-lagrange-count">
                {point.children.length} {point.children.length === 1 ? "child" : "children"}
              </span>
            )}
          </div>
          <div className="mloc-lagrange-child-list">
            {point.children.map((child) => (
              <span key={`${entry.locationKey}:lagrange:${point.code}:${child.id}`}>
                {child.recordName}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}


export function LocationListItem({
  rank,
  entry,
  coveragePlanLocation,
  selectedMaterials,
  activeDemandMaterials,
  buildQueueMaterialKeys,
  locationMaterialKeys,
  staticMiningIndex,
  planetAssetMap,
  starred,
  selected,
  onSelect,
  onToggleStar,
}: {
  rank: number;
  entry: PublicLocationEntry;
  coveragePlanLocation?: CoveragePlanLocation;
  selectedMaterials: Set<string>;
  activeDemandMaterials: RequiredMaterial[];
  buildQueueMaterialKeys: Set<string>;
  locationMaterialKeys: string[];
  staticMiningIndex: StaticMiningIndex | null;
  planetAssetMap: Map<string, PlanetAsset> | null;
  starred: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggleStar: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const coveredBQ = useMemo(
    () => locationMaterialKeys.filter((key) => buildQueueMaterialKeys.has(key)),
    [locationMaterialKeys, buildQueueMaterialKeys]
  );
  const coveredSelected = useMemo(
    () => locationMaterialKeys.filter((key) => selectedMaterials.has(key)),
    [locationMaterialKeys, selectedMaterials]
  );

  const hasBuildQueueDemand = buildQueueMaterialKeys.size > 0;
  const primaryCovered = hasBuildQueueDemand ? coveredBQ : coveredSelected;
  const totalRelevant = hasBuildQueueDemand ? buildQueueMaterialKeys.size : selectedMaterials.size;
  const coveragePct = totalRelevant > 0 ? Math.round((primaryCovered.length / totalRelevant) * 100) : 0;
  const relevantMaterialKeys = hasBuildQueueDemand ? buildQueueMaterialKeys : selectedMaterials;
  const primaryRouteScore = getPrimaryRouteScore(entry, relevantMaterialKeys);
  const displayRouteScore = primaryRouteScore ?? entry.routeScores?.[0] ?? null;
  const locationDisplayName = getStaticLocationDisplayName(entry, staticMiningIndex);
  const planetAsset = getPlanetAsset(planetAssetMap, locationDisplayName) ?? getPlanetAsset(planetAssetMap, entry.locationName);
  const activeDemandByKey = useMemo(() => {
    const map = new Map<string, RequiredMaterial>();
    for (const material of activeDemandMaterials) {
      const canonical = canonicalMiningMaterial({
        materialKey: material.materialKey,
        materialId: material.materialId,
        displayName: material.displayName,
        materialName: material.materialName,
      });
      if (!canonical.unresolvedUuid && canonical.key) map.set(canonical.key, material);
    }
    return map;
  }, [activeDemandMaterials]);
  const demandedStaticRows = useMemo(() => {
    if (!staticMiningIndex || relevantMaterialKeys.size === 0) return [];
    return getStaticResourcesForLocation(entry, staticMiningIndex)
      .filter((row) => relevantMaterialKeys.has(getStaticMaterialKey(row)));
  }, [entry, relevantMaterialKeys, staticMiningIndex]);
  const demandedSummary = useMemo(() => {
    if (relevantMaterialKeys.size === 0) return null;
    const staticRowsByKey = new Map(demandedStaticRows.map((row) => [getStaticMaterialKey(row), row]));
    const coveredNames = [...relevantMaterialKeys]
      .filter((key) => locationMaterialKeys.includes(key))
      .map((key) => staticRowsByKey.get(key)?.materialName ?? demandMaterialLabel(activeDemandByKey.get(key), key));
    const weights = demandedStaticRows
      .map((row) => getStaticDensityScore(row, staticMiningIndex))
      .filter((weight): weight is number => typeof weight === "number" && Number.isFinite(weight));
    const qualityValues = demandedStaticRows
      .map((row) => pickWeightedQualityChances(getStaticMaterialQualityRow(row, staticMiningIndex), row)?.["800"])
      .filter((chance): chance is number => typeof chance === "number" && Number.isFinite(chance));
    const avgWeight = weights.length > 0 ? weights.reduce((sum, value) => sum + value, 0) / weights.length : undefined;
    const avgQuality = qualityValues.length > 0 ? qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length : undefined;
    return {
      topCovered: coveredNames.slice(0, 3).join(", "),
      missingCount: Math.max(0, relevantMaterialKeys.size - primaryCovered.length),
      encounterSignal: encounterSignalFromWeight(avgWeight),
      qualityLabel: avgQuality === undefined ? "Unknown" : `${Math.round(avgQuality * 100)}%`,
    };
  }, [activeDemandByKey, demandedStaticRows, locationMaterialKeys, primaryCovered.length, relevantMaterialKeys, staticMiningIndex]);


  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  const demandBar = totalRelevant > 0 ? coveragePct : null;
  const hasCoveragePlan = buildQueueMaterialKeys.size > 0 && coveragePlanLocation !== undefined;
  const addedCount = coveragePlanLocation?.newCoverage.length ?? 0;
  const duplicateCount = coveragePlanLocation?.duplicateCoverage.length ?? 0;
  const listQualityDisplay = buildQualityDisplay(
    displayRouteScore?.signals,
    displayRouteScore?.materialKey ?? displayRouteScore?.materialId ?? "",
  );
  const yieldVal = displayRouteScore?.yieldRouteScore ?? null;

  return (
    <div
      className={`mlist-item${selected ? " mlist-item--selected" : ""}${starred ? " mlist-item--starred" : ""}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Select ${locationDisplayName} mining location`}
    >
      <div className="mlist-item-rank">{rank}</div>
      <div className="mlist-item-thumb" aria-hidden="true">
        {planetAsset && (
          <img
            src={planetAsset.thumbnail}
            srcSet={`${planetAsset.thumbnail2x} 2x`}
            alt=""
            className="mlist-item-thumb-img"
          />
        )}
      </div>
      <div className="mlist-item-body">
        <div className="mlist-item-head">
          <span className="mlist-item-name" title={locationDisplayName !== entry.locationName ? `Raw key: ${entry.locationName}` : undefined}>
            {locationDisplayName}
          </span>
          {coveragePlanLocation && (
            <span className={`mlist-role-badge${coveragePlanLocation.role === "Optional Overlap" ? " mlist-role-badge--muted" : ""}`}>
              {coveragePlanLocation.role}
            </span>
          )}
        </div>
        <div className="mlist-item-sub">
          <span className={`mloc-system-badge ${systemBadgeClass(entry.systemName)}`}>{entry.systemName}</span>
          <span className={`mloc-badge ${spawnTypeBadgeClass(entry.spawnType)} mlist-item-badge`}>
            {spawnTypeLabel(entry.spawnType)}
          </span>
        </div>
        <StantonLagrangeChildrenSummary entry={entry} compact />
        <div className="mlist-item-bars">
          {demandBar !== null && (
            <div className="mlist-bar-row">
              <span className="mlist-bar-label">Coverage</span>
              <div className="mlist-bar-track">
                <div
                  className={`mlist-bar-fill${demandBar >= 100 ? " mlist-bar-fill--full" : demandBar >= 60 ? " mlist-bar-fill--good" : ""}`}
                  style={{ width: `${demandBar}%` }}
                />
              </div>
              <span className="mlist-bar-val">{primaryCovered.length} / {totalRelevant}</span>
            </div>
          )}
          {hasCoveragePlan && (
            <div className="mlist-bar-row">
              <span className="mlist-bar-label">Plan</span>
              <span
                className="mlist-bar-val mlist-bar-val--text"
                title={`Adds ${addedCount} new, duplicates ${duplicateCount}, cumulative ${coveragePlanLocation.cumulativeCovered} / ${totalRelevant}`}
              >
                +{addedCount} new / {coveragePlanLocation.cumulativeCovered} total
              </span>
            </div>
          )}
          {demandedSummary?.topCovered && (
            <div className="mlist-bar-row">
              <span className="mlist-bar-label">Covered</span>
              <span className="mlist-bar-val mlist-bar-val--text" title={demandedSummary.topCovered}>
                {demandedSummary.topCovered}
              </span>
            </div>
          )}
          {demandedSummary && demandedSummary.missingCount > 0 && (
            <div className="mlist-bar-row">
              <span className="mlist-bar-label">Missing</span>
              <span className="mlist-bar-val mlist-bar-val--text">{demandedSummary.missingCount}</span>
            </div>
          )}
          {demandedSummary ? (
            <div className="mlist-bar-row">
              <span className="mlist-bar-label">Quality</span>
              <span className="mlist-bar-val mlist-bar-val--text">{demandedSummary.qualityLabel}</span>
            </div>
          ) : listQualityDisplay.kind !== "none" && (
            <div className="mlist-bar-row">
              <span className="mlist-bar-label">Quality</span>
              <span className="mlist-bar-val mlist-bar-val--text">
                {listQualityDisplay.kind === "ignored" ? "N/A" : listQualityDisplay.label}
              </span>
            </div>
          )}
          {demandedSummary ? (
            <div className="mlist-bar-row">
              <span className="mlist-bar-label">Encounter</span>
              <span className="mlist-bar-val mlist-bar-val--text">{demandedSummary.encounterSignal}</span>
            </div>
          ) : yieldVal !== null && (
            <div className="mlist-bar-row">
              <span className="mlist-bar-label">Encounter</span>
              <div className="mlist-bar-track">
                <div
                  className={`mlist-bar-fill${yieldVal >= 75 ? " mlist-bar-fill--best" : yieldVal >= 55 ? " mlist-bar-fill--good" : ""}`}
                  style={{ width: `${Math.min(100, yieldVal)}%` }}
                />
              </div>
              <span className="mlist-bar-val">{yieldVal}</span>
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        className={`mloc-star-btn${starred ? " mloc-star-btn--on" : ""}`}
        onClick={onToggleStar}
        title={starred ? "Unstar" : "Star"}
        aria-label={starred ? "Unstar" : "Star"}
      >
        {starred ? "★" : "☆"}
      </button>
    </div>
  );
}


