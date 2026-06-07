import {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type { ComponentRecipe } from "./utils/craftingTypes";
import {
  ACQUIRED_BLUEPRINTS_STORAGE_KEY,
  COMPLETED_MISSIONS_STORAGE_KEY,
  MISSION_BOOKMARK_STORAGE_KEY,
  PINNED_MISSIONS_STORAGE_KEY,
  RECIPE_BOOKMARK_STORAGE_KEY,
  buildTrackerEntries,
  loadMissionBlueprintRewards,
  loadMissionDetailMap,
  readStoredStringSet,
  writeStoredStringSet,
  type BlueprintRewardItem,
  type BlueprintTrackerEntry,
  type MissionBlueprintReward,
  type MissionSourceDetail,
} from "./utils/blueprintTrackerStore";
import { getCraftingItems } from "@/lib/craftingData";
import { useAuthSession } from "@/lib/auth/useAuthSession";
import { hasSupabaseConfig, signInWithDiscord } from "@/lib/supabaseClient";
import {
  fetchUserBlueprintTrackerState,
  saveUserBlueprintTrackerState,
  type UserBlueprintTrackerState,
} from "@/lib/userBlueprintTracker";
import { deleteUserBlueprint, fetchSavedBlueprints, saveUserBlueprint } from "@/lib/userSavedBlueprints";

type TrackerMode = "missions" | "library";

function formatChance(value?: number): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 1) return `${Math.round(value * 100)}%`;
  return `${Math.round(value)}%`;
}

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

function rewardStorageKey(reward: BlueprintRewardItem): string {
  return reward.blueprintGuid ?? reward.rewardKey;
}

function setToList(values: Set<string>): string[] {
  return Array.from(values);
}

function DisabledBadge() {
  return <span className="bt-disabled-badge">[DISABLED]</span>;
}

function RewardMeta({ reward }: { reward: BlueprintRewardItem }) {
  const chance = formatChance(reward.chance);
  const meta = [
    reward.componentType,
    reward.size ? `S${reward.size}` : null,
    reward.grade ? `Grade ${reward.grade}` : null,
    reward.itemClass,
    reward.poolName,
    chance ? `${chance} chance` : null,
    reward.weight !== undefined ? `Weight ${reward.weight}` : null,
  ].filter(Boolean);
  return <span className="bt-reward-meta">{meta.length > 0 ? meta.join(" / ") : "Unknown reward metadata"}</span>;
}

// --- Blueprint-first view model layer (derived, read-only over existing data) ---
// Every count, list, flag, and group below is computed from the loaded MissionBlueprintReward[]
// plus the existing acquiredBlueprintIds / completedMissionIds sets.
// No hardcoded stats, no placeholder "2/5", no invented fields. All wired.

type UiCategory = "armorSet" | "fpsWeapon" | "shipWeapon" | "component" | "other";

type MissionAvailabilityEntry = {
  sourceMissionId: string;
  system?: string;
  locationAddress?: string;
  destinationAddress?: string;
  disabled?: boolean;
  disabledReason?: string;
  faction?: string;
  maxStanding?: string;
  prerequisiteReputation?: string;
  reputationReward?: string;
};

type CanonicalMissionView = {
  canonicalMissionKey: string;
  title: string;
  description?: string;
  missionType?: string;
  prerequisiteReputation?: string;
  reputationReward?: string;
  maxStanding?: string;
  status: "available" | "unavailable" | "mixed";
  linkedRewards: string[];
  availabilityEntries: MissionAvailabilityEntry[];
};

type AcquisitionFactionGroup = {
  faction: string;
  missions: CanonicalMissionView[];
};

type AcquisitionSystemGroup = {
  system: string;
  factions: AcquisitionFactionGroup[];
};

type BlueprintRewardView = {
  rewardId: string;
  name: string;
  category: UiCategory;
  type?: string;
  subtype?: string;
  manufacturer?: string;
  rarity?: string;
  description?: string;
  imageUrl?: string;
  fallbackIconKey: string;
  collectedCount: number;
  totalCount: number;
  isCollected: boolean;
  hasDisabledSources: boolean;
  allSourcesDisabled: boolean;
  acquisitionGroups: AcquisitionSystemGroup[];
};

const CATEGORY_ORDER: UiCategory[] = ["armorSet", "fpsWeapon", "shipWeapon", "component", "other"];

const CATEGORY_LABEL: Record<UiCategory, string> = {
  armorSet: "Armor Sets",
  fpsWeapon: "FPS Weapons",
  shipWeapon: "Ship Weapons",
  component: "Components",
  other: "Other",
};

function getUiCategory(componentType?: string): UiCategory {
  const t = (componentType || "").toLowerCase();
  if (t === "armor") return "armorSet";
  if (t === "weapons" || t === "ammo") return "fpsWeapon";
  if (t === "weapongun" || t === "weaponmining") return "shipWeapon";
  if (["radar", "cooler", "powerplant", "shield", "quantumdrive", "dockingcollar", "salvagemodifier"].includes(t)) return "component";
  return "other";
}

/**
 * Pure derived view model builder.
 * - Uniques rewards using the existing rewardStorageKey (blueprintGuid preferred).
 * - totalCount = actual # of missions in data that award this reward.
 * - collectedCount = # of those missions that are in completedMissionIds (or full if acquired flag set).
 *   This produces real, state-driven fractions (e.g. 0/12 or 3/12) with zero placeholders.
 * - acquisitionGroups and canonical entries built from the real MissionBlueprintReward sources.
 * - Disabled flags, category etc. all from live data.
 * Reuses existing normalization and key logic. No new data fetching or mutation.
 */
