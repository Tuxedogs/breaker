import WorkspaceTabs from "../../components/shared/WorkspaceTabs";
import WorkspacePanel from "../../components/shared/WorkspacePanel";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import { Link } from "react-router-dom";
import BuildQueueGroup from "../../components/logistics/BuildQueueGroup";
import BuildQueueV31Overview from "../../components/logistics/BuildQueueV31Overview";
import { useShellBreadcrumbDetail } from "../../components/dashboard/shellNavigation";
import BuildQueueCraftCard from "../../components/logistics/BuildQueueCraftCard";
import BuildQueueSelector from "../../components/logistics/BuildQueueSelector";
import {
  readFittingIconMode,
  type FittingIconMode,
} from "../../lib/fitting/fittingIconMode";
import { getInventoryFreshnessBlockReason } from "../../lib/logistics/inventoryFreshness";
import { getActiveInventoryEntries, type SourceStrategy } from "../../lib/logistics/inventory";
import { getQueueLedgerModel } from "../../lib/logistics/queueLedger";
import { computePhysicalAvailabilityCoverage } from "../../lib/logistics/shortages";
import { getQueuePotentialSources } from "../../lib/logistics/queuePotentialSources";
import { useAuthSession } from "../../lib/auth/useAuthSession";
import { useLogisticsStore } from "../../stores/logisticsStore";
import QueueLedger from "../../components/logistics/QueueLedger";
import type { BuildQueue, BuildQueueItem } from "../../types/logistics";
import { createLocalBuildQueueId, normalizeBuildQueueState } from "../../lib/logistics/buildQueues";
import {
  createBuildQueueCompletionSnapshot,
  moveActiveQueueEntry,
  reorderActiveQueueEntries,
} from "../../lib/logistics/buildQueueEntries";
import { getCraftingItemsByBlueprintGuids } from "../../lib/craftingData";
import { formatBuildQueueItemTypeLabel } from "../../lib/logistics/buildQueueItemLabel";
import { readFittingMetaForChannel } from "../../lib/fitting/fittingApi";
import { getMaterialQualityQuantizationFromApi } from "../../lib/craftingReferenceApi";
import { prepareComponentCards } from "../../lib/componentCardIndexApi";
import type { RecipeInputTemplate } from "../../data/logistics/seed";
import type { BuildQueuePageFixture } from "./buildQueueStatsFixture";
import "../../components/logistics/logistics.css";
import "../../components/logistics/build-queue.css";
import "../../components/logistics/build-v31-layout.css";

const FIXTURE_READ_ONLY_MESSAGE = "Build Queue fixture is read-only.";

function formatSummaryNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

type QueueTab = "all" | "active" | "planned" | "completed";
type DragDestinationId = string | "completed" | "new-queue";

