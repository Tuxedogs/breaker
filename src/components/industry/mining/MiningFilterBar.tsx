import { useEffect, useId, useState } from "react";
import MiningBookmarkIcon from "./MiningBookmarkIcon";
import { useMiningHoverTooltip } from "./MiningHoverTooltip";
import type { MiningChipAvailability } from "./miningFilterState";
import {
  PLANT_LIFE_RESOURCE_NAMES,
  WILDLIFE_RESOURCE_NAMES,
  journalResourceKey,
  type JournalCategory,
  type JournalChipAvailability,
} from "../../../features/source/sourceResources";

export interface MiningResourceChip {
  id: string;
  label: string;
  availability?: MiningChipAvailability;
  /** Existing chip mining type from the static index ("Ship", "Hand", "Ground Vehicle"). */
  miningType?: string;
}

const MINING_METHOD_GROUPS: ReadonlyArray<{ heading: string; matches: (type: string) => boolean }> = [
  { heading: "Ship mining", matches: (type) => type === "Ship" },
  { heading: "Hand mining", matches: (type) => type === "Hand" },
  { heading: "Vehicle mining", matches: (type) => type === "Ground Vehicle" || type === "Vehicle" },
];

const SOURCE_GROUPS_STORAGE_KEY = "breaker:source-index-open-groups-v1";
type CollapsibleSourceGroup = "plant" | "wildlife";
function readOpenSourceGroups(): Set<CollapsibleSourceGroup> {
  try {
    const raw = JSON.parse(localStorage.getItem(SOURCE_GROUPS_STORAGE_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((item): item is CollapsibleSourceGroup => item === "plant" || item === "wildlife") : []);
  } catch { return new Set(); }
}

const UNAVAILABLE_CHIP_NOTE = "not present in selected systems";
const MINING_CHIP_CLASS: Record<MiningChipAvailability, string> = {
  normal: "",
  muted: " is-muted",
  disabled: " is-disabled",
  selectedUnavailable: " is-unavailable",
};

export function MiningScopeActions({
  exploreActive,
  buildQueueSelectionActive,
  buildQueueMaterials,
  showOnlyStarred,
  onSelectExplore,
  onSelectBuildQueueMaterials,
  onToggleStarred,
}: {
  exploreActive: boolean;
  buildQueueSelectionActive: boolean;
  buildQueueMaterials: Set<string>;
  showOnlyStarred: boolean;
  onSelectExplore: () => void;
  onSelectBuildQueueMaterials: () => void;
  onToggleStarred: () => void;
}) {
  const savedTooltip = useMiningHoverTooltip("Saved");
  return (
    <div className="mining-filter-rail-actions">
      <div className="mining-scope-switch" role="group" aria-label="Mining location scope">
        <button type="button"
          className={"mining-scope-button mining-scope-button--explore" + (exploreActive ? " mining-scope-button--active" : "")}
          aria-pressed={exploreActive} onClick={onSelectExplore}>Explore</button>
        <button type="button"
          className={"mining-scope-button mining-scope-button--queue" + (buildQueueSelectionActive ? " mining-scope-button--active" : "")}
          aria-pressed={buildQueueSelectionActive} onClick={onSelectBuildQueueMaterials}>
          Queue{buildQueueMaterials.size > 0 && <span className="mfr-chip-count">{buildQueueMaterials.size}</span>}
        </button>
        <button type="button"
          className={"mining-scope-button mining-scope-button--bookmark" + (showOnlyStarred ? " mining-scope-button--active" : "")}
          aria-pressed={showOnlyStarred} aria-label="Saved"
          aria-describedby={savedTooltip.open ? savedTooltip.tooltipId : undefined}
          onClick={onToggleStarred} {...savedTooltip.triggerProps}>
          <span>Saved</span><MiningBookmarkIcon className="mining-scope-button__icon" />
        </button>
      </div>
      {savedTooltip.tooltip}
    </div>
  );
}

/** All three resource groups remain visible at once. Passive availability is
 * an input from the existing presence model, never recomputed from ranked results.
 */
export function MiningFilterBar({
  selectedMaterials,
  miningResources,
  selectedJournalResources,
  journalAvailability,
  journalEvidenceKnown,
  selectionLocked = false,
  onToggleMaterial,
  onToggleJournalResource,
  onClearMaterials,
}: {
  selectedMaterials: ReadonlySet<string>;
  miningResources: MiningResourceChip[];
  selectedJournalResources: ReadonlySet<string>;
  journalAvailability: ReadonlyMap<string, JournalChipAvailability>;
  journalEvidenceKnown: boolean;
  selectionLocked?: boolean;
  onToggleMaterial: (id: string) => void;
  onToggleJournalResource: (category: JournalCategory, name: string) => void;
  onClearMaterials: () => void;
}) {
  const selectedCount = selectedMaterials.size + selectedJournalResources.size;
  // Plant Life and Wildlife stay in the index but start collapsed; Mining stays open.
  const [openGroups, setOpenGroups] = useState<Set<CollapsibleSourceGroup>>(readOpenSourceGroups);
  useEffect(() => {
    try { localStorage.setItem(SOURCE_GROUPS_STORAGE_KEY, JSON.stringify([...openGroups])); } catch { /* optional local preference */ }
  }, [openGroups]);
  const groupIdPrefix = useId();
  const toggleGroup = (key: CollapsibleSourceGroup) => setOpenGroups((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const renderMiningChip = (chip: MiningResourceChip) => {
    const selected = selectedMaterials.has(chip.id);
    const availability = chip.availability ?? "normal";
    const disabled = availability === "disabled";
    const unavailable = availability === "selectedUnavailable";
    const qualifier = unavailable || disabled ? ", " + UNAVAILABLE_CHIP_NOTE : "";
    return (
      <button
        key={chip.id} type="button" data-resource-category="mining" data-resource-name={chip.label}
        className={"mining-filter-chip mining-filter-chip--material source-index-chip" +
          (selected ? " is-active" : "") + MINING_CHIP_CLASS[availability]}
        aria-pressed={selected} aria-label={chip.label + qualifier}
        title={qualifier ? chip.label + qualifier : undefined}
        disabled={disabled} onClick={() => { if (!selectionLocked) onToggleMaterial(chip.id); }}>
        {chip.label}
      </button>
    );
  };

  const renderJournalChips = (category: JournalCategory, names: readonly string[]) =>
    names.map((name) => {
      const key = journalResourceKey(category, name);
      const selected = selectedJournalResources.has(key);
      const availability = journalAvailability.get(key) ?? "unknown";
      const note = journalEvidenceKnown
        ? availability === "muted" ? ": no shared published Journal habitat reported" : ": reported habitat"
        : ": published Journal habitat evidence unavailable";
      return (
        <button
          key={key} type="button" data-resource-category={category} data-resource-name={name}
          className={"mining-filter-chip mining-filter-chip--material source-index-chip" +
            (selected ? " is-active" : "") + (availability === "muted" && !selected ? " is-muted" : "")}
          aria-pressed={selected} aria-label={name + note} title={name + note}
          onClick={() => onToggleJournalResource(category, name)}>
          {name}
        </button>
      );
    });

  const journalGroup = (heading: string, category: CollapsibleSourceGroup, names: readonly string[]) => {
    const open = openGroups.has(category);
    const bodyId = `${groupIdPrefix}-${category}`;
    const picked = names.filter((name) => selectedJournalResources.has(journalResourceKey(category, name))).length;
    return (
      <section className={"source-index-group source-index-group--collapsible" + (open ? "" : " is-collapsed")} aria-label={heading}>
        <button type="button" className="source-index-group-heading source-index-group-toggle"
          aria-expanded={open} aria-controls={bodyId} onClick={() => toggleGroup(category)}>
          <span><svg className="source-index-group-caret" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>{heading}</span>
          {picked > 0 && <span className="source-index-group-count">{picked} selected</span>}
        </button>
        <div id={bodyId} className="mining-filter-chips source-index-chip-flow" role="group" aria-label={heading + " selections"} hidden={!open}>
          {renderJournalChips(category, names)}
        </div>
      </section>
    );
  };

  // Mining materials grouped by the existing chip mining type; anything
  // unclassified stays visible in a final group rather than disappearing.
  const methodGroups = MINING_METHOD_GROUPS.map((group) => ({
    heading: group.heading,
    chips: miningResources.filter((chip) => group.matches(chip.miningType ?? "")),
  }));
  const grouped = new Set(methodGroups.flatMap((group) => group.chips.map((chip) => chip.id)));
  const otherChips = miningResources.filter((chip) => !grouped.has(chip.id));
  if (otherChips.length > 0) methodGroups.push({ heading: "Other mining", chips: otherChips });

  return (
    <div className="scintel-filter-shell mining-filter-compact mining-left-rail-filters source-index-shell">
      <div className="scintel-filter-body mining-filter-drawer">
        <div className="mining-filter-chip-block">
          <section className="source-index-group source-index-group--mining" aria-label="Mining">
            <div className="source-index-group-heading">
              <span>Materials</span>
              <button type="button" className="mining-material-clear-button"
                disabled={selectedCount === 0} aria-disabled={selectedCount === 0} onClick={onClearMaterials}>
                Clear all
              </button>
            </div>
            {methodGroups.filter((group) => group.chips.length > 0).map((group) => (
              <div key={group.heading} className="source-index-method-group">
                <div className="source-index-method-heading">{group.heading}</div>
                <div className="mining-filter-chips source-index-chip-flow" role="group" aria-label={group.heading + " selections"}>
                  {group.chips.map(renderMiningChip)}
                </div>
              </div>
            ))}
          </section>
          {journalGroup("Plant Life", "plant", PLANT_LIFE_RESOURCE_NAMES)}
          {journalGroup("Wildlife", "wildlife", WILDLIFE_RESOURCE_NAMES)}
        </div>
      </div>
    </div>
  );
}