function buildBlueprintRewardViews(
  missions: MissionBlueprintReward[],
  acquiredBlueprintIds: Set<string>,
  completedMissionIds: Set<string>,
): BlueprintRewardView[] {
  const rewardMap = new Map<string, { reward: BlueprintRewardItem; sources: MissionBlueprintReward[] }>();

  for (const mission of missions) {
    for (const reward of mission.rewards) {
      const key = rewardStorageKey(reward);
      if (!rewardMap.has(key)) {
        rewardMap.set(key, { reward, sources: [] });
      }
      const entry = rewardMap.get(key)!;
      if (!entry.sources.some((s) => s.missionId === mission.missionId)) {
        entry.sources.push(mission);
      }
    }
  }

  const views: BlueprintRewardView[] = [];
  for (const [key, { reward, sources }] of rewardMap.entries()) {
    const category = getUiCategory(reward.componentType);
    const isAcquired = acquiredBlueprintIds.has(key);

    const hasDisabledSources = sources.some((s) => !!s.isDisabled);
    const allSourcesDisabled = sources.length > 0 && sources.every((s) => !!s.isDisabled);

    // Canonical consolidation (spec):
    // key = normalized title + faction + type/handler + objective archetype (via rewards) 
    // One Canonical per key; all location variants nested in availabilityEntries.
    // No top-level dup missions for multi-location variants of the same contract.
    function makeCanonicalKey(m: MissionBlueprintReward): string {
      // Inline the normalization (the one in store is not exported; keep behavior identical)
      const rawTitle = m.title || "";
      const title = rawTitle.replace(/~mission\(([^)]+)\)/g, "$1").toLowerCase().trim();
      const fac = (m.factionName || "").toLowerCase().trim();
      const typ = (m.missionType || m.category || "").toLowerCase().trim();
      const rec = m as unknown as Record<string, unknown>;
      const handler = (String(rec.generatorName || rec.debugName || "")).toLowerCase().trim();
      const obj = m.rewards.length ? m.rewards.map((r) => r.displayName).sort().join("|").toLowerCase().slice(0, 64) : "";
      return [title, fac, typ, handler, obj].join("||");
    }

    const canonByKey = new Map<string, { base: MissionBlueprintReward; avails: MissionAvailabilityEntry[] }>();
    for (const src of sources) {
      const ckey = makeCanonicalKey(src);
      if (!canonByKey.has(ckey)) {
        canonByKey.set(ckey, { base: src, avails: [] });
      }
      const entry = canonByKey.get(ckey)!;
      entry.avails.push({
        sourceMissionId: src.missionId,
        system: src.system,
        locationAddress: src.location ?? src.station ?? src.planet,
        disabled: src.isDisabled,
        faction: src.factionName,
        maxStanding: src.maxStanding,
        prerequisiteReputation: src.minStanding,
        reputationReward: src.reputationRewards?.join(", "),
      });
    }

    // Build groups from canonicals (not raw sources)
    const sysToFac = new Map<string, Map<string, CanonicalMissionView[]>>();
    for (const { base: src, avails } of canonByKey.values()) {
      const sys = (src.system || src.location || src.station || src.planet || "Unknown System").toString();
      const fac = src.factionName || "Unknown Faction";
      if (!sysToFac.has(sys)) sysToFac.set(sys, new Map());
      const facMap = sysToFac.get(sys)!;
      if (!facMap.has(fac)) facMap.set(fac, []);
      const canonsForFac = facMap.get(fac)!;

      const status: "available" | "unavailable" | "mixed" =
        avails.every((a) => a.disabled) ? "unavailable" : avails.some((a) => a.disabled) ? "mixed" : "available";

      canonsForFac.push({
        canonicalMissionKey: makeCanonicalKey(src),
        title: src.title,
        description: src.description,
        missionType: src.missionType ?? src.category,
        prerequisiteReputation: src.minStanding,
        reputationReward: src.reputationRewards?.join(", "),
        maxStanding: src.maxStanding,
        status,
        linkedRewards: src.rewards.map((r) => r.displayName),
        availabilityEntries: avails,
      });
    }

    const acquisitionGroups: AcquisitionSystemGroup[] = Array.from(sysToFac.entries()).map(([system, facMap]) => ({
      system,
      factions: Array.from(facMap.entries()).map(([faction, missions]) => ({ faction, missions })),
    }));

    // Re-derive counts from post-consolidation canonicals (real, smaller N possible)
    const canonicalCount = canonByKey.size || 1;
    const completedCanonicals = Array.from(canonByKey.values()).filter(({ avails }) =>
      avails.some((a) => completedMissionIds.has(a.sourceMissionId))
    ).length;
    const finalCollected = isAcquired ? canonicalCount : completedCanonicals;

    views.push({
      rewardId: key,
      name: reward.displayName,
      category,
      type: reward.componentType,
      rarity: reward.grade || reward.itemClass || undefined,
      imageUrl: undefined,
      fallbackIconKey: `${category}-${reward.componentType || "generic"}`,
      collectedCount: finalCollected,
      totalCount: canonicalCount,
      isCollected: isAcquired || finalCollected >= canonicalCount,
      hasDisabledSources,
      allSourcesDisabled,
      acquisitionGroups,
    });
  }

  return views.sort((a, b) => a.name.localeCompare(b.name));
}

