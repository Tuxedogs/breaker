import type { DragEvent, KeyboardEvent } from "react";
import type { BuildQueueItem, InventoryEntry, RecipeTemplate } from "../../types/logistics";
import type { RecipeInputTemplate } from "../../data/logistics/seed";
import { getBuildQueueItemInputs, getRecipeForQueueItem } from "../../lib/logistics/inventory";
import { getMaterialReservationCoverage } from "../../lib/logistics/selectors";
import { getRequirementLineKey } from "../../lib/logistics/buildQueueReservations";
import { getBuildQueueItemProgress } from "../../lib/logistics/buildQueueProgress";
import BuildQueueFrame from "./BuildQueueFrame";

const FALLBACK_TYPE_LABELS: Record<string, string> = {
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
  if (item.status === "complete") return "Complete";
  if (fulfillment === "complete") return "Ready";
  if (fulfillment === "partial") return "In Progress";
  return "Missing";
}

interface Props {
  index: number;
  item: BuildQueueItem;
  itemTypeLabel?: string;
  recipes: RecipeTemplate[];
  recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]>;
  inventory: InventoryEntry[];
  inventoryEnabled?: boolean;
  selected: boolean;
  highlighted?: boolean;
  onSelect: (id: string) => void;
  dragging?: boolean;
  dragActive?: boolean;
  onDragStart?: (event: DragEvent<HTMLButtonElement>, id: string) => void;
  onDragEnd?: (event: DragEvent<HTMLButtonElement>) => void;
  onKeyboardReorder?: (id: string, direction: -1 | 1) => void;
}

export default function BuildQueueCraftCard({
  index,
  item,
  itemTypeLabel,
  recipes,
  recipeInputsByRecipeId,
  inventory,
  inventoryEnabled = true,
  selected,
  highlighted = false,
  onSelect,
  dragging = false,
  dragActive = false,
  onDragStart,
  onDragEnd,
  onKeyboardReorder,
}: Props) {
  const recipe = getRecipeForQueueItem(item.recipeId, recipes);
  const itemName = item.itemName ?? recipe?.name ?? item.recipeId;
  const inputs = getBuildQueueItemInputs(item, recipeInputsByRecipeId);
  const fulfillment = getItemFulfillmentState(item, inputs, inventory);
  const progress = getBuildQueueItemProgress(item, inventory, recipeInputsByRecipeId) ?? 0;
  const statusLabel = getStatusLabel(item, fulfillment);
  const isCraftComplete = item.status === "complete";
  const statusClass = isCraftComplete
    ? "ready"
    : fulfillment === "complete"
      ? "ready"
      : fulfillment === "partial"
        ? "progress"
        : "missing";
  const typeLabel = itemTypeLabel ?? FALLBACK_TYPE_LABELS[recipe?.category ?? "other"] ?? "Ship Part";

  function handleReorderKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!onKeyboardReorder || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    event.stopPropagation();
    onKeyboardReorder(item.id, event.key === "ArrowUp" ? -1 : 1);
  }

  return (
    <div className={`bq-craft-card-shell${dragging ? " is-dragging" : ""}${dragActive ? " is-drag-context" : ""}`} data-bq-entry-id={item.id}>
      <button
        type="button"
        className={[
          "bq-craft-card",
          selected ? "is-selected" : "",
          highlighted ? "allocation-owner-highlight" : "",
          isCraftComplete ? "bq-craft-card--done" : "",
          `bq-craft-card--${statusClass}`,
        ].filter(Boolean).join(" ")}
        onClick={() => onSelect(item.id)}
        aria-current={selected ? "true" : undefined}
      >
        <BuildQueueFrame asset={selected ? "queue-item-frame-active.svg" : "queue-item-frame.svg"} />
        <span className="bq-craft-card-index">{index}</span>
        <span className="bq-craft-card-main">
          <span className="bq-craft-card-cat">{typeLabel}</span>
          <span className="bq-craft-card-name">{itemName}</span>
          <span className={`bq-craft-card-status bq-craft-card-status--${inventoryEnabled ? statusClass : "queued"}`}>
            {inventoryEnabled ? statusLabel : "Queued"}
          </span>
        </span>
        <span className="bq-craft-card-progress-col">
          {!inventoryEnabled ? (
            <span className="bq-craft-card-quantity" aria-label={`${item.quantity} crafts`}>{item.quantity}x</span>
          ) : isCraftComplete ? (
            <span className="bq-craft-card-check" aria-label="Completed">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6.5 12.5 3.2 3.2 7.8-8" />
              </svg>
            </span>
          ) : (
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
          )}
        </span>
      </button>
      {!isCraftComplete ? (
        <button
          type="button"
          className="bq-craft-card-drag-handle"
          draggable
          aria-label={`Reorder ${itemName}. Use drag and drop, or Up and Down Arrow keys.`}
          title="Drag to reorder or move"
          onDragStart={(event) => onDragStart?.(event, item.id)}
          onDragEnd={onDragEnd}
          onKeyDown={handleReorderKey}
          onClick={(event) => event.stopPropagation()}
        >
          <span aria-hidden="true">⠿</span>
        </button>
      ) : null}
    </div>
  );
}
