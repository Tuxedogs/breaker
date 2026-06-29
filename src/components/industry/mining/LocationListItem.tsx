import { useMemo, type KeyboardEvent, type MouseEvent } from "react";
import type { PublicLocationEntry } from "../../../features/mining/types";
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
import StantonLagrangeChildrenSummary from "./StantonLagrangeChildrenSummary";
import { hasStantonLagrangeChildren } from "./stantonLagrangeChildren";
import MiningBookmarkIcon from "./MiningBookmarkIcon";
import { useMiningHoverTooltip } from "./MiningHoverTooltip";

export function LocationListItem({
  rank,
  entry,
  coveragePlanLocation,
  selectedMaterials,
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
  const isLagrangeChildGroup = hasStantonLagrangeChildren(entry);
  const planetAsset = getPlanetAsset(planetAssetMap, locationDisplayName) ?? getPlanetAsset(planetAssetMap, entry.locationName);
  const bookmarkTooltip = useMiningHoverTooltip(starred ? "Remove saved" : "Save", { align: "end" });

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  const demandBar = totalRelevant > 0 ? coveragePct : null;

  return (
    <div
      className={`mlist-item${selected ? " mlist-item--selected" : ""}${starred ? " mlist-item--bookmarked" : ""}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Select ${locationDisplayName} mining location`}
    >
      <div className="mlist-item-rank">{rank}</div>
      <div className="mlist-item-thumb" aria-hidden="true">
        {planetAsset ? (
          <img
            src={planetAsset.thumbnail}
            srcSet={`${planetAsset.thumbnail2x} 2x`}
            alt=""
            className="mlist-item-thumb-img"
          />
        ) : (
          <span className="mlist-item-thumb-fallback">{locationDisplayName.slice(0, 1).toUpperCase()}</span>
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
          {!isLagrangeChildGroup && (
            <span className={`mloc-system-badge ${systemBadgeClass(entry.systemName)}`}>{entry.systemName}</span>
          )}
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
        ref={bookmarkTooltip.setTriggerRef}
        className={`mloc-bookmark-btn${starred ? " is-active" : ""}`}
        onClick={onToggleStar}
        aria-pressed={starred}
        aria-label={starred ? "Remove saved" : "Save"}
        aria-describedby={bookmarkTooltip.open ? bookmarkTooltip.tooltipId : undefined}
        {...bookmarkTooltip.triggerProps}
      >
        <MiningBookmarkIcon />
      </button>
      {bookmarkTooltip.tooltip}
    </div>
  );
}
