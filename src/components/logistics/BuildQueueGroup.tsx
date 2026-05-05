import type { BuildQueueItem, InventoryEntry, InventoryLocation, MaterialTemplate, RecipeTemplate, ReservedMaterialAllocation } from '../../types/logistics';
import type { RecipeInputTemplate } from '../../data/logistics/seed';
import { formatQuantity, getInventoryStacks, getRecipeForQueueItem, getRecipeInputs, materialTypeClass, rarityClass, type InventoryStack, type SourceStrategy } from '../../lib/logistics/inventory';
import {
  getAvailableQuantityForInventoryEntry,
  getBuildQueueMaterialNeedSummary,
  getMaterialReservationCoverage,
} from '../../lib/logistics/selectors';

function AllocationQtyInput({ value, max, onCommit }: { value: number; max: number; onCommit: (val: number) => void }) {
  return (
    <input
      type="number"
      className="logi-source-qty"
      aria-label="Reserved quantity"
      min={0}
      max={max}
      step="0.01"
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const nextValue = e.target.value === '' ? 0 : Number(e.target.value);
        onCommit(Number.isFinite(nextValue) ? nextValue : value);
      }}
    />
  );
}

interface Props {
  category: string;
  items: BuildQueueItem[];
  recipes: RecipeTemplate[];
  recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]>;
  buildQueue: BuildQueueItem[];
  inventory: InventoryEntry[];
  materials: MaterialTemplate[];
  locations: InventoryLocation[];
  strategy: SourceStrategy;
  onPriorityChange: (id: string, priority: number) => void;
  onRemove: (id: string) => void;
  onToggleAllocation: (buildQueueItemId: string, allocation: ReservedMaterialAllocation) => void;
  onUpdateAllocationQuantity: (buildQueueItemId: string, inventoryEntryId: string, quantity: number) => void;
  onClearAllocations: (buildQueueItemId: string) => void;
  onClearStaleAllocations: (buildQueueItemId: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  component: 'Component',
  weapon: 'Weapon',
  armor: 'Armor',
  consumable: 'Consumable',
  ship_part: 'Ship Part',
  other: 'Other',
};

const STATUS_CLASS: Record<NonNullable<BuildQueueItem['status']>, string> = {
  queued: 'logi-badge--queued',
  active: 'logi-badge--in-progress',
  paused: 'logi-badge--paused',
  complete: 'logi-badge--complete',
};

const STATUS_LABELS: Record<NonNullable<BuildQueueItem['status']>, string> = {
  queued: 'Queued',
  active: 'In Progress',
  paused: 'Paused',
  complete: 'Complete',
};


const COVERAGE_LABELS = {
  covered: 'Covered',
  partial: 'Partial',
  missing: 'Missing',
  overReserved: 'Over-reserved',
  stale: 'Stale',
};

const STALE_REASON_LABELS: Record<string, string> = {
  missingStack: 'missing stack',
  mismatchedMaterial: 'material changed',
  nonPositiveQuantity: 'empty reservation',
  exceedsStackQuantity: 'exceeds current stack',
};

function sortStacks(stacks: InventoryStack[], strategy: SourceStrategy): InventoryStack[] {
  return stacks.slice().sort((a, b) => {
    if (strategy === 'highest-quality') return (b.quality ?? 0) - (a.quality ?? 0) || b.quantity - a.quantity;
    if (strategy === 'minimize-splits') return b.quantity - a.quantity || (b.quality ?? 0) - (a.quality ?? 0);
    return (a.location?.name ?? a.locationId ?? '').localeCompare(b.location?.name ?? b.locationId ?? '') || b.quantity - a.quantity;
  });
}

function createAllocation(stack: InventoryStack, materialName: string | undefined, quantityReserved: number): ReservedMaterialAllocation {
  return {
    id: `${stack.id}-${stack.materialId}`,
    materialId: stack.materialId,
    inventoryEntryId: stack.id,
    quantityReserved,
    materialName,
    quality: stack.quality,
    rarity: stack.rarity,
    locationId: stack.locationId,
    container: stack.container,
  };
}

