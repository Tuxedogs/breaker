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
import { getCraftingItemsByBlueprintGuids } from "../../lib/craftingData";
import { formatBuildQueueItemTypeLabel } from "../../lib/logistics/buildQueueItemLabel";
import type { RecipeInputTemplate } from "../../data/logistics/seed";
import type { BuildQueuePageFixture } from "./buildQueueStatsFixture";
import "../../components/logistics/logistics.css";
import "../../components/logistics/build-queue.css";
import "../../components/logistics/build-queue-redesign.css";

const MAX_QUEUE_SLOTS = 12;
const FIXTURE_READ_ONLY_MESSAGE = "Build Queue fixture is read-only.";

function formatSummaryNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

type QueueTab = "active" | "completed";
type DragDestinationId = string | "completed" | "new-queue";

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
  const [inventoryGuardMessage, setInventoryGuardMessage] = useState("");
  const [inventoryEnabled, setInventoryEnabled] = useState(true);
  const [queueTab, setQueueTab] = useState<QueueTab>("active");
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
  const [queueDropIndex, setQueueDropIndex] = useState<number | null>(null);
  const [dragDestinationId, setDragDestinationId] = useState<DragDestinationId | null>(null);
  const [queueRenameRequestToken, setQueueRenameRequestToken] = useState(0);
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
  const queueListRef = useRef<HTMLDivElement>(null);
  const dragDestinationRef = useRef<DragDestinationId | null>(null);
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
  const storeAddInventoryEntriesAsync = useLogisticsStore((s) => s.addInventoryEntriesAsync);

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
  const addInventoryEntriesAsync = isFixture
    ? (async (entries: Parameters<typeof storeAddInventoryEntriesAsync>[0]) => {
        void entries;
        setInventoryGuardMessage(FIXTURE_READ_ONLY_MESSAGE);
        throw new Error(FIXTURE_READ_ONLY_MESSAGE);
      })
    : storeAddInventoryEntriesAsync;
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

    getCraftingItemsByBlueprintGuids(blueprintIds).then((items) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const blueprintId of blueprintIds) {
        const recipe = items.find((entry) => entry.blueprint_id === blueprintId);
        if (recipe) next[blueprintId] = formatBuildQueueItemTypeLabel(recipe);
      }
      setTypeLabelByBlueprintId(next);
    }).catch(() => {
      if (!cancelled) setTypeLabelByBlueprintId({});
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
    dragDestinationRef.current = null;
    setDraggingEntryId(null);
    setQueueDropIndex(null);
    setDragDestinationId(null);
  }

  function setDragDestination(destination: DragDestinationId | null) {
    dragDestinationRef.current = destination;
    setDragDestinationId(destination);
  }

  function handleCraftDragStart(event: ReactDragEvent<HTMLButtonElement>, id: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/build-queue-entry", id);
    setDraggingEntryId(id);
    setQueueDropIndex(activeRows.findIndex((row) => row.item.id === id));
  }

  function getProjectedQueueIndex(cursorY: number): number {
    if (!draggingEntryId || !queueListRef.current) return activeRows.length;
    const remainingIds = activeRows
      .map((row) => row.item.id)
      .filter((id) => id !== draggingEntryId);
    const cardsById = new Map(
      Array.from(queueListRef.current.querySelectorAll<HTMLElement>(".bq-craft-card-shell[data-bq-entry-id]"))
        .map((element) => [element.dataset.bqEntryId, element] as const),
    );

    for (const [index, id] of remainingIds.entries()) {
      const card = cardsById.get(id);
      if (!card) continue;
      const bounds = card.getBoundingClientRect();
      if (cursorY < bounds.top + bounds.height / 2) return index;
    }
    return remainingIds.length;
  }

  function handleQueueCardDragOver(event: ReactDragEvent<HTMLDivElement>) {
    if (!draggingEntryId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
                  setDragDestination(null);
    const nextIndex = getProjectedQueueIndex(event.clientY);
    setQueueDropIndex((current) => current === nextIndex ? current : nextIndex);
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

  function handleDestinationDrop(event: ReactDragEvent<HTMLButtonElement>, destinationId: Exclude<DragDestinationId, "new-queue">) {
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

  function getNextTemporaryQueueName() {
    const names = new Set(buildQueues.map((queue) => queue.name.trim().toLowerCase()));
    if (!names.has("new queue")) return "New Queue";
    let suffix = 2;
    while (names.has(`new queue ${suffix}`)) suffix += 1;
    return `New Queue ${suffix}`;
  }

  function moveDraggedCraftToNewQueue() {
    if (!draggingEntryId) return;
    const queueId = handleQueueCreate(getNextTemporaryQueueName());
    if (!queueId) return clearDragState();
    moveBuildQueueItem(draggingEntryId, queueId, 0);
    setSelectedItemId(draggingEntryId);
    setQueueTab("active");
    setQueueRenameRequestToken((token) => token + 1);
    clearDragState();
  }

  function handleNewQueueDrop(event: ReactDragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    moveDraggedCraftToNewQueue();
  }

  function handleCraftDragEnd() {
    const destination = dragDestinationRef.current;
    if (!draggingEntryId || !destination) return clearDragState();
    if (destination === "completed") {
      handleStatusChange(draggingEntryId, "complete");
      return clearDragState();
    }
    if (destination === "new-queue") return moveDraggedCraftToNewQueue();
    dropIntoQueue(destination);
  }

  function handleKeyboardReorder(id: string, direction: -1 | 1) {
    const orderedIds = activeRows.map((row) => row.item.id);
    const currentIndex = orderedIds.indexOf(id);
    const destinationIndex = currentIndex + direction;
    if (currentIndex < 0 || destinationIndex < 0 || destinationIndex >= orderedIds.length) return;
    [orderedIds[currentIndex], orderedIds[destinationIndex]] = [orderedIds[destinationIndex], orderedIds[currentIndex]];
    reorderBuildQueueItems(activeBuildQueueId, orderedIds);
  }

  async function handleQuickAddInventory(entries: Parameters<typeof addInventoryEntriesAsync>[0]) {
    if (isFixture) {
      setInventoryGuardMessage(FIXTURE_READ_ONLY_MESSAGE);
      throw new Error(FIXTURE_READ_ONLY_MESSAGE);
    }
    try {
      await addInventoryEntriesAsync(entries);
      setInventoryGuardMessage("");
    } catch (error) {
      setInventoryGuardMessage(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  function handleQueueSelect(id: string) {
    if (isFixture) setFixtureActiveQueueId(id);
    else storeSetActiveBuildQueue(id);
    setSelectedItemId(null);
    setQueueTab("active");
  }

  function handleQueueCreate(name: string): string {
    if (isFixture) {
      const id = createLocalBuildQueueId();
      setFixtureQueues((queues) => [...queues, { id, name, sourceType: "custom" }]);
      setFixtureActiveQueueId(id);
      setSelectedItemId(null);
      setQueueTab("active");
      return id;
    } else {
      const id = storeCreateBuildQueue(name);
      setSelectedItemId(null);
      setQueueTab("active");
      return id;
    }
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
        <aside className="bq-queue-col" aria-label="Build queue list">
          <header className="bq-queue-col-head">
            <span className="bq-queue-col-title">
              Build Queue <em>{activeRows.length}/{MAX_QUEUE_SLOTS}</em>
            </span>
          </header>

          <BuildQueueSelector
            key={queueRenameRequestToken}
            queues={buildQueues}
            activeQueueId={activeBuildQueueId}
            onSelect={handleQueueSelect}
            onCreate={handleQueueCreate}
            onRename={handleQueueRename}
            onDelete={handleQueueDelete}
            autoOpenRename={queueRenameRequestToken > 0}
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
              ref={queueListRef}
              className="bq-queue-list"
              onPointerDown={handleMobileSelectorPointerDown}
              onPointerMove={handleMobileSelectorPointerMove}
              onPointerUp={handleMobileSelectorPointerEnd}
              onPointerCancel={handleMobileSelectorPointerEnd}
              onDragOver={(event) => {
                if (!draggingEntryId) return;
                event.preventDefault();
                if (event.target === event.currentTarget) {
                  setDragDestination(null);
                  setQueueDropIndex(getProjectedQueueIndex(event.clientY));
                }
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
            ) : visibleRows.map((row, index) => {
              const activeDrag = queueTab === "active" && Boolean(draggingEntryId);
              const remainingIndex = activeRows
                .filter((entry) => entry.item.id !== draggingEntryId)
                .findIndex((entry) => entry.item.id === row.item.id);
              const showPlaceholderBefore = activeDrag && remainingIndex >= 0 && queueDropIndex === remainingIndex;
              const isLastRemaining = remainingIndex === activeRows.filter((entry) => entry.item.id !== draggingEntryId).length - 1;
              const showPlaceholderAfter = activeDrag && isLastRemaining && queueDropIndex === remainingIndex + 1;

              return (
                <div
                  key={row.item.id}
                  className="bq-craft-card-drop-slot"
                  onDragOver={handleQueueCardDragOver}
                  onDrop={handleQueueListDrop}
                >
                  {showPlaceholderBefore ? <div className="bq-craft-card-drop-placeholder" aria-label="Projected reorder destination">Drop to reorder here</div> : null}
                  <BuildQueueCraftCard
                    index={index + 1}
                    item={row.item}
                    itemTypeLabel={getItemTypeLabel(row.item)}
                    recipes={recipes}
                    recipeInputsByRecipeId={recipeInputsByRecipeId}
                    inventory={inventoryEntries}
                    inventoryEnabled={inventoryEnabled}
                    selected={row.item.id === resolvedSelectedItemId}
                    highlighted={row.item.id === allocationOwnerHighlightId}
                    onSelect={setSelectedItemId}
                    dragging={draggingEntryId === row.item.id}
                    dragActive={activeDrag}
                    onDragStart={handleCraftDragStart}
                    onDragEnd={handleCraftDragEnd}
                    onKeyboardReorder={handleKeyboardReorder}
                  />
                  {showPlaceholderAfter ? <div className="bq-craft-card-drop-placeholder" aria-label="Projected reorder destination">Drop to reorder here</div> : null}
                </div>
              );
            })}
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
              {buildQueues.filter((queue) => queue.sourceType === "custom" && queue.id !== activeBuildQueueId).map((queue) => (
                <button
                  key={queue.id}
                  type="button"
                  className={`bq-drag-destination${dragDestinationId === queue.id ? " is-over" : ""}`}
                  onDragEnter={() => { setDragDestination(queue.id); setQueueDropIndex(null); }}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                  onDrop={(event) => handleDestinationDrop(event, queue.id)}
                >
                <span>{queue.name}</span>
                <small>Move to this queue</small>
                </button>
              ))}
              <button
                type="button"
                className={`bq-drag-destination bq-drag-destination--completed${dragDestinationId === "completed" ? " is-over" : ""}`}
                onDragEnter={() => { setDragDestination("completed"); setQueueDropIndex(null); }}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                onDrop={(event) => handleDestinationDrop(event, "completed")}
              >
                <span>Move to Completed</span>
                <small>Archive this craft as complete</small>
              </button>
              <button
                type="button"
                className={`bq-drag-destination bq-drag-destination--new-queue${dragDestinationId === "new-queue" ? " is-over" : ""}`}
                onDragEnter={() => { setDragDestination("new-queue"); setQueueDropIndex(null); }}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                onDrop={handleNewQueueDrop}
              >
                <span>New Queue</span>
                <small>Create a queue and move this craft first</small>
              </button>
            </div>
          ) : null}
        </aside>

        <section className="bq-center-col" aria-label="Selected craft workspace">
          {selectedRow ? (
            <div className="bq-center-shell">
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
              inventoryEnabled={inventoryEnabled}
              onInventoryEnabledChange={setInventoryEnabled}
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


