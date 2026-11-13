import { useMemo, type KeyboardEvent, type MouseEvent } from "react";
import type { PublicLocationEntry } from "../../../features/mining/types";
import type { JournalHabitatReport } from "../../../features/source/sourceResources";
import { SourceReportedBadges } from "./JournalLocation";
import {
  getStaticLocationEnvironment,
  getStaticLocationDisplayName,
  getStaticMethodBiasForLocation,
  type StaticMiningIndex,
} from "../../../features/mining/staticMiningIndex";
import { buildMiningLocationSurveyPresentation } from "../../../features/mining/miningPresentationModels";
import type { PlanetAsset } from "../../../features/mining/planetAssets";
import { getPlanetAsset } from "../../../features/mining/planetAssets";
import { formatMiningProbability, getLocationSelectedCoverage, systemBadgeClass } from "./miningFormatters";
import StantonLagrangeChildrenSummary from "./StantonLagrangeChildrenSummary";
import { isStantonLagrangeGroup } from "./stantonLagrangeChildren";
import MiningBookmarkIcon from "./MiningBookmarkIcon";
import MaterialCoverageChips from "./MaterialCoverageChips";
import { buildDemandRows } from "./miningFormatters";
import { getStaticResourcesForLocation } from "../../../features/mining/staticMiningIndex";
import { canonicalMiningMaterial } from "../../../features/mining/materialIdentity";
import { useMiningHoverTooltip } from "./MiningHoverTooltip";

export function LocationListItem({
  rank,
  entry,
  selectedMaterials,
  buildQueueMaterialKeys,
  locationMaterialKeys,
  staticMiningIndex,
  planetAssetMap,
  journalReports = [],
  starred,
  selected,
  alternate = false,
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
  journalReports?: JournalHabitatReport[];
  starred: boolean;
  selected: boolean;
  /** Queue route location after coverage is already complete. */
  alternate?: boolean;
  collapsed?: boolean;
  showSystemBadge: boolean;
  onSelect: () => void;
  onToggleStar: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { covered: coveredCount, total: totalRelevant } = useMemo(
    () => getLocationSelectedCoverage({ entry, locationMaterialKeys, selectedMaterials, buildQueueMaterialKeys }),
    [entry, locationMaterialKeys, selectedMaterials, buildQueueMaterialKeys],
  );
  const chips = useMemo(() => {
    const targets = new Set([...selectedMaterials, ...buildQueueMaterialKeys]);
    const rows = buildDemandRows(entry, targets, locationMaterialKeys, new Map(), getStaticResourcesForLocation(entry, staticMiningIndex), staticMiningIndex);
    // Ranked rows show only the selected materials this location covers;
    // uncovered selections never render here (the count stays in the label).
    return [...targets].flatMap((key) => {
      const row = rows.find((item) => item.key === key);
      if (row?.coverage !== "Covered") return [];
      return [{ key, name: row.name ?? canonicalMiningMaterial({ materialKey: key }).label, coverage: row.coverage }];
    });
  }, [entry, selectedMaterials, buildQueueMaterialKeys, locationMaterialKeys, staticMiningIndex]);
  const locationDisplayName = getStaticLocationDisplayName(entry, staticMiningIndex);
  const isLagrangeChildGroup = isStantonLagrangeGroup(entry);
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
  // Retain modeled method shares in the row's accessible label and the
  // Location Profile, without displaying method text in the ranked list.
  const methodBreakdown = useMemo(
    () => survey.methods.map((item) => `${item.method} ${formatMiningProbability(item.share)}`).join(", "),
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
      className={`mlist-item${collapsed ? " mlist-item--collapsed" : ""}${selected ? " mlist-item--selected" : ""}${starred ? " mlist-item--bookmarked" : ""}${alternate ? " mlist-item--alternate" : ""}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (rank?.tooltip) rankTooltip.triggerProps.onKeyDown(event);
        handleKeyDown(event);
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${rank?.accessibleLabel ? `${rank.accessibleLabel}. ` : ""}${selected ? "Selected" : "Select"} ${locationDisplayName} mining location${survey.methods.length > 0 ? `. Modeled method shares: ${methodBreakdown}` : ""}`}
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
          <span className="mlist-item-thumb-fallback">{isLagrangeChildGroup ? "" : locationDisplayName.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div className="mlist-item-body">
        <div className="mlist-item-head" title={isLagrangeChildGroup ? entry.locationName : undefined}>
          {isLagrangeChildGroup ? <StantonLagrangeChildrenSummary entry={entry} compact placeholder /> : (
            <span className="mlist-item-name" title={locationDisplayName !== entry.locationName ? `Raw key: ${entry.locationName}` : undefined}>
              {locationDisplayName}
            </span>
          )}
        </div>
        {showSystemBadge && !isLagrangeChildGroup && (
          <div className="mlist-item-sub">
            <span className={`mlist-system-badge ${systemBadgeClass(entry.systemName)}`}>{entry.systemName}</span>
          </div>
        )}
      </div>
      <div className="mlist-item-coverage" aria-label={totalRelevant > 0 ? `${coveredCount} of ${totalRelevant} request-eligible, quality-supported materials covered` : "No selected materials"}>
        {chips.length > 0 && <MaterialCoverageChips materials={chips} />}
        <SourceReportedBadges reports={journalReports} />
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
