import { useMemo, type KeyboardEvent, type MouseEvent } from "react";
import type { PublicLocationEntry } from "../../../features/mining/types";
import {
  getStaticLocationDescription,
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
import MiningMethodIcon from "./MiningMethodIcon";
import { miningMethodPresentation } from "./miningMethodPresentation";
import { useMiningHoverTooltip } from "./MiningHoverTooltip";

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
  const survey = useMemo(
    () => buildMiningLocationSurveyPresentation(
      getStaticLocationDescription(entry, staticMiningIndex),
      getStaticMethodBiasForLocation(entry, staticMiningIndex),
    ),
    [entry, staticMiningIndex],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  const demandBar = totalRelevant > 0 ? coveragePct : null;
  const methodLabel = survey.methods.length > 0
    ? survey.methods.map((item) => miningMethodBadge(item.method)?.label ?? item.method).join(" / ")
    : entry.locationKind || entry.spawnType || "Unavailable";

  return (
    <div
      className={`mlist-item${selected ? " mlist-item--selected" : ""}${starred ? " mlist-item--bookmarked" : ""}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${selected ? "Collapse" : "Select"} ${locationDisplayName} mining location`}
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
          {!isLagrangeChildGroup && (
            <span className={`mlist-system-badge ${systemBadgeClass(entry.systemName)}`}>{entry.systemName}</span>
          )}
          <StantonLagrangeChildrenSummary entry={entry} compact />
        </div>
        <div className="mlist-survey-summary">
          <div className="mlist-method-availability" aria-label={`${methodLabel} mining available`}>
            {survey.methods.length > 0 ? survey.methods.map((item) => {
              const label = miningMethodBadge(item.method)?.label ?? item.method;
              const presentation = miningMethodPresentation(item.method);
              return (
                <span className="mlist-method-availability-item" key={item.method} title={`${label}: ${formatMiningProbability(item.share)} available`}>
                  {presentation.iconKey ? (
                    <MiningMethodIcon methodKey={presentation.iconKey} className="mlist-method-icon" />
                  ) : (
                    <span className="mlist-method-fallback">{presentation.visibleLabel}</span>
                  )}
                  {presentation.iconKey && <span className="sr-only">{label}</span>}
                  <strong>{formatMiningProbability(item.share)}</strong>
                </span>
              );
            }) : <span className="mlist-method-text">{methodLabel}</span>}
          </div>
          <div className="mlist-environment-summary" aria-label="Location conditions">
            {survey.conditions.map((condition) => (
              <span className={`mlist-environment-item mlist-environment-item--${condition.key}`} key={condition.key}>
                <span>{condition.compactLabel}</span>
                <strong title={`${condition.label}: ${condition.value ?? "Unavailable"}`}>
                  {condition.value ?? "Unavailable"}
                </strong>
              </span>
            ))}
          </div>
        </div>
      </div>
      {demandBar !== null && (
        <div className="mlist-item-coverage">
          <span className="mlist-bar-label"><strong>{primaryCovered.length}</strong> of {totalRelevant} </span>
          <div className="mlist-bar-track">
            <div
              className={`mlist-bar-fill${demandBar >= 100 ? " mlist-bar-fill--full" : demandBar >= 60 ? " mlist-bar-fill--good" : ""}`}
              style={{ width: `${demandBar}%` }}
            />
          </div>
        </div>
      )}
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
