import type { BuildQueueItem } from "../utils/craftingTypes";
import { formatCraftTime } from "../utils/craftingCalculations";
import type { ComponentRecipe } from "../utils/craftingTypes";
import { getComponentDisplayName } from "../utils/componentDisplayNames";

interface Props {
  queue: BuildQueueItem[];
  recipes: ComponentRecipe[];
  onSetQuantity: (blueprint_id: string, quantity: number) => void;
  onRemove: (blueprint_id: string) => void;
  onClear: () => void;
}

export default function BuildQueuePanel({ queue, recipes, onSetQuantity, onRemove, onClear }: Props) {
  const totalTime = queue.reduce((sum, item) => {
    const recipe = recipes.find((r) => r.blueprint_id === item.blueprint_id);
    return sum + (recipe?.craft_time_seconds ?? 0) * item.quantity;
  }, 0);

  return (
    <div className="craft-section">
      <div className="craft-section-header">
        <span className="craft-section-title">Build Queue</span>
        <div className="craft-section-actions">
          {queue.length > 0 && (
            <>
              <span className="craft-cell-mono craft-muted">{formatCraftTime(totalTime)} total</span>
              <button type="button" className="craft-btn-ghost" onClick={onClear}>
                Clear All
              </button>
            </>
          )}
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="craft-empty-state">
          <p>No items in queue. Add components from the recipe browser above.</p>
        </div>
      ) : (
        <div className="craft-queue-list">
          {queue.map((item) => {
            const recipe = recipes.find((r) => r.blueprint_id === item.blueprint_id);
            const displayName = item.item_kind === "vehicle" ? item.component_name : getComponentDisplayName(item.component_name);
            const materials = recipe?.materials ?? item.materials ?? [];
            return (
              <div key={item.blueprint_id} className="craft-queue-item">
                <div className="craft-queue-item-info">
                  <span className="craft-queue-item-name" title={item.component_name}>{displayName}</span>
                  <span className="craft-queue-item-meta">
                    {item.item_kind && <span className="craft-badge craft-badge--type">{item.item_kind}</span>}
                    <span className="craft-badge craft-badge--neutral">{item.component_type}</span>
                    {item.size && <span className="craft-badge craft-badge--neutral">S{item.size}</span>}
                    {recipe && (
                      <span className="craft-muted craft-cell-mono">
                        {formatCraftTime(recipe.craft_time_seconds * item.quantity)}
                      </span>
                    )}
                  </span>
                  {materials.length > 0 && (
                    <div className="craft-queue-materials">
                      {materials.map((material) => (
                        <span key={`${item.blueprint_id}:${material.slot}:${material.cost_id}`} className="craft-queue-material">
                          <span className="craft-badge craft-badge--sm craft-badge--slot">{material.slot}</span>
                          <span>{material.material_name}</span>
                          <span className="craft-cell-mono">x{(material.quantity * item.quantity).toFixed(2)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="craft-queue-item-controls">
                  <button
                    type="button"
                    className="craft-qty-btn"
                    onClick={() => onSetQuantity(item.blueprint_id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                  >−</button>
                  <span className="craft-qty-value">{item.quantity}</span>
                  <button
                    type="button"
                    className="craft-qty-btn"
                    onClick={() => onSetQuantity(item.blueprint_id, item.quantity + 1)}
                  >+</button>
                  <button
                    type="button"
                    className="craft-btn-remove"
                    onClick={() => onRemove(item.blueprint_id)}
                    title="Remove"
                  >×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
