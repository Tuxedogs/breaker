import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router-dom";
import BuildQueueGroup from "../../components/logistics/BuildQueueGroup";
import BuildQueueCraftCard from "../../components/logistics/BuildQueueCraftCard";
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
import type { BuildQueueItem, RecipeTemplate } from "../../types/logistics";
import { getCraftingItems } from "../../lib/craftingData";
import { formatBuildQueueItemTypeLabel } from "../../lib/logistics/buildQueueItemLabel";
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
  const [typeLabelByBlueprintId, setTypeLabelByBlueprintId] = useState<Record<string, string>>({});
  const isMobileQueueLayout = useIsMobileQueueLayout();
  const mobileSelectorRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mobileSelectorPointerRef = useRef<{ id: number; startX: number; startY: number } | null>(null);
  const suppressMobileSelectorTapRef = useRef(false);

  const allInventoryEntries = useLogisticsStore((s) => s.inventoryEntries);
  const storeInventoryEntries = useMemo(() => getActiveInventoryEntries(allInventoryEntries), [allInventoryEntries]);
  const storeBuildQueue = useLogisticsStore((s) => s.buildQueue);
  const storeLocations = useLogisticsStore((s) => s.locations);
  const storeMaterials = useLogisticsStore((s) => s.materialTemplates);
  const storeRecipes = useLogisticsStore((s) => s.recipeTemplates);
  const storeRecipeInputsByRecipeId = useLogisticsStore((s) => s.recipeInputTemplates);
  const inventorySync = useLogisticsStore((state) => state.inventorySync);
  const storeUpdateBuildQueueItemQuantity = useLogisticsStore((s) => s.updateBuildQueueItemQuantity);
  const storeUpdateBuildQueueItemAllowLowerQuality = useLogisticsStore((s) => s.updateBuildQueueItemAllowLowerQuality);
  const storeUpdateBuildQueueMaterialRequirement = useLogisticsStore((s) => s.updateBuildQueueMaterialRequirement);
  const storeUpdateBuildQueueItemStatus = useLogisticsStore((s) => s.updateBuildQueueItemStatus);
  const storeRemoveBuildQueueItem = useLogisticsStore((s) => s.removeBuildQueueItem);
  const storeToggleBuildQueueAllocation = useLogisticsStore((s) => s.toggleBuildQueueAllocation);
  const storeUpdateBuildQueueAllocationQuantity = useLogisticsStore((s) => s.updateBuildQueueAllocationQuantity);
  const storeClearStaleBuildQueueItemAllocations = useLogisticsStore((s) => s.clearStaleBuildQueueItemAllocations);
  const storeAddInventoryEntries = useLogisticsStore((s) => s.addInventoryEntries);

  const inventoryEntries = fixture?.inventoryEntries ?? storeInventoryEntries;
  const buildQueue = fixture?.buildQueue ?? storeBuildQueue;
  const locations = fixture?.locations ?? storeLocations;
  const materials = fixture?.materials ?? storeMaterials;
  const recipes = fixture?.recipes ?? storeRecipes;
  const recipeInputsByRecipeId = fixture?.recipeInputsByRecipeId ?? storeRecipeInputsByRecipeId;

  const updateBuildQueueItemQuantity = isFixture
    ? (() => { setInventoryGuardMessage(FIXTURE_READ_ONLY_MESSAGE); })
    : storeUpdateBuildQueueItemQuantity;
  const updateBuildQueueItemAllowLowerQuality = isFixture
    ? (() => { setInventoryGuardMessage(FIXTURE_READ_ONLY_MESSAGE); })
    : storeUpdateBuildQueueItemAllowLowerQuality;
  const updateBuildQueueMaterialRequirement = isFixture
    ? (() => { setInventoryGuardMessage(FIXTURE_READ_ONLY_MESSAGE); })
    : storeUpdateBuildQueueMaterialRequirement;
  const updateBuildQueueItemStatus = isFixture
    ? (() => { setInventoryGuardMessage(FIXTURE_READ_ONLY_MESSAGE); })
    : storeUpdateBuildQueueItemStatus;
  const removeBuildQueueItem = isFixture
    ? (() => { setInventoryGuardMessage(FIXTURE_READ_ONLY_MESSAGE); })
    : storeRemoveBuildQueueItem;
  const toggleBuildQueueAllocation = isFixture
    ? (() => { setInventoryGuardMessage(FIXTURE_READ_ONLY_MESSAGE); })
    : storeToggleBuildQueueAllocation;
  const updateBuildQueueAllocationQuantity = isFixture
    ? (() => { setInventoryGuardMessage(FIXTURE_READ_ONLY_MESSAGE); })
    : storeUpdateBuildQueueAllocationQuantity;
  const clearStaleBuildQueueItemAllocations = isFixture
    ? (() => { setInventoryGuardMessage(FIXTURE_READ_ONLY_MESSAGE); })
    : storeClearStaleBuildQueueItemAllocations;
  const addInventoryEntries = isFixture
    ? (() => { setInventoryGuardMessage(FIXTURE_READ_ONLY_MESSAGE); })
    : storeAddInventoryEntries;

  const queueLedger = getQueueLedgerModel({ buildQueue, inventoryEntries, materials, recipeInputsByRecipeId });
  const freshnessBlockReason = isFixture
    ? FIXTURE_READ_ONLY_MESSAGE
    : getInventoryFreshnessBlockReason(inventorySync, authenticatedUserId);

  useEffect(() => {
    const blueprintIds = [...new Set(
      buildQueue.map((item) => item.blueprint_id).filter((id): id is string => Boolean(id?.trim())),
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
  }, [buildQueue]);

  const activeRows = sortQueueItems(buildQueue.filter((item) => item.status !== "complete")).map((item) => ({ item }));
  const completedRows = sortQueueItems(buildQueue.filter((item) => item.status === "complete")).map((item) => ({ item }));
  const visibleRows = queueTab === "active" ? activeRows : completedRows;
  const resolvedSelectedItemId = (() => {
    if (visibleRows.length === 0) return null;
    if (selectedItemId && visibleRows.some((row) => row.item.id === selectedItemId)) {
      return selectedItemId;
    }
    return visibleRows[0]?.item.id ?? null;
  })();

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
    if (isFixture) {
      setInventoryGuardMessage(FIXTURE_READ_ONLY_MESSAGE);
      return;
    }
    if (status === "complete" && freshnessBlockReason) {
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

  function handleQuickAddInventory(entries: Parameters<typeof addInventoryEntries>[0]) {
    if (isFixture) {
      setInventoryGuardMessage(FIXTURE_READ_ONLY_MESSAGE);
      return;
    }
    addInventoryEntries(entries);
    setInventoryGuardMessage("");
  }
  return (
    <div className="bq-page" data-bq-fixture={isFixture ? "stats" : undefined}>
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
                <BuildQueueCraftCard
                  key={row.item.id}
                  index={index + 1}
                  item={row.item}
                  itemTypeLabel={getItemTypeLabel(row.item)}
                  recipes={recipes}
                  recipeInputsByRecipeId={recipeInputsByRecipeId}
                  inventory={inventoryEntries}
                  selected={row.item.id === resolvedSelectedItemId}
                  highlighted={row.item.id === allocationOwnerHighlightId}
                  onSelect={setSelectedItemId}
                />
              ))}
            </div>
          </div>

          <footer className="bq-queue-col-foot">
            <Link className="bq-add-another-btn" to="/industry/crafting">
              + Add Another Craft
            </Link>
          </footer>
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


