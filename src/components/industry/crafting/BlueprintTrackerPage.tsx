import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import type { ComponentRecipe } from "./utils/craftingTypes";
import {
  RECIPE_BOOKMARK_STORAGE_KEY,
  MISSION_BOOKMARK_STORAGE_KEY,
  readStoredStringSet,
  writeStoredStringSet,
  buildTrackerEntries,
  loadMissionDetailMap,
  type BlueprintTrackerEntry,
  type MissionSourceDetail,
} from "./utils/blueprintTrackerStore";
import { apiUrl } from "@/lib/apiUrl";

const RECIPES_API_URL = "/api/crafting/component_recipes.json";

// ── Utility ───────────────────────────────────────────────────────────────────

function formatChance(value?: number): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${Math.round(value * 100)}%`;
}

// ── Mission popover ───────────────────────────────────────────────────────────

interface MissionPopoverProps {
  mission: MissionSourceDetail;
  anchorRect: DOMRect;
  onClose: () => void;
}

function MissionPopover({ mission, anchorRect, onClose }: MissionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const chance = formatChance(mission.chance);

  // Close on outside click and Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onPointerDown(e: PointerEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  // Position: prefer below anchor, flip if near bottom
  const [style, setStyle] = useState<React.CSSProperties>({
    position: "fixed",
    top: anchorRect.bottom + 6,
    left: anchorRect.left,
    zIndex: 9999,
    visibility: "hidden",
  });

  useEffect(() => {
    const el = popoverRef.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = el.getBoundingClientRect();
    const width = rect.width || 300;
    const height = rect.height || 200;

    let top = anchorRect.bottom + 6;
    let left = anchorRect.left;

    if (top + height > vh - 12) top = anchorRect.top - height - 6;
    if (left + width > vw - 12) left = vw - width - 12;
    if (left < 12) left = 12;
    if (top < 12) top = 12;

    setStyle({ position: "fixed", top, left, zIndex: 9999, visibility: "visible" });
  }, [anchorRect]);

  return createPortal(
    <div
      ref={popoverRef}
      className="bt-mission-popover"
      role="dialog"
      aria-modal="true"
      aria-label={`Mission details: ${mission.title}`}
      style={style}
      tabIndex={-1}
    >
      <div className="bt-mpop-header">
        <div className="bt-mpop-title">{mission.title}</div>
        <button
          type="button"
          className="bt-mpop-close"
          aria-label="Close mission details"
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="bt-mpop-body">
        {mission.factionName && (
          <div className="bt-mpop-row">
            <span className="bt-mpop-label">Faction</span>
            <span className="bt-mpop-value">{mission.factionName}</span>
          </div>
        )}
        <div className="bt-mpop-row">
          <span className="bt-mpop-label">Source Type</span>
          <span className="bt-mpop-value bt-mpop-badge">
            {mission.source === "mission" ? "Mission Contract" : "Reward Pool"}
          </span>
        </div>
        {mission.poolName && (
          <div className="bt-mpop-row">
            <span className="bt-mpop-label">Pool</span>
            <span className="bt-mpop-value">{mission.poolName}</span>
          </div>
        )}
        {mission.subtitle && mission.subtitle !== mission.poolName && (
          <div className="bt-mpop-row">
            <span className="bt-mpop-label">Generator</span>
            <span className="bt-mpop-value">{mission.subtitle}</span>
          </div>
        )}
        {chance && (
          <div className="bt-mpop-row">
            <span className="bt-mpop-label">Drop Chance</span>
            <span className="bt-mpop-value bt-mpop-chance">{chance}</span>
          </div>
        )}
        {mission.blueprintGuid && (
          <div className="bt-mpop-row bt-mpop-row--debug">
            <span className="bt-mpop-label">Blueprint ID</span>
            <span className="bt-mpop-value bt-mpop-mono">{mission.blueprintGuid}</span>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Mission row ───────────────────────────────────────────────────────────────

function MissionRow({
  mission,
  bookmarked,
  onToggle,
}: {
  mission: MissionSourceDetail;
  bookmarked: boolean;
  onToggle: (id: string) => void;
}) {
  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const chance = formatChance(mission.chance);

  function handleRowClick(e: React.MouseEvent) {
    // Don't open popover if clicking the bookmark button
    if ((e.target as HTMLElement).closest(".bt-mission-bm-btn")) return;
    const rect = rowRef.current?.getBoundingClientRect();
    if (rect) setPopoverAnchor(rect);
  }

  return (
    <>
      <div
        ref={rowRef}
        className={`bt-mission-row bt-mission-row--${mission.source}`}
        role="button"
        tabIndex={0}
        aria-label={`${mission.title} — click for details`}
        onClick={handleRowClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const rect = rowRef.current?.getBoundingClientRect();
            if (rect) setPopoverAnchor(rect);
          }
        }}
      >
        <button
          type="button"
          className={`bt-mission-bm-btn${bookmarked ? " is-active" : ""}`}
          aria-pressed={bookmarked}
          aria-label={bookmarked ? `Remove ${mission.title} bookmark` : `Bookmark ${mission.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(mission.id);
          }}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
          </svg>
        </button>
        <div className="bt-mission-row-copy">
          <div className="bt-mission-row-title">{mission.title}</div>
          <div className="bt-mission-row-meta">
            {[mission.factionName, mission.poolName ?? mission.subtitle, chance ? `${chance} chance` : null]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <span className="bt-mission-row-source-badge">
          {mission.source === "mission" ? "Mission" : "Pool"}
        </span>
        <svg className="bt-mission-row-chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>

      {popoverAnchor && (
        <MissionPopover
          mission={mission}
          anchorRect={popoverAnchor}
          onClose={() => setPopoverAnchor(null)}
        />
      )}
    </>
  );
}

