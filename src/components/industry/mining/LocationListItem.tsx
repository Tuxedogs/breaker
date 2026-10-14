import { useMemo, type KeyboardEvent, type MouseEvent } from "react";
import type { PublicLocationEntry } from "../../../features/mining/types";
import {
  getStaticLocationEnvironment,
  getStaticLocationDisplayName,
  getStaticMethodBiasForLocation,
  type StaticMiningIndex,
} from "../../../features/mining/staticMiningIndex";
import { buildMiningLocationSurveyPresentation } from "../../../features/mining/miningPresentationModels";
import type { PlanetAsset } from "../../../features/mining/planetAssets";
import { getPlanetAsset } from "../../../features/mining/planetAssets";
import { formatMiningProbability, miningMethodBadge, systemBadgeClass } from "./miningFormatters";
import StantonLagrangeChildrenSummary from "./StantonLagrangeChildrenSummary";
import { hasStantonLagrangeChildren } from "./stantonLagrangeChildren";
import MiningBookmarkIcon from "./MiningBookmarkIcon";
import { useMiningHoverTooltip } from "./MiningHoverTooltip";

const RANKED_LOCATION_METHOD_ORDER = ["Hand", "Ship", "Vehicle"] as const;

export function LocationListItem({
  rank,
  entry,
  selectedMaterials,
  buildQueueMaterialKeys,
  locationMaterialKeys,
  staticMiningIndex,
  planetAssetMap,
  starred,
  selected,
  collapsed = false,
  showSystemBadge,
  onSelect,
  onToggleStar,
}: {
  rank?: number;
  entry: PublicLocationEntry;
  selectedMaterials: Set<string>;
  buildQueueMaterialKeys: Set<string>;
  locationMaterialKeys: string[];
  staticMiningIndex: StaticMiningIndex | null;
  planetAssetMap: Map<string, PlanetAsset> | null;
  starred: boolean;
  selected: boolean;
  collapsed?: boolean;
  showSystemBadge: boolean;
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
  const locationDisplayName = getStaticLocationDisplayName(entry, staticMiningIndex);
  const isLagrangeChildGroup = hasStantonLagrangeChildren(entry);
  const planetAsset = getPlanetAsset(planetAssetMap, locationDisplayName) ?? getPlanetAsset(planetAssetMap, entry.locationName);
  const bookmarkTooltip = useMiningHoverTooltip(starred ? "Remove saved" : "Save", { align: "end" });
  const survey = useMemo(
    () => buildMiningLocationSurveyPresentation(
      getStaticLocationEnvironment(entry, staticMiningIndex),
      getStaticMethodBiasForLocation(entry, staticMiningIndex),
    ),
    [entry, staticMiningIndex],
  );
  const rankedMethods = useMemo(
    () => [...survey.methods].sort((left, right) => {
      const leftIndex = RANKED_LOCATION_METHOD_ORDER.indexOf((miningMethodBadge(left.method)?.label ?? left.method) as typeof RANKED_LOCATION_METHOD_ORDER[number]);
      const rightIndex = RANKED_LOCATION_METHOD_ORDER.indexOf((miningMethodBadge(right.method)?.label ?? right.method) as typeof RANKED_LOCATION_METHOD_ORDER[number]);
      return (leftIndex < 0 ? RANKED_LOCATION_METHOD_ORDER.length : leftIndex) - (rightIndex < 0 ? RANKED_LOCATION_METHOD_ORDER.length : rightIndex);
    }),
    [survey.methods],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      className={`mlist-item${collapsed ? " mlist-item--collapsed" : ""}${selected ? " mlist-item--selected" : ""}${starred ? " mlist-item--bookmarked" : ""}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${selected ? "Selected" : "Select"} ${locationDisplayName} mining location`}
    >
      {rank !== undefined && <span className="mlist-item-rank" aria-hidden="true">{rank}</span>}
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
        </div>
        <div className="mlist-item-sub">
          {showSystemBadge && !isLagrangeChildGroup && (
            <span className={`mlist-system-badge ${systemBadgeClass(entry.systemName)}`}>{entry.systemName}</span>
          )}
          <span className="mlist-method-availability" aria-label="Source-backed mining method availability">
            {rankedMethods.length > 0 ? rankedMethods.map((item) => {
              const method = miningMethodBadge(item.method);
              const label = method?.label ?? item.method;
              return (
                <span className={`mlist-method-availability-item${method ? ` ${method.className}` : ""}`} key={item.method} title={`${label}: ${formatMiningProbability(item.share)} available`}>
                  <span>{label}</span><strong>{formatMiningProbability(item.share)}</strong>
                </span>
              );
            }) : <span className="mlist-method-unavailable">Methods unavailable</span>}
          </span>
          <StantonLagrangeChildrenSummary entry={entry} compact />
        </div>
      </div>
      <div className="mlist-item-coverage" aria-label={totalRelevant > 0 ? `${primaryCovered.length} of ${totalRelevant} selected materials represented` : "No selected materials"}>
        {totalRelevant > 0 ? <strong>{primaryCovered.length} / {totalRelevant}</strong> : <span>—</span>}
      </div>
      <button
        type="button"
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
