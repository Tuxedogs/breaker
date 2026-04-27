import type { BuildQueueItem, BuildStatus, CraftingRecipe, InventoryEntry, ItemCategory, Location, Material } from '../../data/models';
import { allocateMaterialFromStacks, formatQuantity, getRecipeForQueueItem, type SourceStrategy } from '../../lib/logistics/inventory';

interface Props {
  category: ItemCategory;
  items: BuildQueueItem[];
  recipes: CraftingRecipe[];
  inventory: InventoryEntry[];
  materials: Material[];
  locations: Location[];
  strategy: SourceStrategy;
}

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  component: 'Component',
  weapon: 'Weapon',
  armor: 'Armor',
  consumable: 'Consumable',
  ship_part: 'Ship Part',
  other: 'Other',
};

const STATUS_CLASS: Record<BuildStatus, string> = {
  queued: 'logi-badge--queued',
  in_progress: 'logi-badge--in-progress',
  paused: 'logi-badge--paused',
  complete: 'logi-badge--complete',
  cancelled: 'logi-badge--cancelled',
};

const STATUS_LABELS: Record<BuildStatus, string> = {
  queued: 'Queued',
  in_progress: 'In Progress',
  paused: 'Paused',
  complete: 'Complete',
  cancelled: 'Cancelled',
};

export default function BuildQueueGroup({ category, items, recipes, inventory, materials, locations, strategy }: Props) {
  return (
    <div className="logi-bq-group">
      <div className="logi-bq-group-header">
        <span className="logi-bq-group-label">{CATEGORY_LABELS[category]}</span>
        <span className="logi-bq-group-count">{items.length}</span>
      </div>
      {items.map((item) => {
        const recipe = getRecipeForQueueItem(item.itemName, recipes);
        return (
          <div key={item.id} className="logi-bq-item logi-bq-item--stacked">
            <div className="logi-bq-item-main">
              <div className="logi-bq-priority" aria-label={`Priority ${item.priority}`}>{item.priority}</div>
              <div className="logi-bq-item-name">{item.itemName}</div>
              <div className="logi-bq-item-qty">{item.quantity}x</div>
              <span className={`logi-badge ${STATUS_CLASS[item.status]}`}>{STATUS_LABELS[item.status]}</span>
            </div>
            {recipe ? (
              <div className="logi-source-grid">
                {recipe.inputs.map((input) => {
                  const material = materials.find((entry) => entry.id === input.materialId);
                  const required = input.quantity * item.quantity;
                  const allocations = allocateMaterialFromStacks(input.materialId, required, inventory, materials, locations, strategy);
                  return (
                    <div key={input.materialId} className="logi-source-card">
                      <div className="logi-source-card-head">
                        <span>{material?.name ?? input.materialId}</span>
                        <strong>{formatQuantity(required, material)}</strong>
                      </div>
                      {allocations.length > 0 ? (
                        allocations.map(({ stack, quantity }) => (
                          <label key={stack.id} className="logi-source-option">
                            <input type="checkbox" defaultChecked />
                            <span>{stack.location?.name ?? stack.locationId}</span>
                            <span>Q{stack.quality}</span>
                            <span>{formatQuantity(quantity, material)}</span>
                          </label>
                        ))
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
