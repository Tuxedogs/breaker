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
  rank?: { visualLabel: string; accessibleLabel: string; tooltip: string | null; tieGroupSize: number };
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
  const eligibleMaterialKeys = useMemo(
    () => entry.requiredMaterials?.map((material) => material.materialKey ?? material.materialId) ?? locationMaterialKeys,
    [entry.requiredMaterials, locationMaterialKeys],
  );
  const coveredBQ = useMemo(
    () => eligibleMaterialKeys.filter((key) => buildQueueMaterialKeys.has(key)),
    [eligibleMaterialKeys, buildQueueMaterialKeys]
  );
  const coveredSelected = useMemo(
    () => eligibleMaterialKeys.filter((key) => selectedMaterials.has(key)),
    [eligibleMaterialKeys, selectedMaterials]
  );

  const hasBuildQueueDemand = buildQueueMaterialKeys.size > 0;
  const primaryCovered = hasBuildQueueDemand ? coveredBQ : coveredSelected;
  const totalRelevant = hasBuildQueueDemand ? buildQueueMaterialKeys.size : selectedMaterials.size;
  const locationDisplayName = getStaticLocationDisplayName(entry, staticMiningIndex);
  const isLagrangeChildGroup = hasStantonLagrangeChildren(entry);
  const planetAsset = getPlanetAsset(planetAssetMap, locationDisplayName) ?? getPlanetAsset(planetAssetMap, entry.locationName);
  const bookmarkTooltip = useMiningHoverTooltip(starred ? "Remove saved" : "Save", { align: "end" });
  const rankTooltip = useMiningHoverTooltip(rank?.tooltip ?? "");
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
      onKeyDown={(event) => {
        if (rank?.tooltip) rankTooltip.triggerProps.onKeyDown(event);
        handleKeyDown(event);
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${rank?.accessibleLabel ? `${rank.accessibleLabel}. ` : ""}${selected ? "Selected" : "Select"} ${locationDisplayName} mining location`}
      aria-describedby={rankTooltip.open ? rankTooltip.tooltipId : undefined}
      onMouseEnter={rank?.tooltip ? rankTooltip.triggerProps.onMouseEnter : undefined}
      onMouseLeave={rank?.tooltip ? rankTooltip.triggerProps.onMouseLeave : undefined}
      onFocus={rank?.tooltip ? rankTooltip.triggerProps.onFocus : undefined}
      onBlur={rank?.tooltip ? rankTooltip.triggerProps.onBlur : undefined}
    >
      {rank && (
        <span
          className={`mlist-item-rank${rank.tieGroupSize > 1 ? " mlist-item-rank--tied" : ""}`}
          aria-hidden="true"
        >
          {rank.visualLabel}
        </span>
      )}
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
          <span className="mlist-method-availability" aria-label="Source-backed mining method eligibility. These shares describe modeled source coverage, not ship equipment-specific fracture feasibility or guaranteed recoverable SCU.">
            {rankedMethods.length > 0 ? rankedMethods.map((item) => {
              const method = miningMethodBadge(item.method);
              const label = method?.label ?? item.method;
              return (
                <span className={`mlist-method-availability-item${method ? ` ${method.className}` : ""}`} key={item.method} title={`${label}: ${formatMiningProbability(item.share)} modeled source share. This indicates method eligibility only; it does not verify equipped-head fracture feasibility, scanned-rock success, or recovered/refined SCU.`}>
                  <span>{label}</span><strong>{formatMiningProbability(item.share)}</strong>
                </span>
              );
            }) : <span className="mlist-method-unavailable">Methods unavailable</span>}
          </span>
          <StantonLagrangeChildrenSummary entry={entry} compact />
        </div>
      </div>
      <div className="mlist-item-coverage" aria-label={totalRelevant > 0 ? `${primaryCovered.length} of ${totalRelevant} request-eligible, quality-supported materials covered` : "No selected materials"}>
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
      {rankTooltip.tooltip}
    </div>
  );
}
