import type { BuildQueueItem, InventoryEntry, InventoryLocation, MaterialTemplate, RecipeTemplate } from "../../types/logistics";
import type { RecipeInputTemplate } from "../../data/logistics/seed";
import { getBuildQueueItemInputs, getRecipeForQueueItem } from "../../lib/logistics/inventory";
import { getMaterialReservationCoverage } from "../../lib/logistics/selectors";
import { getRequirementLineKey } from "../../lib/logistics/buildQueueReservations";
import { getBuildQueueItemProgress } from "../../lib/logistics/buildQueueProgress";
import { BuildQueueProductIcon } from "./BuildQueueProductIcon";
import type { FittingIconMode } from "../../lib/fitting/fittingIconMode";

const CATEGORY_LABELS: Record<string, string> = {
  component: "Component",
  weapon: "Weapon",
  armor: "Armor",
  consumable: "Consumable",
  ship_part: "Ship Part",
  shield: "Shield",
  other: "Other",
};

function getItemFulfillmentState(item: BuildQueueItem, inputs: RecipeInputTemplate[], inventory: InventoryEntry[]): "complete" | "partial" | "missing" {
  if (inputs.length === 0) return "missing";
  let covered = 0;
  let missing = 0;
  for (const [inputIndex, input] of inputs.entries()) {
    const materialKey = input.materialKey ?? input.materialId;
    const coverage = getMaterialReservationCoverage(item, materialKey, input.quantity * item.quantity, inventory, {
      requirementId: getRequirementLineKey(item, input, inputIndex),
      unitType: input.unitType,
    });
    if (coverage.coverageState === "covered" || coverage.coverageState === "overReserved") covered += 1;
    else missing += 1;
  }
  if (covered > 0 && missing > 0) return "partial";
  if (covered > 0) return "complete";
  return "missing";
}

function getStatusLabel(item: BuildQueueItem, fulfillment: "complete" | "partial" | "missing"): string {
  if (item.status === "complete") return "Ready";
  if (fulfillment === "complete") return "Ready";
  if (fulfillment === "partial") return "In Progress";
  return "Missing";
}

function getLocationHint(item: BuildQueueItem): string {
  const source = item.blueprintSources?.[0];
  if (!source) return "Blueprint source unknown";
  return source.sourceFolder?.trim() || source.displayName;
}

interface Props {
  index: number;
  item: BuildQueueItem;
  category: string;
  recipes: RecipeTemplate[];
  recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]>;
  inventory: InventoryEntry[];
  locations: InventoryLocation[];
  materials: MaterialTemplate[];
  selected: boolean;
  highlighted?: boolean;
  iconMode: FittingIconMode;
  onSelect: (id: string) => void;
  onQuantityChange: (id: string, quantity: number) => void;
}

export default function BuildQueueCraftCard({
  index,
  item,
  category,
  recipes,
  recipeInputsByRecipeId,
  inventory,
  selected,
  highlighted = false,
  iconMode,
  onSelect,
  onQuantityChange,
}: Props) {
  const recipe = getRecipeForQueueItem(item.recipeId, recipes);
  const itemName = item.itemName ?? recipe?.name ?? item.recipeId;
  const inputs = getBuildQueueItemInputs(item, recipeInputsByRecipeId);
  const fulfillment = getItemFulfillmentState(item, inputs, inventory);
  const progress = getBuildQueueItemProgress(item, inventory, recipeInputsByRecipeId) ?? 0;
  const statusLabel = getStatusLabel(item, fulfillment);
  const statusClass = item.status === "complete" || fulfillment === "complete"
    ? "ready"
    : fulfillment === "partial"
      ? "progress"
      : "missing";

  return (
    <button
      type="button"
      className={[
        "bq-craft-card",
        selected ? "is-selected" : "",
        highlighted ? "allocation-owner-highlight" : "",
        `bq-craft-card--${statusClass}`,
      ].filter(Boolean).join(" ")}
      onClick={() => onSelect(item.id)}
      aria-current={selected ? "true" : undefined}
    >
      <span className="bq-craft-card-index">{index}</span>
      <span className="bq-craft-card-thumb" aria-hidden="true">
        <BuildQueueProductIcon item={item} recipe={recipe} preferredMode={iconMode} layout="desktop" alt="" />
      </span>
      <span className="bq-craft-card-body">
        <span className="bq-craft-card-cat">{CATEGORY_LABELS[category] ?? category}</span>
        <span className="bq-craft-card-name">{itemName}</span>
        <span className="bq-craft-card-location">{getLocationHint(item)}</span>
        <span className="bq-craft-card-foot">
          <span className={`bq-craft-card-status bq-craft-card-status--${statusClass}`}>{statusLabel}</span>
          <span className="bq-qty bq-qty--compact" data-bq-row-control="true">
            <button
              type="button"
              className="bq-qty-btn"
              disabled={item.quantity <= 1}
              onClick={(event) => {
                event.stopPropagation();
                onQuantityChange(item.id, item.quantity - 1);
              }}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="bq-qty-val">{item.quantity}</span>
            <button
              type="button"
              className="bq-qty-btn"
              onClick={(event) => {
                event.stopPropagation();
                onQuantityChange(item.id, item.quantity + 1);
              }}
              aria-label="Increase quantity"
            >
              +
            </button>
          </span>
        </span>
      </span>
      <span className="bq-craft-card-ring" aria-label={`${progress}% progress`}>
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <circle className="bq-craft-card-ring-track" cx="18" cy="18" r="15.5" />
          <circle
            className="bq-craft-card-ring-fill"
            cx="18"
            cy="18"
            r="15.5"
            style={{ strokeDasharray: `${progress} 100` }}
          />
        </svg>
        <span>{progress}%</span>
      </span>
    </button>
  );
}