// ── Item card ─────────────────────────────────────────────────────────────────

function ItemCard({
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

  const typeBadge = (() => {
    if (entry.itemKind === "fps") return entry.category ?? "FPS";
    return entry.componentType ?? entry.category ?? null;
  })();

  return (
    <div className={`bt-item-card${expanded ? " is-expanded" : ""}`}>
      <button
        type="button"
        className="bt-item-card-head"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="bt-item-card-name-row">
          <span className="bt-item-card-name">{entry.itemName}</span>
          <div className="bt-item-source-badges">
            {hasRecipe && <span className="bt-badge bt-badge--recipe">Recipe</span>}
            {hasMission && (
              <span className="bt-badge bt-badge--mission">
                Mission
                {entry.missions.length > 1 && (
                  <span className="bt-badge-count">{entry.missions.length}</span>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="bt-item-card-chips">
          {typeBadge && (
            <span className={`bt-chip${entry.itemKind === "fps" ? " bt-chip--fps" : ""}`}>
              {typeBadge.toUpperCase()}
            </span>
          )}
          {entry.size && <span className="bt-chip">S{entry.size}</span>}
          {entry.grade && <span className="bt-chip">{entry.grade}</span>}
          {entry.itemClass && <span className="bt-chip bt-chip--neutral">{entry.itemClass}</span>}
        </div>
        <svg
          className="bt-item-card-chevron"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <path d={expanded ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
        </svg>
      </button>

      {expanded && (
        <div className="bt-item-card-body">
          {hasRecipe && (
            <div className="bt-item-section">
              <div className="bt-item-section-label">Saved Recipes</div>
              {entry.recipes.map((recipe) => (
                <div key={recipe.blueprint_id} className="bt-recipe-row">
                  <button
                    type="button"
                    className="bt-recipe-bm-btn is-active"
                    aria-pressed={true}
                    aria-label={`Remove ${recipe.component_name} recipe bookmark`}
                    onClick={() => onToggleRecipe(recipe.blueprint_id)}
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
                    </svg>
                  </button>
                  <div className="bt-recipe-row-copy">
                    <span className="bt-recipe-row-name">{recipe.component_name}</span>
                    {recipe.craft_time_seconds > 0 && (
                      <span className="bt-recipe-row-meta">
                        {Math.round(recipe.craft_time_seconds / 60)}m craft time
                      </span>
                    )}
                  </div>
                  <span className="bt-badge bt-badge--recipe-sm">Blueprint</span>
                </div>
              ))}
            </div>
          )}

          {hasMission && entry.missions.length > 0 && (
            <div className="bt-item-section">
              <div className="bt-item-section-label">Mission Sources</div>
              {entry.missions.map((mission) => (
                <MissionRow
                  key={mission.id}
                  mission={mission}
                  bookmarked={bookmarkedMissionIds.has(mission.id)}
                  onToggle={onToggleMission}
                />
              ))}
            </div>
          )}

          {hasMission && entry.missions.length === 0 && (
            <div className="bt-item-section">
              <div className="bt-item-section-label">Mission Sources</div>
              <div className="bt-item-empty">Mission data loading or unavailable</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Faction group ─────────────────────────────────────────────────────────────

function FactionGroup({
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
    <div className="bt-faction-group">
      <div className="bt-faction-header">
        <span className="bt-faction-name">{factionName}</span>
        <span className="bt-faction-count">{entries.length}</span>
      </div>
      <div className="bt-faction-items">
        {entries.map((entry) => (
          <ItemCard
            key={`${entry.factionKey}::${entry.itemKey}`}
            entry={entry}
            bookmarkedMissionIds={bookmarkedMissionIds}
            onToggleRecipe={onToggleRecipe}
            onToggleMission={onToggleMission}
          />
        ))}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="bt-empty-state">
      <div className="bt-empty-icon" aria-hidden>
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 5h4m-4 4h8" />
        </svg>
      </div>
      <div className="bt-empty-title">No saved blueprints yet</div>
      <div className="bt-empty-body">
        Bookmark recipes and missions in the{" "}
        <a className="bt-empty-link" href="/industry/crafting">Crafting</a>{" "}
        page to track them here.
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BlueprintTrackerPage() {
  const [recipes, setRecipes] = useState<ComponentRecipe[]>([]);
  const [missionMap, setMissionMap] = useState<Map<string, MissionSourceDetail[]>>(new Map());
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [missionsLoading, setMissionsLoading] = useState(true);

  const [bookmarkedRecipeIds, setBookmarkedRecipeIds] = useState<Set<string>>(
    () => readStoredStringSet(RECIPE_BOOKMARK_STORAGE_KEY),
  );
  const [bookmarkedMissionIds, setBookmarkedMissionIds] = useState<Set<string>>(
    () => readStoredStringSet(MISSION_BOOKMARK_STORAGE_KEY),
  );

  // Listen for storage events from other tabs
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === RECIPE_BOOKMARK_STORAGE_KEY) {
        setBookmarkedRecipeIds(readStoredStringSet(RECIPE_BOOKMARK_STORAGE_KEY));
      }
      if (e.key === MISSION_BOOKMARK_STORAGE_KEY) {
        setBookmarkedMissionIds(readStoredStringSet(MISSION_BOOKMARK_STORAGE_KEY));
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl(RECIPES_API_URL))
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: unknown) => {
        if (!cancelled && Array.isArray(data)) {
          setRecipes(data as ComponentRecipe[]);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRecipesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadMissionDetailMap()
      .then((map) => {
        if (!cancelled) setMissionMap(map);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setMissionsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const toggleRecipe = useCallback((recipeId: string) => {
    setBookmarkedRecipeIds((prev) => {
      const next = new Set(prev);
      next.has(recipeId) ? next.delete(recipeId) : next.add(recipeId);
      writeStoredStringSet(RECIPE_BOOKMARK_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const toggleMission = useCallback((missionId: string) => {
    setBookmarkedMissionIds((prev) => {
      const next = new Set(prev);
      next.has(missionId) ? next.delete(missionId) : next.add(missionId);
      writeStoredStringSet(MISSION_BOOKMARK_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const trackerEntries = useMemo(
    () => buildTrackerEntries(recipes, bookmarkedRecipeIds, bookmarkedMissionIds, missionMap),
    [recipes, bookmarkedRecipeIds, bookmarkedMissionIds, missionMap],
  );

  const factionGroups = useMemo(() => {
    const map = new Map<string, { factionName: string; entries: BlueprintTrackerEntry[] }>();
    for (const entry of trackerEntries) {
      const group = map.get(entry.factionKey);
      if (group) {
        group.entries.push(entry);
      } else {
        map.set(entry.factionKey, { factionName: entry.factionName, entries: [entry] });
      }
    }
    return Array.from(map.values());
  }, [trackerEntries]);

  const isLoading = recipesLoading || missionsLoading;
  const isEmpty = !isLoading && trackerEntries.length === 0;

  return (
    <div className="bt-page">
      <div className="bt-shell">
        <div className="bt-page-header">
          <div className="bt-page-title-row">
            <h1 className="bt-page-title">Blueprint Tracker</h1>
            {trackerEntries.length > 0 && (
              <span className="bt-page-count">{trackerEntries.length} saved</span>
            )}
          </div>
          <p className="bt-page-subtitle">
            Saved craft recipes, blueprints, and mission sources — grouped by faction.
          </p>
        </div>

        {isLoading && (
          <div className="bt-loading">
            <span className="base-card-kicker">Loading blueprint data…</span>
          </div>
        )}

        {isEmpty && <EmptyState />}

        {!isLoading && factionGroups.length > 0 && (
          <div className="bt-faction-list">
            {factionGroups.map((group) => (
              <FactionGroup
                key={group.factionName}
                factionName={group.factionName}
                entries={group.entries}
                bookmarkedMissionIds={bookmarkedMissionIds}
                onToggleRecipe={toggleRecipe}
                onToggleMission={toggleMission}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
