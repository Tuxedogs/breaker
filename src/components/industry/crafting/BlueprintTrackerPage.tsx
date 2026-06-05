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

function LibraryFactionGroup({
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
  const [mode, setMode] = useState<TrackerMode>("missions");
  const [recipes, setRecipes] = useState<ComponentRecipe[]>([]);
  const [missions, setMissions] = useState<MissionBlueprintReward[]>([]);
  const [missionMap, setMissionMap] = useState<Map<string, MissionSourceDetail[]>>(new Map());
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [missionsLoading, setMissionsLoading] = useState(true);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [missionSearchQuery, setMissionSearchQuery] = useState("");
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
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

  const toggleRecipe = useCallback(async (recipeId: string) => {
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

  const toggleMissionBookmark = useCallback((missionId: string) => {
    setBookmarkedMissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(missionId)) next.delete(missionId);
      else next.add(missionId);
      writeStoredStringSet(MISSION_BOOKMARK_STORAGE_KEY, next);
      return next;
    });
  }, []);

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

  const libraryGroups = useMemo(() => {
    const map = new Map<string, { factionName: string; entries: BlueprintTrackerEntry[] }>();
    for (const entry of trackerEntries) {
      const group = map.get(entry.factionKey);
      if (group) group.entries.push(entry);
      else map.set(entry.factionKey, { factionName: entry.factionName, entries: [entry] });
    }
    return Array.from(map.values());
  }, [trackerEntries]);

  const missionRewardCount = missions.reduce((sum, mission) => sum + mission.rewards.length, 0);
  const isLoading = mode === "missions" ? missionsLoading : recipesLoading || sourcesLoading;
  const isEmpty = !isLoading && (mode === "missions" ? missions.length === 0 : libraryGroups.length === 0);

  return (
    <div className="bt-page">
      <div className="bt-shell">
        <header className="bt-page-header">
          <div className="bt-page-title-row">
            <h1 className="bt-page-title">Blueprint Tracker</h1>
            <span className="bt-page-count">
              {mode === "missions" ? `${missions.length} missions / ${missionRewardCount} rewards` : `${trackerEntries.length} saved`}
            </span>
          </div>
          <p className="bt-page-subtitle">
            Mission-first blueprint tracking with independent mission completion and reward acquisition state.
          </p>
          <div className="bt-tabs" role="tablist" aria-label="Blueprint tracker mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "missions"}
              className={`bt-tab${mode === "missions" ? " is-active" : ""}`}
              onClick={() => setMode("missions")}
            >
              Mission Tracker
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "library"}
              className={`bt-tab${mode === "library" ? " is-active" : ""}`}
              onClick={() => setMode("library")}
            >
              Blueprint Library
            </button>
          </div>
        </header>

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
          <div className="bt-faction-list">
            {libraryGroups.map((group) => (
              <LibraryFactionGroup
                key={group.factionName}
                factionName={group.factionName}
                entries={group.entries}
                bookmarkedMissionIds={bookmarkedMissionIds}
                onToggleRecipe={toggleRecipe}
                onToggleMission={toggleMissionBookmark}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
