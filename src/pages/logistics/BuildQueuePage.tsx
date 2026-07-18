import { useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router-dom";
import BuildQueueGroup from "../../components/logistics/BuildQueueGroup";
import BuildQueueCraftCard from "../../components/logistics/BuildQueueCraftCard";
import BuildQueueSelector from "../../components/logistics/BuildQueueSelector";
import {
  readFittingIconMode,
  type FittingIconMode,
} from "../../lib/fitting/fittingIconMode";
import { getInventoryFreshnessBlockReason } from "../../lib/logistics/inventoryFreshness";
import { getActiveInventoryEntries, type SourceStrategy } from "../../lib/logistics/inventory";
import { getQueueLedgerModel } from "../../lib/logistics/queueLedger";
import { useAuthSession } from "../../lib/auth/useAuthSession";
import { useLogisticsStore } from "../../stores/logisticsStore";
import QueueLedger from "../../components/logistics/QueueLedger";
import type { BuildQueue, BuildQueueItem, RecipeTemplate } from "../../types/logistics";
import { createLocalBuildQueueId, normalizeBuildQueueState } from "../../lib/logistics/buildQueues";
import {
  createBuildQueueCompletionSnapshot,
  moveActiveQueueEntry,
  reorderActiveQueueEntries,
} from "../../lib/logistics/buildQueueEntries";
import { getCraftingItems } from "../../lib/craftingData";
import { formatBuildQueueItemTypeLabel } from "../../lib/logistics/buildQueueItemLabel";
import type { RecipeInputTemplate } from "../../data/logistics/seed";
import type { BuildQueuePageFixture } from "./buildQueueStatsFixture";
import "../../components/logistics/logistics.css";
import "../../components/logistics/build-queue.css";

const MAX_QUEUE_SLOTS = 12;
const FIXTURE_READ_ONLY_MESSAGE = "Build Queue fixture is read-only.";

function formatSummaryNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

type QueueTab = "active" | "completed";

function sortQueueItems(items: BuildQueueItem[]) {
  return items.slice().sort(
    (a, b) => Number(b.priorityActive ?? false) - Number(a.priorityActive ?? false) || (a.priority ?? 0) - (b.priority ?? 0),
  );
}

function getQueueItemLabel(item: BuildQueueItem, recipes: RecipeTemplate[]) {
  const recipe = recipes.find((entry) => entry.id === item.recipeId);
  return item.itemName ?? recipe?.name ?? item.recipeId;
}

function useIsMobileQueueLayout() {
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 768px)").matches
      : false
  ));

  useEffect(() => {
    const query = window.matchMedia("(max-width: 768px)");
    const handleChange = () => setIsMobile(query.matches);
    handleChange();
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return isMobile;
}

export default function BuildQueuePage({ fixture }: { fixture?: BuildQueuePageFixture } = {}) {
  const isFixture = fixture !== undefined;
  const { user } = useAuthSession();
  const authenticatedUserId = isFixture ? null : (user?.id ?? null);
  const [sourceStrategy] = useState<SourceStrategy>("minimize-splits");
  const [iconMode] = useState<FittingIconMode>(() => readFittingIconMode());
  const [selectedItemId, setSelectedItemId] = useState<string | null>(fixture?.selectedItemId ?? null);
  const [allocationOwnerHighlightId, setAllocationOwnerHighlightId] = useState<string | null>(null);
  const [summaryCollapsed, setSummaryCollapsed] = useState(true);
  const [addCraftOpen, setAddCraftOpen] = useState(false);
  const [inventoryGuardMessage, setInventoryGuardMessage] = useState("");
  const [queueTab, setQueueTab] = useState<QueueTab>("active");
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
  const [queueDropIndex, setQueueDropIndex] = useState<number | null>(null);
  const [dragDestinationId, setDragDestinationId] = useState<string | "completed" | null>(null);
  const [typeLabelByBlueprintId, setTypeLabelByBlueprintId] = useState<Record<string, string>>({});
  const fixturePersistenceKey = useMemo(() => {
    if (!isFixture || typeof window === "undefined") return null;
    const key = new URLSearchParams(window.location.search).get("persist");
    return key ? `bq-fixture:${key}` : null;
  }, [isFixture]);
  const initialFixtureQueues = useMemo(() => normalizeBuildQueueState({
    queues: fixture?.buildQueues,
    items: fixture?.buildQueue,
    activeQueueId: fixture?.activeBuildQueueId,
  }), [fixture]);
  const initialFixtureState = useMemo(() => {
    if (!fixturePersistenceKey) return initialFixtureQueues;
    try {
      const saved = JSON.parse(window.localStorage.getItem(fixturePersistenceKey) ?? "null") as {
        queues?: BuildQueue[];
        items?: BuildQueueItem[];
        activeQueueId?: string;
      } | null;
      return saved ? normalizeBuildQueueState(saved) : initialFixtureQueues;
    } catch {
      return initialFixtureQueues;
    }
  }, [fixturePersistenceKey, initialFixtureQueues]);
  const [fixtureBuildQueue, setFixtureBuildQueue] = useState<BuildQueueItem[]>(() => initialFixtureState.items);
  const [fixtureQueues, setFixtureQueues] = useState<BuildQueue[]>(() => initialFixtureState.queues);
  const [fixtureActiveQueueId, setFixtureActiveQueueId] = useState(() => initialFixtureState.activeQueueId);
  const isMobileQueueLayout = useIsMobileQueueLayout();
  const mobileSelectorRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mobileSelectorPointerRef = useRef<{ id: number; startX: number; startY: number } | null>(null);
  const suppressMobileSelectorTapRef = useRef(false);

  const allInventoryEntries = useLogisticsStore((s) => s.inventoryEntries);
  const storeInventoryEntries = useMemo(() => getActiveInventoryEntries(allInventoryEntries), [allInventoryEntries]);
  const storeBuildQueue = useLogisticsStore((s) => s.buildQueue);
  const storeBuildQueues = useLogisticsStore((s) => s.buildQueues);
  const storeActiveBuildQueueId = useLogisticsStore((s) => s.activeBuildQueueId);
  const storeCreateBuildQueue = useLogisticsStore((s) => s.createBuildQueue);
  const storeSetActiveBuildQueue = useLogisticsStore((s) => s.setActiveBuildQueue);
  const storeRenameBuildQueue = useLogisticsStore((s) => s.renameBuildQueue);
  const storeDeleteBuildQueue = useLogisticsStore((s) => s.deleteBuildQueue);
  const storeLocations = useLogisticsStore((s) => s.locations);
  const storeMaterials = useLogisticsStore((s) => s.materialTemplates);
  const storeRecipes = useLogisticsStore((s) => s.recipeTemplates);
  const storeRecipeInputsByRecipeId = useLogisticsStore((s) => s.recipeInputTemplates);
  const inventorySync = useLogisticsStore((state) => state.inventorySync);
  const storeUpdateBuildQueueItemQuantity = useLogisticsStore((s) => s.updateBuildQueueItemQuantity);
  const storeUpdateBuildQueueItemAllowLowerQuality = useLogisticsStore((s) => s.updateBuildQueueItemAllowLowerQuality);
  const storeUpdateBuildQueueMaterialRequirement = useLogisticsStore((s) => s.updateBuildQueueMaterialRequirement);
  const storeUpdateBuildQueueItemStatus = useLogisticsStore((s) => s.updateBuildQueueItemStatus);
  const storeReorderBuildQueueItems = useLogisticsStore((s) => s.reorderBuildQueueItems);
  const storeMoveBuildQueueItem = useLogisticsStore((s) => s.moveBuildQueueItem);
  const storeRemoveBuildQueueItem = useLogisticsStore((s) => s.removeBuildQueueItem);
  const storeToggleBuildQueueAllocation = useLogisticsStore((s) => s.toggleBuildQueueAllocation);
  const storeUpdateBuildQueueAllocationQuantity = useLogisticsStore((s) => s.updateBuildQueueAllocationQuantity);
  const storeClearStaleBuildQueueItemAllocations = useLogisticsStore((s) => s.clearStaleBuildQueueItemAllocations);
  const storeAddInventoryEntries = useLogisticsStore((s) => s.addInventoryEntries);

  const inventoryEntries = fixture?.inventoryEntries ?? storeInventoryEntries;
  const buildQueue = fixture ? fixtureBuildQueue : storeBuildQueue;
  const buildQueues = fixture ? fixtureQueues : storeBuildQueues;
  const activeBuildQueueId = fixture ? fixtureActiveQueueId : storeActiveBuildQueueId;
  const activeBuildQueueItems = useMemo(
    () => buildQueue.filter((item) => item.queueId === activeBuildQueueId),
    [activeBuildQueueId, buildQueue],
  );
  const locations = fixture?.locations ?? storeLocations;
  const materials = fixture?.materials ?? storeMaterials;
  const recipes = fixture?.recipes ?? storeRecipes;
  const recipeInputsByRecipeId = fixture?.recipeInputsByRecipeId ?? storeRecipeInputsByRecipeId;

  useEffect(() => {
    if (!fixturePersistenceKey) return;
    window.localStorage.setItem(fixturePersistenceKey, JSON.stringify({
      queues: fixtureQueues,
      items: fixtureBuildQueue,
      activeQueueId: fixtureActiveQueueId,
    }));
  }, [fixtureActiveQueueId, fixtureBuildQueue, fixturePersistenceKey, fixtureQueues]);

  function flagFixtureReadOnly(...args: unknown[]) {
    void args;
    setInventoryGuardMessage(FIXTURE_READ_ONLY_MESSAGE);
  }

  const updateBuildQueueItemQuantity = isFixture
    ? flagFixtureReadOnly
    : storeUpdateBuildQueueItemQuantity;
  const updateBuildQueueItemAllowLowerQuality = isFixture
    ? flagFixtureReadOnly
    : storeUpdateBuildQueueItemAllowLowerQuality;
  const updateBuildQueueMaterialRequirement = isFixture
    ? ((id: string, requirementId: string, input: RecipeInputTemplate) => {
        setFixtureBuildQueue((current) => current.map((item) => {
          if (item.id !== id) return item;
          const materialRequirements = (item.materialRequirements ?? fixture?.recipeInputsByRecipeId[item.recipeId] ?? [])
            .map((requirement) => requirement.requirementId === requirementId
              ? { ...requirement, ...input, requirementId: requirement.requirementId, materialId: requirement.materialId, quantity: requirement.quantity }
              : requirement);
          return { ...item, materialRequirements };
        }));
      })
    : storeUpdateBuildQueueMaterialRequirement;
  const updateBuildQueueItemStatus = isFixture
    ? ((id: string, status: NonNullable<BuildQueueItem["status"]>) => {
        setFixtureBuildQueue((current) => current.map((item) => {
          if (item.id !== id) return item;
          return status === "complete"
            ? { ...item, status, completionSnapshot: item.completionSnapshot ?? createBuildQueueCompletionSnapshot(item, "2026-07-17T12:00:00.000Z") }
            : { ...item, status, completionSnapshot: undefined };
        }));
      })
    : storeUpdateBuildQueueItemStatus;
  const removeBuildQueueItem = isFixture
    ? flagFixtureReadOnly
    : storeRemoveBuildQueueItem;
  const toggleBuildQueueAllocation = isFixture
    ? flagFixtureReadOnly
    : storeToggleBuildQueueAllocation;
  const updateBuildQueueAllocationQuantity = isFixture
    ? flagFixtureReadOnly
    : storeUpdateBuildQueueAllocationQuantity;
  const clearStaleBuildQueueItemAllocations = isFixture
    ? flagFixtureReadOnly
    : storeClearStaleBuildQueueItemAllocations;
  const addInventoryEntries = isFixture
    ? ((entries: Parameters<typeof storeAddInventoryEntries>[0]) => {
        void entries;
        setInventoryGuardMessage(FIXTURE_READ_ONLY_MESSAGE);
      })
    : storeAddInventoryEntries;
  const reorderBuildQueueItems = isFixture
    ? ((queueId: string, orderedIds: string[]) => setFixtureBuildQueue((current) => reorderActiveQueueEntries(current, queueId, orderedIds)))
    : storeReorderBuildQueueItems;
  const moveBuildQueueItem = isFixture
    ? ((id: string, destinationQueueId: string, destinationIndex?: number) => (
        setFixtureBuildQueue((current) => moveActiveQueueEntry(current, id, destinationQueueId, destinationIndex))
      ))
    : storeMoveBuildQueueItem;

  const queueLedger = getQueueLedgerModel({ buildQueue: activeBuildQueueItems, inventoryEntries, materials, recipeInputsByRecipeId });
  const freshnessBlockReason = isFixture
    ? FIXTURE_READ_ONLY_MESSAGE
    : getInventoryFreshnessBlockReason(inventorySync, authenticatedUserId);

  useEffect(() => {
    const blueprintIds = [...new Set(
      activeBuildQueueItems.map((item) => item.blueprint_id).filter((id): id is string => Boolean(id?.trim())),
    )];

    let cancelled = false;

    if (blueprintIds.length === 0) {
      queueMicrotask(() => {
        if (!cancelled) setTypeLabelByBlueprintId({});
      });
      return () => { cancelled = true; };
    }

    getCraftingItems().then((items) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const blueprintId of blueprintIds) {
        const recipe = items.find((entry) => entry.blueprint_id === blueprintId);
        if (recipe) next[blueprintId] = formatBuildQueueItemTypeLabel(recipe);
      }
      setTypeLabelByBlueprintId(next);
    });

    return () => { cancelled = true; };
  }, [activeBuildQueueItems]);

  const activeRows = useMemo(
    () => sortQueueItems(activeBuildQueueItems.filter((item) => item.status !== "complete")).map((item) => ({ item })),
    [activeBuildQueueItems],
  );
  const completedRows = useMemo(
    () => sortQueueItems(activeBuildQueueItems.filter((item) => item.status === "complete")).map((item) => ({ item })),
    [activeBuildQueueItems],
  );
  const visibleRows = queueTab === "active" ? activeRows : completedRows;
  const resolvedSelectedItemId = useMemo(() => {
    if (visibleRows.length === 0) return null;
    if (selectedItemId && visibleRows.some((row) => row.item.id === selectedItemId)) {
      return selectedItemId;
    }
    return visibleRows[0]?.item.id ?? null;
  }, [visibleRows, selectedItemId]);

  const selectedRow = visibleRows.find((row) => row.item.id === resolvedSelectedItemId) ?? null;

  function getItemTypeLabel(item: BuildQueueItem): string | undefined {
    const blueprintId = item.blueprint_id?.trim();
    if (!blueprintId) return undefined;
    return typeLabelByBlueprintId[blueprintId];
  }
  function handleMobileSelectorPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse") return;
    mobileSelectorPointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    suppressMobileSelectorTapRef.current = false;
  }

  function handleMobileSelectorPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = mobileSelectorPointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;

    if (
      Math.abs(event.clientX - pointer.startX) > 6 ||
      Math.abs(event.clientY - pointer.startY) > 6
    ) {
      suppressMobileSelectorTapRef.current = true;
    }
  }

  function handleMobileSelectorPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = mobileSelectorPointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;

    mobileSelectorPointerRef.current = null;

    if (!suppressMobileSelectorTapRef.current) return;

    window.setTimeout(() => {
      suppressMobileSelectorTapRef.current = false;
    }, 0);
  }

  function handleMobileSelectorClick(itemId: string) {
    if (suppressMobileSelectorTapRef.current) return;
    setSelectedItemId(itemId);
  }

  function handleStatusChange(id: string, status: NonNullable<BuildQueueItem["status"]>) {
    if (!isFixture && status === "complete" && freshnessBlockReason) {
      setInventoryGuardMessage(freshnessBlockReason);
      return;
    }
    setInventoryGuardMessage("");
    updateBuildQueueItemStatus(id, status);
    if (status === "complete") {
      setQueueTab("completed");
      setSelectedItemId(id);
    }
  }

  function clearDragState() {
    setDraggingEntryId(null);
    setQueueDropIndex(null);
    setDragDestinationId(null);
  }

  function handleCraftDragStart(event: ReactDragEvent<HTMLButtonElement>, id: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/build-queue-entry", id);
    setDraggingEntryId(id);
    setQueueDropIndex(activeRows.findIndex((row) => row.item.id === id));
  }

  function handleQueueCardDragOver(event: ReactDragEvent<HTMLDivElement>, index: number) {
    if (!draggingEntryId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const bounds = event.currentTarget.getBoundingClientRect();
    setQueueDropIndex(index + (event.clientY >= bounds.top + bounds.height / 2 ? 1 : 0));
    setDragDestinationId(activeBuildQueueId);
  }

  function dropIntoQueue(destinationQueueId: string, destinationIndex?: number) {
    if (!draggingEntryId) return;
    const moving = buildQueue.find((item) => item.id === draggingEntryId);
    if (!moving) return clearDragState();
    if (moving.queueId === destinationQueueId) {
      const orderedIds = activeRows.map((row) => row.item.id).filter((id) => id !== draggingEntryId);
      orderedIds.splice(Math.max(0, Math.min(destinationIndex ?? orderedIds.length, orderedIds.length)), 0, draggingEntryId);
      reorderBuildQueueItems(destinationQueueId, orderedIds);
    } else {
      moveBuildQueueItem(draggingEntryId, destinationQueueId, destinationIndex);
    }
    setSelectedItemId(draggingEntryId);
    clearDragState();
  }

  function handleQueueListDrop(event: ReactDragEvent<HTMLDivElement>) {
    if (!draggingEntryId) return;
    event.preventDefault();
    event.stopPropagation();
    dropIntoQueue(activeBuildQueueId, queueDropIndex ?? activeRows.length);
  }

  function handleDestinationDrop(event: ReactDragEvent<HTMLButtonElement>, destinationId: string | "completed") {
    event.preventDefault();
    event.stopPropagation();
    if (!draggingEntryId) return;
    if (destinationId === "completed") {
      handleStatusChange(draggingEntryId, "complete");
      clearDragState();
      return;
    }
    dropIntoQueue(destinationId);
  }

  function handleKeyboardReorder(id: string, direction: -1 | 1) {
    const orderedIds = activeRows.map((row) => row.item.id);
    const currentIndex = orderedIds.indexOf(id);
    const destinationIndex = currentIndex + direction;
    if (currentIndex < 0 || destinationIndex < 0 || destinationIndex >= orderedIds.length) return;
    [orderedIds[currentIndex], orderedIds[destinationIndex]] = [orderedIds[destinationIndex], orderedIds[currentIndex]];
    reorderBuildQueueItems(activeBuildQueueId, orderedIds);
  }

  function handleQuickAddInventory(entries: Parameters<typeof addInventoryEntries>[0]) {
    if (isFixture) {
      setInventoryGuardMessage(FIXTURE_READ_ONLY_MESSAGE);
      return;
    }
    addInventoryEntries(entries);
    setInventoryGuardMessage("");
  }

  function handleQueueSelect(id: string) {
    if (isFixture) setFixtureActiveQueueId(id);
    else storeSetActiveBuildQueue(id);
    setSelectedItemId(null);
    setQueueTab("active");
  }

  function handleQueueCreate(name: string) {
    if (isFixture) {
      const id = createLocalBuildQueueId();
      setFixtureQueues((queues) => [...queues, { id, name, sourceType: "custom" }]);
      setFixtureActiveQueueId(id);
    } else {
      storeCreateBuildQueue(name);
    }
    setSelectedItemId(null);
    setQueueTab("active");
  }

  function handleQueueRename(id: string, name: string) {
    if (isFixture) {
      setFixtureQueues((queues) => queues.map((queue) => queue.id === id ? { ...queue, name } : queue));
    } else {
      storeRenameBuildQueue(id, name);
    }
  }

  function handleQueueDelete(id: string) {
    if (isFixture) {
      const queueIndex = fixtureQueues.findIndex((queue) => queue.id === id);
      if (queueIndex < 0 || fixtureQueues.length <= 1) return;
      const remainingQueues = fixtureQueues.filter((queue) => queue.id !== id);
      const fallback = remainingQueues[Math.max(0, queueIndex - 1)] ?? remainingQueues[0];
      setFixtureQueues(remainingQueues);
      setFixtureBuildQueue((items) => items.filter((item) => item.queueId !== id));
      if (fixtureActiveQueueId === id) setFixtureActiveQueueId(fallback.id);
    } else {
      storeDeleteBuildQueue(id);
    }
    setSelectedItemId(null);
    setQueueTab("active");
  }
  return (
    <div className="bq-page" data-bq-fixture={isFixture ? "stats" : undefined} data-bq-active-queue={activeBuildQueueId}>
      {inventoryGuardMessage ? (
        <div className="bq-inventory-sync-alert" role="alert">{inventoryGuardMessage}</div>
      ) : null}
      <div className={`bq-layout${summaryCollapsed ? " bq-layout--summary-collapsed" : ""}`}>
        <aside className="bq-queue-col ops-primary-card" aria-label="Build queue list">
          <header className="bq-queue-col-head">
            <span className="bq-queue-col-title">
              Build Queue <em>{activeRows.length}/{MAX_QUEUE_SLOTS}</em>
            </span>
            <div className="bq-add-craft-wrap">
              <button
                type="button"
                className="bq-add-craft-btn"
                aria-expanded={addCraftOpen}
                onClick={() => setAddCraftOpen((open) => !open)}
              >
                Add Craft
              </button>
              {addCraftOpen ? (
                <div className="bq-add-craft-menu" role="menu">
                  <Link className="bq-add-craft-option" to="/industry/crafting" role="menuitem" onClick={() => setAddCraftOpen(false)}>
                    Individual Items
                  </Link>
                  <Link className="bq-add-craft-option" to="/fitting" role="menuitem" onClick={() => setAddCraftOpen(false)}>
                    Ship Fits
                  </Link>
                </div>
              ) : null}
            </div>
          </header>

          <BuildQueueSelector
            queues={buildQueues}
            activeQueueId={activeBuildQueueId}
            onSelect={handleQueueSelect}
            onCreate={handleQueueCreate}
            onRename={handleQueueRename}
            onDelete={handleQueueDelete}
          />

          <div className="bq-queue-col-body">
            <div className="bq-queue-tabs" role="tablist" aria-label="Queue sections">
              <button
                type="button"
                role="tab"
                className={`bq-queue-tab${queueTab === "active" ? " is-active" : ""}`}
                aria-selected={queueTab === "active"}
                onClick={() => setQueueTab("active")}
              >
                <span className="bq-queue-tab-label">Active</span>
                <span className="bq-queue-tab-count">{activeRows.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                className={`bq-queue-tab${queueTab === "completed" ? " is-active" : ""}`}
                aria-selected={queueTab === "completed"}
                onClick={() => setQueueTab("completed")}
              >
                <span className="bq-queue-tab-label">Completed</span>
                <span className="bq-queue-tab-count">{completedRows.length}</span>
              </button>
            </div>

            <div
              className="bq-queue-list"
              onPointerDown={handleMobileSelectorPointerDown}
              onPointerMove={handleMobileSelectorPointerMove}
              onPointerUp={handleMobileSelectorPointerEnd}
              onPointerCancel={handleMobileSelectorPointerEnd}
              onDragOver={(event) => {
                if (!draggingEntryId) return;
                event.preventDefault();
                if (event.target === event.currentTarget) setQueueDropIndex(activeRows.length);
              }}
              onDrop={handleQueueListDrop}
            >
            {visibleRows.length === 0 ? (
              <div className="bq-empty-state">
                {queueTab === "active" ? "No builds queued yet." : "No completed crafts yet."}
              </div>
            ) : isMobileQueueLayout ? (
              visibleRows.map((row, index) => {                const selected = row.item.id === resolvedSelectedItemId;
                const itemLabel = getQueueItemLabel(row.item, recipes);
                return (
                  <button
                    key={row.item.id}
                    ref={(node) => {
                      mobileSelectorRefs.current[row.item.id] = node;
                    }}
                    type="button"
                    className={[
                      "bq-queue-pill",
                      selected ? "is-selected" : "",
                      row.item.id === allocationOwnerHighlightId ? "allocation-owner-highlight" : "",
                      row.item.status === "complete" ? "is-complete" : "",                    ].filter(Boolean).join(" ")}
                    aria-current={selected ? "true" : undefined}
                    aria-label={`Select queue item ${index + 1}: ${itemLabel}`}
                    onClick={() => handleMobileSelectorClick(row.item.id)}
                  >
                    <span className="bq-queue-pill-index">{index + 1}</span>
                    <span className="bq-queue-pill-dot" aria-hidden="true" />
                  </button>
                );
              })
            ) : visibleRows.map((row, index) => (
              <div
                key={row.item.id}
                className={`bq-craft-card-drop-slot${queueDropIndex === index && draggingEntryId !== row.item.id ? " is-drop-before" : ""}${queueDropIndex === index + 1 && draggingEntryId !== row.item.id ? " is-drop-after" : ""}`}
                onDragOver={(event) => handleQueueCardDragOver(event, index)}
                onDrop={handleQueueListDrop}
              >
                <BuildQueueCraftCard
                  index={index + 1}
                  item={row.item}
                  itemTypeLabel={getItemTypeLabel(row.item)}
                  recipes={recipes}
                  recipeInputsByRecipeId={recipeInputsByRecipeId}
                  inventory={inventoryEntries}
                  selected={row.item.id === resolvedSelectedItemId}
                  highlighted={row.item.id === allocationOwnerHighlightId}
                  onSelect={setSelectedItemId}
                  dragging={draggingEntryId === row.item.id}
                  onDragStart={handleCraftDragStart}
                  onDragEnd={clearDragState}
                  onKeyboardReorder={handleKeyboardReorder}
                />
              </div>
              ))}
            </div>
          </div>

          <footer className="bq-queue-col-foot">
            <Link className="bq-add-another-btn" to="/industry/crafting">
              + Add Another Craft
            </Link>
          </footer>
          {draggingEntryId ? (
            <div className="bq-drag-destinations" aria-label="Move craft destinations">
              <span className="bq-drag-destinations-title">Move craft to</span>
              {buildQueues.filter((queue) => queue.sourceType === "custom").map((queue) => (
                <button
                  key={queue.id}
                  type="button"
                  className={`bq-drag-destination${dragDestinationId === queue.id ? " is-over" : ""}`}
                  onDragEnter={() => setDragDestinationId(queue.id)}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                  onDragLeave={() => setDragDestinationId((current) => current === queue.id ? null : current)}
                  onDrop={(event) => handleDestinationDrop(event, queue.id)}
                >
                  <span>{queue.name}</span>
                  {queue.id === activeBuildQueueId ? <small>Current queue</small> : <small>Move here</small>}
                </button>
              ))}
              <button
                type="button"
                className={`bq-drag-destination bq-drag-destination--completed${dragDestinationId === "completed" ? " is-over" : ""}`}
                onDragEnter={() => setDragDestinationId("completed")}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                onDragLeave={() => setDragDestinationId((current) => current === "completed" ? null : current)}
                onDrop={(event) => handleDestinationDrop(event, "completed")}
              >
                <span>Completed</span>
                <small>Archive craft</small>
              </button>
            </div>
          ) : null}
        </aside>

        <section className="bq-center-col" aria-label="Selected craft workspace">
          {selectedRow ? (
            <div className="bq-center-shell ops-primary-card">
            <BuildQueueGroup
              category={recipes.find((entry) => entry.id === selectedRow.item.recipeId)?.category ?? "other"}
              itemTypeLabel={getItemTypeLabel(selectedRow.item)}
              items={[selectedRow.item]}              recipes={recipes}
              recipeInputsByRecipeId={recipeInputsByRecipeId}
              buildQueue={buildQueue}
              inventory={inventoryEntries}
              materials={materials}
              locations={locations}
              strategy={sourceStrategy}
              onQuantityChange={updateBuildQueueItemQuantity}
              onAllowLowerQualityChange={updateBuildQueueItemAllowLowerQuality}
              onMaterialRequirementChange={updateBuildQueueMaterialRequirement}
              onStatusChange={handleStatusChange}
              onRemove={removeBuildQueueItem}
              onToggleAllocation={toggleBuildQueueAllocation}
              onUpdateAllocationQuantity={updateBuildQueueAllocationQuantity}
              onClearStaleAllocations={clearStaleBuildQueueItemAllocations}
              onAllocationOwnerHighlightChange={setAllocationOwnerHighlightId}
              onQuickAddInventory={handleQuickAddInventory}
              iconMode={iconMode}
            />
            </div>
          ) : (
            <div className="bq-empty-state bq-empty-state--center">Select a craft from the queue to begin allocation.</div>
          )}
        </section>

        <QueueLedger
          ledger={queueLedger}
          formatValue={formatSummaryNumber}
          collapsed={summaryCollapsed}
          onToggleCollapse={() => setSummaryCollapsed((value) => !value)}
        />
      </div>
    </div>
  );
}