export default function BuildQueueGroup({
  category,
  items,
  recipes,
  recipeInputsByRecipeId,
  buildQueue,
  inventory,
  materials,
  locations,
  strategy,
  onPriorityChange,
  onRemove,
  onToggleAllocation,
  onUpdateAllocationQuantity,
  onClearAllocations,
  onClearStaleAllocations,
}: Props) {
  return (
    <div className="logi-bq-group">
      <div className="logi-bq-group-header">
        <span className="logi-bq-group-label">{CATEGORY_LABELS[category]}</span>
        <span className="logi-bq-group-count">{items.length}</span>
      </div>
      {items.map((item) => {
        const recipe = getRecipeForQueueItem(item.recipeId, recipes);
        const itemName = recipe?.name ?? item.recipeId;
        const status = item.status ?? 'queued';
        return (
          <div key={item.id} className="logi-bq-item logi-bq-item--stacked">
            <div className="logi-bq-item-main">
              <input
                type="number"
                className="logi-bq-priority"
                aria-label={`Priority for ${itemName}`}
                min="1"
                step="1"
                value={item.priority ?? 1}
                onChange={(event) => onPriorityChange(item.id, Number(event.target.value) || 1)}
              />
              <div className="logi-bq-item-name">{itemName}</div>
              <div className="logi-bq-item-qty">{item.quantity}x</div>
              <span className={`logi-badge ${STATUS_CLASS[status]}`}>{STATUS_LABELS[status]}</span>
              <button
                type="button"
                className="logi-action-btn logi-action-btn--delete"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${itemName} from build queue`}
              >
                <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                </svg>
              </button>
              {(item.reservedAllocations?.length ?? 0) > 0 && (
                <button
                  type="button"
                  className="logi-btn-ghost"
                  onClick={() => onClearAllocations(item.id)}
                >
                  Clear Selections
                </button>
              )}
            </div>
            {recipe ? (
              <div className="logi-source-grid">
                {getRecipeInputs(recipe.id, recipeInputsByRecipeId).map((input) => {
                  const material = materials.find((entry) => entry.id === input.materialId);
                  const required = input.quantity * item.quantity;
                  const coverage = getMaterialReservationCoverage(item, input.materialId, required, inventory);
                  const needSummary = getBuildQueueMaterialNeedSummary(item, input.materialId, required, inventory, buildQueue);
                  const ownAllocations = item.reservedAllocations?.filter((allocation) => allocation.materialId === input.materialId) ?? [];
                  const ownReservedByStack = new Map(ownAllocations.map((allocation) => [allocation.inventoryEntryId, allocation.quantityReserved]));
                  const remainingRequired = Math.max(0, required - coverage.reservedQuantity);
                  const stacks = sortStacks(
                    getInventoryStacks(
                      inventory.filter((entry) => entry.materialId === input.materialId && entry.quantity > 0),
                      materials,
                      locations,
                    ),
                    strategy,
                  ).filter((stack) => getAvailableQuantityForInventoryEntry(stack, buildQueue, item.id) > 0 || ownReservedByStack.has(stack.id));
                  const staleAllocations = coverage.validations.filter((validation) => validation.isStale);
                  return (
                    <div key={input.materialId} className="logi-source-card">
                      <div className="logi-source-card-head">
                        <span>{material?.name ?? input.materialId}</span>
                        <strong className={materialTypeClass(material)}>{formatQuantity(coverage.reservedQuantity, material)} / {formatQuantity(required, material)}</strong>
                        <span className={`logi-badge ${coverage.coverageState === 'covered' ? 'logi-badge--complete' : coverage.coverageState === 'missing' ? 'logi-badge--shortage' : 'logi-badge--paused'}`}>
                          {COVERAGE_LABELS[coverage.coverageState]}
                        </span>
                      </div>
                      <div className="logi-source-empty">
                        <span className={materialTypeClass(material)}>Owned {formatQuantity(needSummary.ownedQuantity, material)} / Available {formatQuantity(needSummary.availableQuantity, material)} / Still needed {formatQuantity(needSummary.stillNeeded, material)}</span>
                      </div>
                      {staleAllocations.map(({ allocation, staleReason }) => (
                        <div key={allocation.id} className="logi-source-empty">
                          Stale reservation: {allocation.materialName ?? allocation.materialId} ({STALE_REASON_LABELS[staleReason ?? ''] ?? 'invalid'})
                          <button
                            type="button"
                            className="logi-btn-ghost"
                            onClick={() => onClearStaleAllocations(item.id)}
                          >
                            Remove stale
                          </button>
                        </div>
                      ))}
                      {stacks.length > 0 ? (
                        stacks.map((stack) => {
                          const reservedQuantity = ownReservedByStack.get(stack.id) ?? 0;
                          const availableQuantity = getAvailableQuantityForInventoryEntry(stack, buildQueue, item.id);
                          const availableAfterThisReservation = Math.max(0, availableQuantity - reservedQuantity);
                          const maxReservedQuantity = availableAfterThisReservation + reservedQuantity;
                          const checked = reservedQuantity > 0;
                          const nextQuantity = Math.min(remainingRequired, availableAfterThisReservation);
                          const disabled = !checked && nextQuantity <= 0;
                          return (
                            <label key={stack.id} className="logi-source-option">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={disabled}
                                onChange={() => {
                                  const quantityReserved = checked ? reservedQuantity : nextQuantity;
                                  if (quantityReserved <= 0) return;
                                  onToggleAllocation(item.id, createAllocation(stack, material?.name, quantityReserved));
                                }}
                              />
                              <span>{stack.location?.name ?? stack.locationId}</span>
                              <span>{stack.container ?? '-'}</span>
                              <span className={rarityClass(stack.rarity)}>{stack.quality}</span>
                              <span style={{ color: stack.rarity.colorToken }}>{stack.rarity.label}</span>
                              {checked ? (
                                <span className="logi-source-qty-cell">
                                  Reserved
                                  <AllocationQtyInput
                                    value={reservedQuantity}
                                    max={maxReservedQuantity}
                                    onCommit={(val) => onUpdateAllocationQuantity(item.id, stack.id, val)}
                                  />
                                </span>
                              ) : (
                                <span className={materialTypeClass(material)}>{formatQuantity(reservedQuantity, material)} / {formatQuantity(stack.quantity, material)}</span>
                              )}
                              <span className={materialTypeClass(material)}>{formatQuantity(availableAfterThisReservation, material)} avail</span>
                            </label>
                          );
                        })
                      ) : (
                        <div className="logi-source-empty">No stored stack available</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="logi-source-empty">No recipe mapped for source selection.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