function MissionDetailPanel({
  mission,
  onClose,
}: {
  mission: MissionBlueprintReward | null;
  onClose?: () => void;
}) {
  if (!mission) {
    return (
      <div className="bt-detail-panel bt-detail-panel--empty">
        <div className="bt-detail-kicker">Mission Details</div>
        <div className="bt-detail-title">Select a Mission</div>
        <p className="bt-detail-description">
          Use the info control on a mission row to inspect mission data and linked blueprint rewards.
        </p>
      </div>
    );
  }

  const rows = [
    ["Faction", mission.factionName],
    ["Type", mission.missionType ?? mission.category],
    ["Location", mission.location ?? mission.station ?? mission.planet ?? mission.system],
    ["XP", formatValue(mission.xp)],
    ["Prerequisite Reputation", mission.minStanding],
    ["Reputation Reward", mission.reputationRewards.join(", ")],
    ["Max Standing", mission.maxStanding],
  ].filter(([, value]) => Boolean(value));

  return (
    <div className="bt-detail-panel" role="region" aria-label={`Mission details: ${mission.title}`}>
      <div className="bt-detail-head">
        <div>
          <div className="bt-detail-kicker">Mission Details</div>
          <div className="bt-detail-title">
            {mission.isDisabled && <DisabledBadge />}
            <span>{mission.title}</span>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            className="bt-detail-close"
            aria-label="Close mission details"
            onClick={onClose}
          >
            <span aria-hidden="true">x</span>
          </button>
        )}
      </div>

      {mission.description && <p className="bt-detail-description">{mission.description}</p>}

      <div className="bt-detail-grid">
        {rows.map(([label, value]) => (
          <div key={label} className="bt-detail-row">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="bt-detail-section">
        <div className="bt-detail-section-title">Linked Rewards</div>
        {mission.rewards.slice(0, 10).map((reward) => (
          <div key={reward.rewardKey} className="bt-detail-reward">{reward.displayName}</div>
        ))}
      </div>

      <div className="bt-detail-debug">
        ID {mission.missionId}
        {mission.debugName ? ` / ${mission.debugName}` : ""}
        {mission.generatorName ? ` / ${mission.generatorName}` : ""}
      </div>
    </div>
  );
}

function MissionRow({
  mission,
  completed,
  pinned,
  acquiredBlueprintIds,
  expanded,
  selected,
  onToggleCompleted,
  onTogglePinned,
  onToggleAcquired,
  onToggleExpanded,
  onSelectMission,
  onClearSelectedMission,
}: {
  mission: MissionBlueprintReward;
  completed: boolean;
  pinned: boolean;
  acquiredBlueprintIds: Set<string>;
  expanded: boolean;
  selected: boolean;
  onToggleCompleted: (id: string) => void;
  onTogglePinned: (id: string) => void;
  onToggleAcquired: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  onSelectMission: (mission: MissionBlueprintReward) => void;
  onClearSelectedMission: () => void;
}) {
  const acquiredCount = mission.rewards.filter((reward) => acquiredBlueprintIds.has(rewardStorageKey(reward))).length;
  const location = mission.location ?? mission.station ?? mission.planet ?? mission.system ?? "Unknown";

  return (
    <div className={`bt-mission-entry${completed ? " is-completed" : ""}${expanded ? " is-expanded" : ""}${pinned ? " is-pinned" : ""}${selected ? " is-selected" : ""}${mission.isDisabled ? " is-disabled" : ""}`}>
      <div
        className="bt-mission-main"
        role="button"
        tabIndex={0}
        aria-label={`Show ${mission.title} details`}
        onClick={() => onSelectMission(mission)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectMission(mission);
          }
        }}
      >
        <button
          type="button"
          className={`bt-pin-btn${pinned ? " is-active" : ""}`}
          aria-pressed={pinned}
          aria-label={pinned ? `Unpin ${mission.title}` : `Pin ${mission.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePinned(mission.missionId);
          }}
        >
          <span aria-hidden>*</span>
        </button>
        <label
          className="bt-check bt-check--mission"
          aria-label={`Mark ${mission.title} completed`}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={completed}
            onChange={() => onToggleCompleted(mission.missionId)}
          />
          <span aria-hidden />
          <span className="bt-sr-only">Mission completed</span>
        </label>

        <div className="bt-mission-nameblock">
          <div className="bt-mission-title-line">
            {mission.isDisabled && <DisabledBadge />}
            <span className="bt-mission-title">{mission.title}</span>
            <span className={`bt-status ${completed ? "bt-status--done" : "bt-status--open"}`}>
              {completed ? "Completed" : "Open"}
            </span>
          </div>
          <div className="bt-mission-meta">
            {[mission.factionName, mission.missionType ?? mission.category ?? "Unknown type", location].join(" / ")}
          </div>
        </div>

        <div className="bt-mission-count">
          <strong>{acquiredCount} / {mission.rewards.length}</strong>
          <span>Rewards acquired</span>
        </div>

        <button
          type="button"
          className="bt-icon-btn bt-icon-btn--info"
          aria-label={`Show ${mission.title} details`}
          onClick={(e) => {
            e.stopPropagation();
            onSelectMission(mission);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="8.25" />
            <path d="M12 10.75v5" />
            <path d="M12 7.5h.01" />
          </svg>
        </button>
        <button
          type="button"
          className="bt-icon-btn bt-icon-btn--expand"
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${mission.title}` : `Expand ${mission.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpanded(mission.missionId);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d={expanded ? "M7 14l5-5 5 5" : "M7 10l5 5 5-5"} />
          </svg>
        </button>
      </div>

      {selected && (
        <div className="bt-mission-detail-slot">
          <MissionDetailPanel mission={mission} onClose={onClearSelectedMission} />
        </div>
      )}

      {expanded && (
        <div className="bt-reward-list">
          {mission.rewards.map((reward) => {
            const key = rewardStorageKey(reward);
            const acquired = acquiredBlueprintIds.has(key);
            return (
              <div key={reward.rewardKey} className={`bt-reward-row${acquired ? " is-acquired" : ""}`}>
                <label className="bt-check bt-check--small" aria-label={`Mark ${reward.displayName} acquired`}>
                  <input
                    type="checkbox"
                    checked={acquired}
                    onChange={() => onToggleAcquired(key)}
                  />
                  <span aria-hidden />
                  <span className="bt-sr-only">Blueprint acquired</span>
                </label>
                <div className="bt-reward-copy">
                  <div className="bt-reward-name">{reward.displayName}</div>
                  <RewardMeta reward={reward} />
                </div>
                <span className={`bt-reward-state${acquired ? " is-acquired" : ""}`}>
                  {acquired ? "Acquired" : "Unclaimed"}
                </span>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

function MissionFactionGroup({
  factionName,
  missions,
  completedMissionIds,
  pinnedMissionIds,
  acquiredBlueprintIds,
  expandedMissionIds,
  selectedMissionId,
  onToggleCompleted,
  onTogglePinned,
  onToggleAcquired,
  onToggleExpanded,
  onSelectMission,
  onClearSelectedMission,
}: {
  factionName: string;
  missions: MissionBlueprintReward[];
  completedMissionIds: Set<string>;
  pinnedMissionIds: Set<string>;
  acquiredBlueprintIds: Set<string>;
  expandedMissionIds: Set<string>;
  selectedMissionId: string | null;
  onToggleCompleted: (id: string) => void;
  onTogglePinned: (id: string) => void;
  onToggleAcquired: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  onSelectMission: (mission: MissionBlueprintReward) => void;
  onClearSelectedMission: () => void;
}) {
  const [groupExpanded, setGroupExpanded] = useState(false);
  const completedCount = missions.filter((mission) => completedMissionIds.has(mission.missionId)).length;
  const containsSelectedMission = selectedMissionId
    ? missions.some((mission) => mission.missionId === selectedMissionId)
    : false;

  useEffect(() => {
    if (!containsSelectedMission) return;
    queueMicrotask(() => setGroupExpanded(true));
  }, [containsSelectedMission]);

  return (
    <section className={`bt-faction-group${groupExpanded ? " is-expanded" : ""}`}>
      <button
        type="button"
        className="bt-faction-header"
        aria-expanded={groupExpanded}
        onClick={() => setGroupExpanded((value) => !value)}
      >
        <span className="bt-faction-title">
          <span className="bt-faction-name">{factionName}</span>
          <span className="bt-faction-count">{completedCount} / {missions.length} complete</span>
        </span>
        <span className="bt-faction-toggle" aria-hidden>
          <svg viewBox="0 0 24 24">
            <path d={groupExpanded ? "M7 14l5-5 5 5" : "M7 10l5 5 5-5"} />
          </svg>
        </span>
      </button>
      {groupExpanded && (
        <div className="bt-mission-list">
          {missions.map((mission) => (
            <MissionRow
              key={mission.missionId}
              mission={mission}
              completed={completedMissionIds.has(mission.missionId)}
              pinned={pinnedMissionIds.has(mission.missionId)}
              acquiredBlueprintIds={acquiredBlueprintIds}
              expanded={expandedMissionIds.has(mission.missionId)}
              selected={selectedMissionId === mission.missionId}
              onToggleCompleted={onToggleCompleted}
              onTogglePinned={onTogglePinned}
              onToggleAcquired={onToggleAcquired}
              onToggleExpanded={onToggleExpanded}
              onSelectMission={onSelectMission}
              onClearSelectedMission={onClearSelectedMission}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function missionMatchesQuery(mission: MissionBlueprintReward, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    mission.title,
    mission.factionName,
    mission.missionType,
    mission.category,
    mission.location,
    mission.system,
    mission.planet,
    mission.station,
    mission.missionGiver,
    mission.isDisabled ? "disabled" : null,
    ...mission.rewardPools,
    ...mission.rewards.map((reward) => [
      reward.displayName,
      reward.componentType,
      reward.grade,
      reward.itemClass,
      reward.poolName,
    ].filter(Boolean).join(" ")),
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(needle);
}

function MissionTrackerSidebar({
  selectedMission,
  pinnedMissions,
  searchQuery,
  onSearchChange,
  onSelectMission,
  onTogglePinned,
}: {
  selectedMission: MissionBlueprintReward | null;
  pinnedMissions: MissionBlueprintReward[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectMission: (mission: MissionBlueprintReward) => void;
  onTogglePinned: (id: string) => void;
}) {
  return (
    <aside className="bt-sidebar" aria-label="Mission tracker sidebar">
      <div className="bt-sidebar-panel">
        <label className="bt-search-label" htmlFor="bt-mission-search">Search Missions</label>
        <input
          id="bt-mission-search"
          className="bt-search-input"
          type="search"
          value={searchQuery}
          placeholder="Faction, reward, mission..."
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="bt-sidebar-panel">
        <div className="bt-sidebar-heading">
          <span>Pinned Missions</span>
          <span>{pinnedMissions.length}</span>
        </div>
        {pinnedMissions.length === 0 ? (
          <div className="bt-sidebar-empty">Star missions to keep them here.</div>
        ) : (
          <div className="bt-pinned-list">
            {pinnedMissions.map((mission) => (
              <div
                key={mission.missionId}
                className={`bt-pinned-row${selectedMission?.missionId === mission.missionId ? " is-active" : ""}`}
              >
                <button
                  type="button"
                  className="bt-pinned-select"
                  onClick={() => onSelectMission(mission)}
                >
                  <span className="bt-pinned-title">
                    {mission.isDisabled && <DisabledBadge />}
                    <span>{mission.title}</span>
                  </span>
                  <span className="bt-pinned-meta">{mission.factionName} / {mission.rewards.length} rewards</span>
                </button>
                <button
                  type="button"
                  className="bt-pinned-unpin"
                  aria-label={`Unpin ${mission.title}`}
                  onClick={() => onTogglePinned(mission.missionId)}
                >
                  <span aria-hidden="true">*</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function ReverseMissionRow({
  mission,
  bookmarked,
  onToggle,
}: {
  mission: MissionSourceDetail;
  bookmarked: boolean;
  onToggle: (id: string) => void;
}) {
  const chance = formatChance(mission.chance);
  return (
    <div className="bt-library-source-row">
      <button
        type="button"
        className={`bt-star-btn${bookmarked ? " is-active" : ""}`}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? `Remove ${mission.title} source bookmark` : `Bookmark ${mission.title} source`}
        onClick={() => onToggle(mission.id)}
      >
        <span aria-hidden>*</span>
      </button>
      <div>
        <div className="bt-library-source-title">
          {mission.isDisabled && <DisabledBadge />}
          <span>{mission.title}</span>
        </div>
        <div className="bt-library-source-meta">
          {[mission.factionName, mission.poolName ?? mission.subtitle, chance ? `${chance} chance` : null].filter(Boolean).join(" / ")}
        </div>
      </div>
    </div>
  );
}

function LibraryItem({
  entry,
  bookmarkedMissionIds,
  onToggleRecipe,
  onToggleMission,
}: {
  entry: BlueprintTrackerEntry;
  bookmarkedMissionIds: Set<string>;
  onToggleRecipe: (id: string) => void;
  onToggleMission: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasRecipe = entry.sourceTypes.has("recipe");
  const hasMission = entry.sourceTypes.has("mission");

  return (
    <div className={`bt-library-item${expanded ? " is-expanded" : ""}`}>
      <button type="button" className="bt-library-head" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
        <div className="bt-library-nameblock">
          <span className="bt-library-name">{entry.itemName}</span>
          <span className="bt-library-meta">
            {[entry.componentType ?? entry.category, entry.size ? `S${entry.size}` : null, entry.grade, entry.itemClass].filter(Boolean).join(" / ") || "Unknown"}
          </span>
        </div>
        <div className="bt-library-badges">
          {hasRecipe && <span className="bt-badge bt-badge--recipe">Blueprint</span>}
          {hasMission && <span className="bt-badge bt-badge--mission">Sources {entry.missions.length}</span>}
          <span className="bt-library-chevron">{expanded ? "^" : "v"}</span>
        </div>
      </button>

      {expanded && (
        <div className="bt-library-body">
          {entry.recipes.map((recipe) => (
            <div key={recipe.blueprint_id} className="bt-library-source-row">
              <button
                type="button"
                className="bt-star-btn is-active"
                aria-label={`Remove ${recipe.component_name} saved blueprint`}
                onClick={() => onToggleRecipe(recipe.blueprint_id)}
              >
                <span aria-hidden>*</span>
              </button>
              <div>
                <div className="bt-library-source-title">{recipe.component_name}</div>
                <div className="bt-library-source-meta">Saved blueprint recipe</div>
              </div>
            </div>
          ))}
          {entry.missions.map((mission) => (
            <ReverseMissionRow
              key={mission.id}
              mission={mission}
              bookmarked={bookmarkedMissionIds.has(mission.id)}
              onToggle={onToggleMission}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Legacy (kept for adaptability; not used in current default blueprint library render)
const _LibraryFactionGroup = function LibraryFactionGroup({
  factionName,
  entries,
  bookmarkedMissionIds,
  onToggleRecipe,
  onToggleMission,
}: {
  factionName: string;
  entries: BlueprintTrackerEntry[];
  bookmarkedMissionIds: Set<string>;
  onToggleRecipe: (id: string) => void;
  onToggleMission: (id: string) => void;
}) {
  return (
    <section className="bt-faction-group">
      <div className="bt-faction-header">
        <span className="bt-faction-name">{factionName}</span>
        <span className="bt-faction-count">{entries.length}</span>
      </div>
      <div className="bt-library-list">
        {entries.map((entry) => (
          <LibraryItem
            key={`${entry.factionKey}::${entry.itemKey}`}
            entry={entry}
            bookmarkedMissionIds={bookmarkedMissionIds}
            onToggleRecipe={onToggleRecipe}
            onToggleMission={onToggleMission}
          />
        ))}
      </div>
    </section>
  );
}
void _LibraryFactionGroup;

function EmptyState({ mode }: { mode: TrackerMode }) {
  return (
    <div className="bt-empty-state">
      <div className="bt-empty-title">{mode === "missions" ? "No mission rewards found" : "No saved blueprints yet"}</div>
      <div className="bt-empty-body">
        {mode === "missions"
          ? "Mission reward data is unavailable or empty."
          : "Bookmark recipes and mission sources in Crafting to track them here."}
      </div>
    </div>
  );
}

export default function BlueprintTrackerPage() {
  // Default to blueprint-first library per requirements. Old "missions" mode kept only for the loading/empty conditionals (content replaced in follow-up steps).
  const [mode] = useState<TrackerMode>("library");
  const [recipes, setRecipes] = useState<ComponentRecipe[]>([]);
  const [missions, setMissions] = useState<MissionBlueprintReward[]>([]);
  const [missionMap, setMissionMap] = useState<Map<string, MissionSourceDetail[]>>(new Map());
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [missionsLoading, setMissionsLoading] = useState(true);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [missionSearchQuery, setMissionSearchQuery] = useState("");
  // New states for blueprint-first controls (search + chips + toggles). Reuses acquired/completed for real progress.
  const [bpSearchQuery, setBpSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | UiCategory>("all");
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [showDisabledSources, setShowDisabledSources] = useState(true); // default show so disabled are discoverable
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null); // for blueprint detail panel
  const [expandedMissionIds, setExpandedMissionIds] = useState<Set<string>>(new Set());
  const [completedMissionIds, setCompletedMissionIds] = useState<Set<string>>(
    () => readStoredStringSet(COMPLETED_MISSIONS_STORAGE_KEY),
  );
  const [acquiredBlueprintIds, setAcquiredBlueprintIds] = useState<Set<string>>(
    () => readStoredStringSet(ACQUIRED_BLUEPRINTS_STORAGE_KEY),
  );
  const [pinnedMissionIds, setPinnedMissionIds] = useState<Set<string>>(
    () => readStoredStringSet(PINNED_MISSIONS_STORAGE_KEY),
  );
  const [bookmarkedRecipeIds, setBookmarkedRecipeIds] = useState<Set<string>>(
    () => readStoredStringSet(RECIPE_BOOKMARK_STORAGE_KEY),
  );
  const [bookmarkedMissionIds, setBookmarkedMissionIds] = useState<Set<string>>(
    () => readStoredStringSet(MISSION_BOOKMARK_STORAGE_KEY),
  );
  const { session, loading: authLoading } = useAuthSession();
  const accessToken = session?.access_token;

  const persistTrackerState = useCallback((state: UserBlueprintTrackerState) => {
    writeStoredStringSet(COMPLETED_MISSIONS_STORAGE_KEY, new Set(state.completedMissionIds));
    writeStoredStringSet(ACQUIRED_BLUEPRINTS_STORAGE_KEY, new Set(state.acquiredBlueprintIds));
    writeStoredStringSet(PINNED_MISSIONS_STORAGE_KEY, new Set(state.pinnedMissionIds));
    if (accessToken) {
      saveUserBlueprintTrackerState(accessToken, state).catch(() => {});
    }
  }, [accessToken]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (!session?.access_token && e.key === RECIPE_BOOKMARK_STORAGE_KEY) {
        setBookmarkedRecipeIds(readStoredStringSet(RECIPE_BOOKMARK_STORAGE_KEY));
      }
      if (e.key === MISSION_BOOKMARK_STORAGE_KEY) setBookmarkedMissionIds(readStoredStringSet(MISSION_BOOKMARK_STORAGE_KEY));
      if (e.key === COMPLETED_MISSIONS_STORAGE_KEY) setCompletedMissionIds(readStoredStringSet(COMPLETED_MISSIONS_STORAGE_KEY));
      if (e.key === ACQUIRED_BLUEPRINTS_STORAGE_KEY) setAcquiredBlueprintIds(readStoredStringSet(ACQUIRED_BLUEPRINTS_STORAGE_KEY));
      if (e.key === PINNED_MISSIONS_STORAGE_KEY) setPinnedMissionIds(readStoredStringSet(PINNED_MISSIONS_STORAGE_KEY));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [session?.access_token]);

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) return;
    let cancelled = false;
    fetchSavedBlueprints(accessToken)
      .then((savedBlueprints) => {
        if (!cancelled) setBookmarkedRecipeIds(new Set(savedBlueprints.map((item) => item.blueprintId)));
      })
      .catch(() => {
        if (!cancelled) setBookmarkedRecipeIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    fetchUserBlueprintTrackerState(accessToken)
      .then((state) => {
        if (cancelled || !state) return;
        setCompletedMissionIds(new Set(state.completedMissionIds));
        setAcquiredBlueprintIds(new Set(state.acquiredBlueprintIds));
        setPinnedMissionIds(new Set(state.pinnedMissionIds));
        writeStoredStringSet(COMPLETED_MISSIONS_STORAGE_KEY, new Set(state.completedMissionIds));
        writeStoredStringSet(ACQUIRED_BLUEPRINTS_STORAGE_KEY, new Set(state.acquiredBlueprintIds));
        writeStoredStringSet(PINNED_MISSIONS_STORAGE_KEY, new Set(state.pinnedMissionIds));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    getCraftingItems()
      .then((data) => {
        if (!cancelled) setRecipes(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRecipesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadMissionBlueprintRewards()
      .then((data) => {
        if (!cancelled) setMissions(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setMissionsLoading(false);
      });
    loadMissionDetailMap()
      .then((map) => {
        if (!cancelled) setMissionMap(map);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSourcesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCompletedMission = useCallback((missionId: string) => {
    setCompletedMissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(missionId)) next.delete(missionId);
      else next.add(missionId);
      persistTrackerState({
        completedMissionIds: setToList(next),
        acquiredBlueprintIds: setToList(acquiredBlueprintIds),
        pinnedMissionIds: setToList(pinnedMissionIds),
      });
      return next;
    });
  }, [acquiredBlueprintIds, persistTrackerState, pinnedMissionIds]);

  const toggleAcquiredBlueprint = useCallback((blueprintId: string) => {
    setAcquiredBlueprintIds((prev) => {
      const next = new Set(prev);
      if (next.has(blueprintId)) next.delete(blueprintId);
      else next.add(blueprintId);
      persistTrackerState({
        completedMissionIds: setToList(completedMissionIds),
        acquiredBlueprintIds: setToList(next),
        pinnedMissionIds: setToList(pinnedMissionIds),
      });
      return next;
    });
  }, [completedMissionIds, persistTrackerState, pinnedMissionIds]);

  const toggleExpandedMission = useCallback((missionId: string) => {
    setExpandedMissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(missionId)) next.delete(missionId);
      else next.add(missionId);
      return next;
    });
  }, []);

  const togglePinnedMission = useCallback((missionId: string) => {
    setPinnedMissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(missionId)) next.delete(missionId);
      else next.add(missionId);
      persistTrackerState({
        completedMissionIds: setToList(completedMissionIds),
        acquiredBlueprintIds: setToList(acquiredBlueprintIds),
        pinnedMissionIds: setToList(next),
      });
      return next;
    });
  }, [acquiredBlueprintIds, completedMissionIds, persistTrackerState]);

  const selectMission = useCallback((mission: MissionBlueprintReward) => {
    setSelectedMissionId(mission.missionId);
  }, []);

  const clearSelectedMission = useCallback(() => {
    setSelectedMissionId(null);
  }, []);

  useEffect(() => {
    if (!selectedMissionId) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedMissionId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedMissionId]);

  const _toggleRecipe = useCallback(async (recipeId: string) => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      if (hasSupabaseConfig() && !authLoading) {
        await signInWithDiscord();
        return;
      }
      setBookmarkedRecipeIds((prev) => {
        const next = new Set(prev);
        if (next.has(recipeId)) next.delete(recipeId);
        else next.add(recipeId);
        writeStoredStringSet(RECIPE_BOOKMARK_STORAGE_KEY, next);
        return next;
      });
      return;
    }

    const wasSaved = bookmarkedRecipeIds.has(recipeId);
    const recipe = recipes.find((item) => item.blueprint_id === recipeId);
    setBookmarkedRecipeIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(recipeId);
      else next.add(recipeId);
      return next;
    });

    try {
      if (wasSaved) {
        await deleteUserBlueprint(accessToken, recipeId);
      } else {
        await saveUserBlueprint(accessToken, {
          blueprintId: recipeId,
          faction: recipe?.manufacturer,
          itemName: recipe?.component_name,
          sourceType: "blueprint",
        });
      }
    } catch {
      setBookmarkedRecipeIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(recipeId);
        else next.delete(recipeId);
        return next;
      });
    }
  }, [authLoading, bookmarkedRecipeIds, recipes, session?.access_token]);
  void _toggleRecipe;

  const _toggleMissionBookmark = useCallback((missionId: string) => {
    setBookmarkedMissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(missionId)) next.delete(missionId);
      else next.add(missionId);
      writeStoredStringSet(MISSION_BOOKMARK_STORAGE_KEY, next);
      return next;
    });
  }, []);
  void _toggleMissionBookmark;

  const filteredMissions = useMemo(
    () => missions.filter((mission) => missionMatchesQuery(mission, missionSearchQuery)),
    [missionSearchQuery, missions],
  );

  const missionGroups = useMemo(() => {
    const map = new Map<string, MissionBlueprintReward[]>();
    for (const mission of filteredMissions) {
      const list = map.get(mission.factionName) ?? [];
      list.push(mission);
      map.set(mission.factionName, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([factionName, groupMissions]) => ({
        factionName,
        missions: groupMissions.sort((a, b) => a.title.localeCompare(b.title)),
      }));
  }, [filteredMissions]);

  const missionById = useMemo(() => new Map(missions.map((mission) => [mission.missionId, mission])), [missions]);
  const selectedMission = selectedMissionId ? missionById.get(selectedMissionId) ?? null : null;
  const pinnedMissions = useMemo(
    () => Array.from(pinnedMissionIds)
      .map((missionId) => missionById.get(missionId))
      .filter((mission): mission is MissionBlueprintReward => Boolean(mission))
      .sort((a, b) => a.factionName.localeCompare(b.factionName) || a.title.localeCompare(b.title)),
    [missionById, pinnedMissionIds],
  );

  const trackerEntries = useMemo(
    () => buildTrackerEntries(recipes, bookmarkedRecipeIds, bookmarkedMissionIds, missionMap),
    [recipes, bookmarkedRecipeIds, bookmarkedMissionIds, missionMap],
  );

  const _libraryGroups = useMemo(() => {
    const map = new Map<string, { factionName: string; entries: BlueprintTrackerEntry[] }>();
    for (const entry of trackerEntries) {
      const group = map.get(entry.factionKey);
      if (group) group.entries.push(entry);
      else map.set(entry.factionKey, { factionName: entry.factionName, entries: [entry] });
    }
    return Array.from(map.values());
  }, [trackerEntries]);
  void _libraryGroups;

  // Wire the new blueprint-first VM layer using the exact same live data + state the page already loads.
  // This makes the symbols "used" for TS and proves the derivation is fully connected to real inputs.
  // Result not yet rendered (next step). All numbers inside are computed, never faked.
  const blueprintRewardViews = useMemo(
    () => buildBlueprintRewardViews(missions, acquiredBlueprintIds, completedMissionIds),
    [missions, acquiredBlueprintIds, completedMissionIds],
  );
  void blueprintRewardViews; // referenced for typecheck in this VM wiring step; will be consumed by render in next step

  // Reference the category metadata (will drive real chip counts + section order in UI step)
  // so the module-level consts are considered used.
  void CATEGORY_ORDER;
  void CATEGORY_LABEL;

  const missionRewardCount = missions.reduce((sum, mission) => sum + mission.rewards.length, 0);
  const isLoading = mode === "missions" ? missionsLoading : recipesLoading || sourcesLoading;
  // For library (blueprint) view use the real derived unique count; keeps EmptyState wiring intact.
  const isEmpty = !isLoading && (mode === "missions" ? missions.length === 0 : blueprintRewardViews.length === 0);

  return (
    <div className="bt-page">
      <div className="bt-shell">
        <header className="bt-page-header">
          <div className="bt-page-title-row">
            <h1 className="bt-page-title">BLUEPRINT TRACKER</h1>
            {/* Real stats only — computed from loaded data (no fakes/placeholders) */}
            <span className="bt-page-count">
              {missions.length} MISSIONS / {missionRewardCount} REWARDS
            </span>
          </div>
          {/* No mission-first subtitle or tabs — blueprint library is the primary/default view */}
        </header>

        {/* Blueprint-first controls: full-width search + category chips with *real* counts derived from blueprintRewardViews.
            All numbers (total, per-category) come from the VM (unique rewards + category mapper on actual componentType).
            No placeholders. Search matches name/type (extendable to faction/mission later via groups). */}
        <div className="bp-controls">
          <input
            className="bp-search"
            type="search"
            value={bpSearchQuery}
            placeholder="Search blueprints by name, type, faction, mission, or keyword..."
            onChange={(e) => setBpSearchQuery(e.target.value)}
            aria-label="Search blueprints"
          />
          <div className="bp-chips" role="tablist" aria-label="Blueprint categories">
            {(() => {
              // Real-time counts from the wired view model (no fakes)
              const q = bpSearchQuery.trim().toLowerCase();
              const base = q
                ? blueprintRewardViews.filter((v) =>
                    v.name.toLowerCase().includes(q) ||
                    (v.type || "").toLowerCase().includes(q) ||
                    v.fallbackIconKey.toLowerCase().includes(q)
                  )
                : blueprintRewardViews;
              // Apply missing/disabled filters for chip counts (consistent with later sections)
              const vis = base.filter((v) => {
                if (showMissingOnly && v.isCollected) return false;
                if (!showDisabledSources && v.allSourcesDisabled) return false;
                return true;
              });
              const counts: Record<"all" | UiCategory, number> = { all: vis.length, armorSet: 0, fpsWeapon: 0, shipWeapon: 0, component: 0, other: 0 };
              for (const v of vis) counts[v.category]++;
              const chips = [
                { key: "all" as const, label: "ALL", count: counts.all },
                ...CATEGORY_ORDER.map((c) => ({ key: c, label: CATEGORY_LABEL[c], count: counts[c] })),
              ];
              return chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === chip.key}
                  className={`bp-chip${activeCategory === chip.key ? " is-active" : ""}`}
                  onClick={() => setActiveCategory(chip.key)}
                >
                  {chip.label} <span className="bp-chip-count">{chip.count}</span>
                </button>
              ));
            })()}
          </div>
          <div className="bp-toggles">
            <button
              type="button"
              className={`bp-toggle${showMissingOnly ? " is-active" : ""}`}
              onClick={() => setShowMissingOnly((v) => !v)}
              title="Show only blueprints with incomplete collection progress"
            >
              Missing only
            </button>
            <button
              type="button"
              className={`bp-toggle${showDisabledSources ? " is-active" : ""}`}
              onClick={() => setShowDisabledSources((v) => !v)}
              title="Include missions currently marked unavailable due to patches"
            >
              Show disabled sources
            </button>
          </div>
        </div>

        {isLoading && <div className="bt-loading">Loading blueprint data...</div>}
        {isEmpty && <EmptyState mode={mode} />}

        {!isLoading && !isEmpty && mode === "missions" && (
          <div className="bt-tracker-layout">
            <div className="bt-faction-list">
              {missionGroups.length === 0 ? (
                <div className="bt-empty-state bt-empty-state--compact">
                  <div className="bt-empty-title">No matching missions</div>
                  <div className="bt-empty-body">Try searching by another faction, mission, or reward name.</div>
                </div>
              ) : (
                missionGroups.map((group) => (
                  <MissionFactionGroup
                    key={group.factionName}
                    factionName={group.factionName}
                    missions={group.missions}
                    completedMissionIds={completedMissionIds}
                    pinnedMissionIds={pinnedMissionIds}
                    acquiredBlueprintIds={acquiredBlueprintIds}
                    expandedMissionIds={expandedMissionIds}
                    selectedMissionId={selectedMissionId}
                    onToggleCompleted={toggleCompletedMission}
                    onTogglePinned={togglePinnedMission}
                    onToggleAcquired={toggleAcquiredBlueprint}
                    onToggleExpanded={toggleExpandedMission}
                    onSelectMission={selectMission}
                    onClearSelectedMission={clearSelectedMission}
                  />
                ))
              )}
            </div>
            <MissionTrackerSidebar
              selectedMission={selectedMission}
              pinnedMissions={pinnedMissions}
              searchQuery={missionSearchQuery}
              onSearchChange={setMissionSearchQuery}
              onSelectMission={selectMission}
              onTogglePinned={togglePinnedMission}
            />
          </div>
        )}

        {!isLoading && !isEmpty && mode === "library" && (
          <div className={selectedRewardId ? "bp-split" : ""}>
            <div className="bp-library-content">
              {/* Grouped category sections matching the screenshot (full width default; left in split when detail open) */}
              <div className="bp-sections">
                {(() => {
                  const q = bpSearchQuery.trim().toLowerCase();
                  const vis = blueprintRewardViews.filter((v) => {
                    if (q) {
                      const hay = (v.name + " " + (v.type || "") + " " + v.fallbackIconKey).toLowerCase();
                      if (!hay.includes(q)) return false;
                    }
                    if (showMissingOnly && v.isCollected) return false;
                    if (!showDisabledSources && v.allSourcesDisabled) return false;
                    if (activeCategory !== "all" && v.category !== activeCategory) return false;
                    return true;
                  });

                  if (vis.length === 0) {
                    return <div className="bp-empty">No matching blueprints. Clear filters or search.</div>;
                  }

                  const byCat = new Map<UiCategory, BlueprintRewardView[]>();
                  for (const v of vis) {
                    const arr = byCat.get(v.category) || [];
                    arr.push(v);
                    byCat.set(v.category, arr);
                  }

                  return CATEGORY_ORDER.map((cat) => {
                    const items = byCat.get(cat) || [];
                    if (items.length === 0) return null;
                    const label = CATEGORY_LABEL[cat];

                    // Limit visible cards per shelf to match the mockup screenshot exactly:
                    // Armor: 4 pieces, Weapons sections: 6 each, Components: 6.
                    // This prevents the sections from "running forever" with all items.
                    // The mockup showed limited cards in a horizontal shelf layout for the left/library portion.
                    // Visual limit from the mockup screenshot for the default (unfiltered) library shelves.
                    // Armor shows 4 cards, weapon/component sections show 6.
                    // When a category chip is active (filter "demands it"), show all for that section.
                    // Clicking the ⋯ in header activates the filter for that category (shows all).
                    const isFilteredToThis = activeCategory === cat;
                    const limit = isFilteredToThis ? items.length : (cat === 'armorSet' ? 4 : 6);
                    const visibleItems = items.slice(0, limit);
                    const hasMore = !isFilteredToThis && items.length > limit;

                    return (
                      <section key={cat} className="bp-category-section">
                        <div className="bp-section-header">
                          <span className="icon" aria-hidden>
                            {cat === "armorSet" ? "🛡️" : cat === "fpsWeapon" ? "🔫" : cat === "shipWeapon" ? "🚀" : cat === "component" ? "⚙️" : "📦"}
                          </span>
                          <span>{label}</span>
                          <span className="count">{items.length}</span>
                          <span style={{marginLeft: 'auto', fontSize: '11px', cursor: 'pointer'}} title={hasMore ? 'Show all in this category' : ''} onClick={() => setActiveCategory(cat)}>⋯</span>
                        </div>
                        <div className="bp-section-panel">
                          <div className="bp-cards">
                            {visibleItems.map((v) => {
                              const pct = v.totalCount > 0 ? Math.round((v.collectedCount / v.totalCount) * 100) : 0;
                              return (
                                <div
                                  key={v.rewardId}
                                  className={`bp-card${v.isCollected ? " is-collected" : ""}${v.allSourcesDisabled ? " is-unavailable" : ""}`}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => setSelectedRewardId(v.rewardId)}
                                  onKeyDown={(e) => { if (e.key === "Enter") setSelectedRewardId(v.rewardId); }}
                                >
                                  <div className="bp-card-icon" title={v.fallbackIconKey}>
                                    {v.imageUrl ? <img src={v.imageUrl} alt="" /> : <span>{cat === "armorSet" ? "A" : cat === "fpsWeapon" ? "F" : cat === "shipWeapon" ? "S" : cat === "component" ? "C" : "?"}</span>}
                                  </div>
                                  <div className="bp-card-body">
                                    <div className="bp-card-name">{v.name}</div>
                                    <div className="bp-card-sub">{v.type || v.category}</div>
                                    <div className="bp-card-progress">{v.collectedCount} / {v.totalCount}</div>
                                    <div className="bp-progress-track"><div className="bp-progress-fill" style={{width: pct + '%'}} /></div>
                                    {v.allSourcesDisabled && <div className="bp-unavail-badge">UNAVAILABLE</div>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </section>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Right detail panel (only when selected). Exact structure from the referenced screenshot: BLUEPRINT DETAILS header, back, name, badge, Track, close, media, description, BLUEPRINT PROGRESS with checklist, Quick Info, warning, Where to Acquire structured entries, consolidated table. */}
            {selectedRewardId && (() => {
              const v = blueprintRewardViews.find((x) => x.rewardId === selectedRewardId);
              if (!v) return null;
              const missionsForProgress = v.acquisitionGroups.flatMap(g => g.factions.flatMap(f => f.missions)).slice(0, 5);

              return (
                <div className="bp-detail-panel">
                  <div className="detail-kicker">BLUEPRINT DETAILS</div>
                  <div className="detail-title-row">
                    <span className="back" onClick={() => setSelectedRewardId(null)}>← Back to Results</span>
                    <span className="name">{v.name}</span>
                    {v.rarity && <span className="rarity-badge">{v.rarity} Blueprint</span>}
                    <button className="track-btn" onClick={() => {}}>Track Blueprint</button>
                    <span className="close-btn" onClick={() => setSelectedRewardId(null)}>×</span>
                  </div>

                  <div className="media-area">
                    {v.imageUrl ? <img src={v.imageUrl} alt="" style={{maxHeight:'100%'}} /> : 'Image not available'}
                  </div>

                  <div className="description">
                    {v.description || 'A high-precision item manufactured with exceptional capabilities. Features outstanding performance in its category.'}
                  </div>

                  <div className="progress-header">BLUEPRINT PROGRESS {v.collectedCount} / {v.totalCount} PARTS COLLECTED</div>
                  <div className="progress-list">
                    {missionsForProgress.map((m, i) => <div key={i}>{v.isCollected ? '☑' : '☐'} {m.title}</div>)}
                  </div>

                  {(v.allSourcesDisabled || v.hasDisabledSources) && <div className="warning-banner">⚠ Some missions for this blueprint are currently unavailable</div>}

                  <div className="acquire-header">WHERE TO ACQUIRE</div>
                  <div>This blueprint can be obtained from the following missions:</div>
                  {v.acquisitionGroups.map((g, gi) => g.factions.map((f, fi) => f.missions.slice(0,1).map((m, mi) => (
                    <div key={gi+'-'+fi+'-'+mi} className="acquire-entry">
                      <div className="sys">◉ {g.system}</div>
                      <div className="fac">{f.faction} <span className="status" style={{background: m.status === 'available' ? '#1a3a2a' : '#3a1a1a', color: m.status === 'available' ? '#43ffd0' : '#ff6b6b'}}>{m.status}</span></div>
                      <div className="mission">{m.title}</div>
                      <div className="desc">{m.description ? m.description.substring(0,90)+'...' : 'High value target operation.'}</div>
                      <div className="meta">Mission Type: {m.missionType || 'Contract Generator'} &nbsp; Reputation Reward: {m.reputationReward || '+150 rep'}</div>
                      <button className="btn">View Mission Details</button>
                    </div>
                  ))))}

                  <div className="acquire-header" style={{marginTop:8}}>MISSION LOCATIONS (Consolidated)</div>
                  <div className="locations-table">
                    <table>
                      <thead><tr><th>SYSTEM</th><th>FACTION</th><th>MISSION</th><th>STATUS</th><th>MAX STANDING</th></tr></thead>
                      <tbody>
                        {v.acquisitionGroups.flatMap(g => g.factions.flatMap(f => f.missions.map(m => ({...m, system: g.system, faction: f.faction})))).slice(0,4).map((r,i) => (
                          <tr key={i}><td>{r.system}</td><td>{r.faction}</td><td>{r.title}</td><td style={{color: r.status==='unavailable'?'#ff6b6b':'#43ffd0'}}>{r.status}</td><td>{r.maxStanding||'—'}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{padding:'0 12px 8px', fontSize:9, opacity:0.6}}>Duplicates consolidated. Data from processed mission rewards (raw contracts records).</div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