function sortQueueItems(items: BuildQueueItem[]) {
  return items.slice().sort(
    (a, b) => Number(b.priorityActive ?? false) - Number(a.priorityActive ?? false) || (a.priority ?? 0) - (b.priority ?? 0),
  );
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
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [inventoryGuardMessage, setInventoryGuardMessage] = useState("");
  const [inventoryEnabled, setInventoryEnabled] = useState(true);
  const [queueTab, setQueueTab] = useState<QueueTab>("all");
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
  const [queueDropIndex, setQueueDropIndex] = useState<number | null>(null);
  const [dragDestinationId, setDragDestinationId] = useState<DragDestinationId | null>(null);
  const [queueRenameRequestToken, setQueueRenameRequestToken] = useState(0);
  const [typeLabelByBlueprintId, setTypeLabelByBlueprintId] = useState<Record<string, string>>({});
  const [datasetBuilds, setDatasetBuilds] = useState<Record<"live" | "ptu", { status: "loading" | "available" | "unavailable"; buildId?: string }>>(() => (
    fixture?.datasetBuilds
      ? {
        live: { status: "available", buildId: fixture.datasetBuilds.live },
        ptu: fixture.datasetBuilds.ptu ? { status: "available", buildId: fixture.datasetBuilds.ptu } : { status: "unavailable" },
      }
      : { live: { status: "loading" }, ptu: { status: "loading" } }
  ));
  const toggleSummaryCollapsed = useCallback(() => {
    setSummaryCollapsed((value) => !value);
  }, []);
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
  const queueListRef = useRef<HTMLDivElement>(null);
  const dragDestinationRef = useRef<DragDestinationId | null>(null);

  useEffect(() => {
    if (isFixture) return;
    const controller = new AbortController();
    void Promise.all([
      readFittingMetaForChannel("LIVE", controller.signal).then((meta) => ({ status: "available" as const, buildId: meta.buildId })).catch(() => ({ status: "unavailable" as const })),
      readFittingMetaForChannel("PTU", controller.signal).then((meta) => ({ status: "available" as const, buildId: meta.buildId })).catch(() => ({ status: "unavailable" as const })),
    ]).then(([live, ptu]) => {
      if (!controller.signal.aborted) setDatasetBuilds({ live, ptu });
    });
    return () => controller.abort();
  }, [isFixture]);

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
  const storeAddBuildQueueItem = useLogisticsStore((s) => s.addBuildQueueItem);
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
  void updateBuildQueueItemQuantity;
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
    ? ((buildQueueItemId: string, allocation: NonNullable<BuildQueueItem["reservedAllocations"]>[number]) => {
        setFixtureBuildQueue((current) => current.map((item) => {
          if (item.id !== buildQueueItemId) return item;
          const allocations = item.reservedAllocations ?? [];
          const exists = allocations.some((entry) => entry.id === allocation.id);
          return {
            ...item,
            reservedAllocations: exists
              ? allocations.filter((entry) => entry.id !== allocation.id)
              : [...allocations, allocation],
          };
        }));
      })
    : storeToggleBuildQueueAllocation;
  const updateBuildQueueAllocationQuantity = isFixture
    ? ((buildQueueItemId: string, allocationId: string, quantity: number) => {
        setFixtureBuildQueue((current) => current.map((item) => {
          if (item.id !== buildQueueItemId) return item;
          return {
            ...item,
            reservedAllocations: (item.reservedAllocations ?? []).flatMap((allocation) => (
              allocation.id !== allocationId
                ? [allocation]
                : quantity > 0
                  ? [{ ...allocation, quantityReserved: quantity }]
                  : []
            )),
          };
        }));
      })
    : storeUpdateBuildQueueAllocationQuantity;
  const clearStaleBuildQueueItemAllocations = isFixture
    ? ((buildQueueItemId: string) => {
        setFixtureBuildQueue((current) => current.map((item) => item.id === buildQueueItemId
          ? { ...item, reservedAllocations: [] }
          : item));
      })
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

  // Selecting a craft changes presentation only. Keep these queue-wide derived
  // models stable so selection does not repeat their inventory traversal.
  const queueLedger = useMemo(
    () => getQueueLedgerModel({ buildQueue: activeBuildQueueItems, inventoryEntries, materials, recipeInputsByRecipeId }),
    [activeBuildQueueItems, inventoryEntries, materials, recipeInputsByRecipeId],
  );
  const materialNameById = useMemo(() => Object.fromEntries(materials.map((material) => [material.id, material.name])), [materials]);
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

    void getMaterialQualityQuantizationFromApi().catch(() => undefined);
    void prepareComponentCards(blueprintIds).catch(() => undefined);
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
  const plannedRows = activeRows.filter(({ item }) => !item.status || item.status === "queued");
  const inProgressRows = activeRows.filter(({ item }) => item.status === "active" || item.status === "paused");
  const visibleRows = queueTab === "all"
    ? [...activeRows, ...completedRows]
    : queueTab === "planned"
      ? plannedRows
      : queueTab === "active" ? inProgressRows : completedRows;
  const resolvedSelectedItemId = useMemo(() => {
    if (visibleRows.length === 0) return null;
    if (selectedItemId && visibleRows.some((row) => row.item.id === selectedItemId)) {
      return selectedItemId;
    }
    return visibleRows[0]?.item.id ?? null;
  }, [visibleRows, selectedItemId]);

  const selectedRow = visibleRows.find((row) => row.item.id === resolvedSelectedItemId) ?? null;
  // V31 sources the currently inspected build, not all queued crafts together.
  const physicalCoverage = useMemo(
    () => selectedRow
      ? computePhysicalAvailabilityCoverage(inventoryEntries, [selectedRow.item], recipeInputsByRecipeId)
      : [],
    [selectedRow?.item, inventoryEntries, recipeInputsByRecipeId],
  );
  const potentialSources = useMemo(
    () => getQueuePotentialSources(physicalCoverage, inventoryEntries, locations, buildQueue),
    [physicalCoverage, inventoryEntries, locations, buildQueue],
  );
  const selectedItemName = selectedRow?.item.itemName
    ?? recipes.find((recipe) => recipe.id === selectedRow?.item.recipeId)?.name;
  useShellBreadcrumbDetail(selectedItemName);

  function getItemTypeLabel(item: BuildQueueItem): string | undefined {
    const blueprintId = item.blueprint_id?.trim();
    if (!blueprintId) return undefined;
    return typeLabelByBlueprintId[blueprintId];
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

  function duplicateBuildQueueItem(item: BuildQueueItem) {
    if (isFixture) {
      flagFixtureReadOnly();
      return;
    }
    // A duplicate is a new planned item with the same material/quality target.
    // It must never inherit existing physical lot reservations.
    storeAddBuildQueueItem(item.recipeId, item.quantity, {
      blueprint_id: item.blueprint_id,
      itemId: item.itemId,
      itemName: item.itemName,
      finalProductQualityBand: item.finalProductQualityBand,
      finalProductQualityAverage: item.finalProductQualityAverage,
      finalProductRarity: item.finalProductRarity,
      materialRequirements: item.materialRequirements,
      blueprintSources: item.blueprintSources,
    });
    setQueueTab("planned");
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
      <div className="bq-page-title-sr" role="status" aria-label="Dataset availability">
        LIVE: {datasetBuilds.live.status === "available" ? datasetBuilds.live.buildId : datasetBuilds.live.status}
        ; PTU: {datasetBuilds.ptu.status === "available" ? datasetBuilds.ptu.buildId : datasetBuilds.ptu.status}
      </div>
      <div className={`bq-v31-workspace${summaryCollapsed ? " bq-v31-workspace--summary-collapsed" : ""}`}>
        <WorkspacePanel as="aside" tone="filter" className="bq-queue-col" aria-label="Build queue list">
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
            <WorkspaceTabs
              className="bq-queue-tabs bq-v31-status-tabs"
              tabClassName="bq-queue-tab"
              labelClassName="bq-queue-tab-label"
              countClassName="bq-queue-tab-count"
              label="Queue sections"
              value={queueTab}
              onChange={setQueueTab}
              options={[
                { value: "all", label: "All", count: activeRows.length + completedRows.length },
                { value: "active", label: "Active", count: inProgressRows.length },
                { value: "planned", label: "Planned", count: plannedRows.length },
                { value: "completed", label: "Completed", count: completedRows.length },
              ]}
            />
            <div
              ref={queueListRef}
              className="bq-queue-list"
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
                {queueTab === "completed" ? "No completed crafts yet." : queueTab === "planned" ? "No planned crafts." : "No builds in this view."}
              </div>
            ) : visibleRows.map((row, index) => {
              const activeDrag = queueTab !== "completed" && Boolean(draggingEntryId);
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
        </WorkspacePanel>

        <section className="bq-center-col" aria-label="Selected craft workspace">
          {selectedRow ? (
            <div className="bq-center-shell">
               <BuildQueueV31Overview
                 item={selectedRow.item}
                 recipes={recipes}
                 recipeInputsByRecipeId={recipeInputsByRecipeId}
                 inventory={inventoryEntries}
                 materialNameById={materialNameById}
                 typeLabel={getItemTypeLabel(selectedRow.item)}
                 onStatusChange={handleStatusChange}
                 onRemove={removeBuildQueueItem}
                 onDuplicate={duplicateBuildQueueItem}
                 readOnly={isFixture}
               />
               <details className="bq-v31-advanced-controls">
                 <summary>Allocation controls and build actions</summary>
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
               </details>
            </div>
          ) : (
            <div className="bq-empty-state bq-empty-state--center">Select a craft from the queue to begin allocation.</div>
          )}
        </section>

        <QueueLedger
          ledger={queueLedger}
          selectedItemName={selectedItemName ?? null}
          physicalCoverage={physicalCoverage}
          potentialSources={potentialSources}
          materialNameById={materialNameById}
          formatValue={formatSummaryNumber}
          collapsed={summaryCollapsed}
          mobile={isMobileQueueLayout}
          onToggleCollapse={toggleSummaryCollapsed}
        />
      </div>
    </div>
  );
}

