import { useMemo, type KeyboardEvent, type MouseEvent } from "react";
import { resolveRecommenderStantonLagrangeChildren } from "../../../features/locations/stantonLagrangeChildren";
import type { PublicLocationEntry, RequiredMaterial } from "../../../features/mining/types";
import {
  getStaticLocationDisplayName,
  type StaticMiningIndex,
} from "../../../features/mining/staticMiningIndex";
import type { CoveragePlanLocation } from "../../../features/mining/coveragePlan";
import type { PlanetAsset } from "../../../features/mining/planetAssets";
import { getPlanetAsset } from "../../../features/mining/planetAssets";
import {
  spawnTypeLabel,
  spawnTypeBadgeClass,
  systemBadgeClass,
} from "./miningFormatters";

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
  const locationDisplayName = getStaticLocationDisplayName(entry, staticMiningIndex);
  const planetAsset = getPlanetAsset(planetAssetMap, locationDisplayName) ?? getPlanetAsset(planetAssetMap, entry.locationName);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  const demandBar = totalRelevant > 0 ? coveragePct : null;

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


