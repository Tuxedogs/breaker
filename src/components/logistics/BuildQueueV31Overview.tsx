import WorkspaceMetricStrip from "../shared/WorkspaceMetricStrip";
import { Link } from "react-router-dom";
import type { BuildQueueItem, InventoryEntry, RecipeTemplate } from "../../types/logistics";
import type { RecipeInputTemplate } from "../../data/logistics/seed";
import { getBuildQueueItemInputs } from "../../lib/logistics/inventory";
import { getBuildQueueItemAllocationSummary } from "../../lib/logistics/buildQueueProgress";
import {
  allocationMatchesRequirement,
  getAllocationTotal,
  getRequirementLineKey,
  isInventoryEntrySupportedForBuildQueuePhysicalAvailability,
  validateReservedAllocations,
} from "../../lib/logistics/buildQueueReservations";

type Props = {
  item: BuildQueueItem;
  recipes: RecipeTemplate[];
  recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]>;
  inventory: InventoryEntry[];
  materialNameById: Record<string, string>;
  typeLabel?: string;
  onStatusChange?: (id: string, status: NonNullable<BuildQueueItem["status"]>) => void;
  onRemove?: (id: string) => void;
  onDuplicate?: (item: BuildQueueItem) => void;
  readOnly?: boolean;
};

const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function BuildQueueV31Overview({
  item, recipes, recipeInputsByRecipeId, inventory, materialNameById, typeLabel,
  onStatusChange, onRemove, onDuplicate, readOnly = false,
}: Props) {
  const inputs = getBuildQueueItemInputs(item, recipeInputsByRecipeId);
  const summary = getBuildQueueItemAllocationSummary(item, inputs, inventory);
  const itemName = item.itemName ?? recipes.find((recipe) => recipe.id === item.recipeId)?.name ?? item.recipeId;
  const linkedLotIds = new Set<string>();
  const rows = inputs.map((input, index) => {
    const required = Math.max(0, input.quantity * item.quantity);
    const identity = input.materialKey ?? input.materialId;
    const requirementId = getRequirementLineKey(item, input, index);
    const matching = (item.reservedAllocations ?? []).filter((allocation) =>
      allocationMatchesRequirement(allocation, identity, { requirementId, unitType: input.unitType }),
    );
    const validated = validateReservedAllocations(matching, inventory)
      .filter((validation) =>
        !validation.isStale &&
        validation.inventoryEntry !== undefined &&
        isInventoryEntrySupportedForBuildQueuePhysicalAvailability(validation.inventoryEntry),
      )
      .map((validation) => validation.allocation);
    validated.forEach((allocation) => linkedLotIds.add(allocation.inventoryEntryId));
    const allocated = getAllocationTotal(validated);
    const stored = inventory
      .filter((entry) =>
        (entry.materialId === input.materialId || entry.materialId === identity) &&
        isInventoryEntrySupportedForBuildQueuePhysicalAvailability(entry),
      )
      .reduce((total, entry) => total + Math.max(0, entry.quantity), 0);
    return {
      id: requirementId,
      name: input.displayName ?? input.materialName ?? materialNameById[input.materialId] ?? identity,
      required,
      allocated,
      stored,
      shortfall: Math.max(0, required - allocated),
      units: input.unitType?.toLowerCase() === "unit" ? "units" : "SCU",
    };
  });
  const covered = rows.filter((row) => row.shortfall <= 0).length;
  const remaining = rows.length - covered;
  const progress = summary.progressPercent;
  const status = item.status === "complete" ? "Completed" : item.status === "active" ? "Active" : item.status === "paused" ? "Paused" : "Planned";

  return (
    <section className="bq-v31-overview" aria-label="Build planning overview">
      <header className="bq-v31-build-hero">
        <div className="bq-v31-hero-category">{typeLabel ?? "Crafting blueprint"}</div>
        <span className="bq-v31-build-state">{status}</span>
        <h2>{itemName}</h2>
        <p>{number(item.quantity)} {item.quantity === 1 ? "unit" : "units"} requested · {rows.length} material {rows.length === 1 ? "requirement" : "requirements"}</p>
      </header>
      <WorkspaceMetricStrip className="bq-v31-metrics" aria-label="Physical allocation summary">
        <div><span>Completed</span><strong>{item.status === "complete" ? number(item.quantity) : "0"}/{number(item.quantity)}</strong></div>
        <div><span>Requirements covered</span><strong>{covered}/{rows.length}</strong></div>
        <div><span>Material lines short</span><strong className={remaining ? "is-short" : ""}>{remaining}</strong></div>
        <div><span>Linked physical lots</span><strong>{linkedLotIds.size}</strong></div>
      </WorkspaceMetricStrip>
      <div className="bq-v31-coverage">
        <span>Material allocation {progress === null ? "unavailable" : progress + "%"}</span>
        <div role="progressbar" aria-label="Material allocation coverage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ?? undefined}>
          <span style={{ width: (progress ?? 0) + "%" }} />
        </div>
      </div>
      <div className="bq-v31-production" aria-label="Build completion progress">
        <span>Production {item.status === "complete" ? "100%" : "0%"}</span>
        <div role="progressbar" aria-label="Build completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.status === "complete" ? 100 : 0}>
          <span style={{ width: item.status === "complete" ? "100%" : "0%" }} />
        </div>
      </div>
      <div className="bq-v31-actions" aria-label="Selected build actions">
        <button type="button" onClick={() => onStatusChange?.(item.id, item.status === "complete" ? "queued" : "complete")} disabled={readOnly || !onStatusChange}>
          {item.status === "complete" ? "Reopen build" : "Mark build complete"}
        </button>
        <button type="button" onClick={() => onDuplicate?.(item)} disabled={readOnly || !onDuplicate}>Duplicate</button>
        <button type="button" className="bq-v31-actions--danger" onClick={() => onRemove?.(item.id)} disabled={readOnly || !onRemove}>Remove</button>
      </div>
      <div className="bq-v31-material-plan-head">
        <h3>Material Planning</h3>
        <Link to="/logistics/inventory">Open Inventory</Link>
      </div>
      {rows.length ? (
        <div className="bq-v31-material-table-scroll">
          <table className="bq-v31-material-table">
            <thead>
              <tr><th>Material</th><th>Needed</th><th>Allocated</th><th>Stored</th><th>Shortfall</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.name}</th>
                  <td>{number(row.required)} <small>{row.units}</small></td>
                  <td>{number(row.allocated)}</td>
                  <td>{number(row.stored)}</td>
                  <td className={row.shortfall > 0 ? "is-short" : "is-covered"}>{number(row.shortfall)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="bq-v31-material-empty">No material requirements are recorded for this build.</div>}
      <p className="bq-v31-stock-note">Stored shows total recorded physical lots, including reserved stock. Allocated counts only valid reservations for this build.</p>
    </section>
  );
}
