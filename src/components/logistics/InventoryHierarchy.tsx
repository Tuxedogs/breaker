import type { InventoryEntry } from "../../types/logistics";
import {
  formatInventoryQuantity,
  qualityBadgeClass,
} from "../../lib/logistics/inventory";
import type {
  InventoryHierarchyRow,
  InventoryPrimaryFolder,
  InventoryQualityFolder,
  InventorySecondaryFolder,
} from "../../lib/logistics/inventoryHierarchy";
import MaterialIcon from "./MaterialIcon";

export type InventoryAddContext = {
  locationId?: string;
  materialId?: string;
  displayName?: string;
  quality?: number;
};

type ReservedLotInfo = {
  quantity: number;
  owners: Set<string>;
};

type Props = {
  folders: InventoryPrimaryFolder[];
  presentation: "tree" | "list";
  expandedKeys: Set<string>;
  reservedByLotId: Map<string, ReservedLotInfo>;
  manageLocationId: string | null;
  selectedEntryIds: Set<string>;
  onToggleExpanded: (key: string) => void;
  onStartManage: (locationId: string) => void;
  onToggleSelect: (entryId: string) => void;
  onAdd: (context: InventoryAddContext) => void;
  onEdit: (entry: InventoryEntry) => void;
  onDelete: (entry: InventoryEntry) => void;
  onTransfer: (entry: InventoryEntry) => void;
};

function Chevron() {
  return (
    <svg className="logi-inv-tree-chevron" aria-hidden viewBox="0 0 16 16">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function folderQuantityLabel(folder: Pick<InventoryPrimaryFolder, "totalScu" | "totalUnits">): string {
  return [
    folder.totalScu > 0 ? formatInventoryQuantity(folder.totalScu, "scu") : "",
    folder.totalUnits > 0 ? formatInventoryQuantity(folder.totalUnits, "unit") : "",
  ].filter(Boolean).join(" · ") || "Empty";
}

function rowAddContext(row: InventoryHierarchyRow, quality?: number | null): InventoryAddContext {
  return {
    locationId: row.locationId,
    materialId: row.entry.materialId,
    displayName: row.itemName,
    quality: quality ?? undefined,
  };
}

function InventoryBoxRow({
  row,
  index,
  reserve,
  manageLocationId,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
  onTransfer,
  contextLabel,
}: {
  row: InventoryHierarchyRow;
  index: number;
  reserve?: ReservedLotInfo;
  manageLocationId: string | null;
  selected: boolean;
  onToggleSelect: (entryId: string) => void;
  onEdit: (entry: InventoryEntry) => void;
  onDelete: (entry: InventoryEntry) => void;
  onTransfer: (entry: InventoryEntry) => void;
  contextLabel?: string;
}) {
  const reservedQuantity = Math.min(row.entry.quantity, reserve?.quantity ?? 0);
  const availableQuantity = Math.max(0, row.entry.quantity - reservedQuantity);
  const fullyReserved = reservedQuantity >= row.entry.quantity && row.entry.quantity > 0;
  const partiallyReserved = reservedQuantity > 0 && !fullyReserved;
  const selectable = manageLocationId !== null && manageLocationId === row.locationKey;
  const label = row.entry.recordKind === "box"
    ? row.entry.container?.trim() || `Box ${index + 1}`
    : "Aggregate stock";
  const ownerLabel = reserve?.owners.size ? Array.from(reserve.owners).join(", ") : "";
  const stateLabel = fullyReserved ? "Reserved" : partiallyReserved ? "Partially reserved" : "Available";

  return (
    <div className={`logi-inv-tree-box${selected ? " is-selected" : ""}${fullyReserved ? " is-unavailable" : ""}`}>
      {manageLocationId !== null ? (
        <span className="logi-inv-tree-box-select">
          <input
            type="checkbox"
            checked={selected}
            disabled={!selectable}
            onChange={() => onToggleSelect(row.id)}
            aria-label={`Select ${label}`}
          />
        </span>
      ) : null}
      <span className="logi-inv-tree-box-name">
        <strong>{label}</strong>
        <small>{contextLabel ?? (row.entry.recordKind === "box" ? "Physical box" : "Legacy aggregate record")}</small>
      </span>
      <span className="logi-inv-tree-box-quantity">
        <strong>{formatInventoryQuantity(row.entry.quantity, row.unitType)}</strong>
        {reservedQuantity > 0 ? (
          <small>{formatInventoryQuantity(availableQuantity, row.unitType)} available</small>
        ) : null}
      </span>
      <span className={`logi-inv-tree-box-state is-${fullyReserved ? "reserved" : partiallyReserved ? "partial" : "available"}`}>
        <strong>{stateLabel}</strong>
        {ownerLabel ? <small title={ownerLabel}>{ownerLabel}</small> : null}
      </span>
      <span className="logi-inv-tree-box-actions">
        <button type="button" onClick={() => onEdit(row.entry)} aria-label={`Edit ${label}`}>Edit</button>
        <button type="button" onClick={() => onTransfer(row.entry)} aria-label={`Transfer ${label}`}>Transfer</button>
        <button type="button" className="is-delete" onClick={() => onDelete(row.entry)} aria-label={`Delete ${label}`}>Delete</button>
      </span>
    </div>
  );
}

function QualityFolder({
  folder,
  parentKey,
  expandedKeys,
  reservedByLotId,
  manageLocationId,
  selectedEntryIds,
  onToggleExpanded,
  onToggleSelect,
  onAdd,
  onEdit,
  onDelete,
  onTransfer,
}: {
  folder: InventoryQualityFolder;
  parentKey: string;
  expandedKeys: Set<string>;
  reservedByLotId: Map<string, ReservedLotInfo>;
  manageLocationId: string | null;
  selectedEntryIds: Set<string>;
  onToggleExpanded: (key: string) => void;
  onToggleSelect: (entryId: string) => void;
  onAdd: (context: InventoryAddContext) => void;
  onEdit: (entry: InventoryEntry) => void;
  onDelete: (entry: InventoryEntry) => void;
  onTransfer: (entry: InventoryEntry) => void;
}) {
  const key = `${parentKey}:quality:${folder.key}`;
  const open = expandedKeys.has(key);
  const first = folder.rows[0];
  const reservedCount = folder.rows.filter((row) => (reservedByLotId.get(row.id)?.quantity ?? 0) > 0).length;

  return (
    <section className="logi-inv-tree-quality">
      <div className="logi-inv-tree-quality-head">
        <button
          type="button"
          className="logi-inv-tree-disclosure"
          onClick={() => onToggleExpanded(key)}
          aria-expanded={open}
        >
          <Chevron />
          <span className={`logi-quality-pill ${qualityBadgeClass(first.entry)}`}>
            {folder.quality == null ? "Quality not recorded" : `Quality ${folder.quality}`}
          </span>
          <strong>{folder.rows.length} {folder.rows.length === 1 ? "record" : "records"}</strong>
          <span>{formatInventoryQuantity(folder.totalQuantity, folder.unitType)}</span>
          {reservedCount > 0 ? <span>{reservedCount} reserved</span> : null}
        </button>
        {first.entry.recordKind === "box" && first.entry.materialId ? (
          <button type="button" className="logi-inv-tree-add" onClick={() => onAdd(rowAddContext(first, folder.quality))}>
            + Add box
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="logi-inv-tree-boxes">
          <div className="logi-inv-tree-box-head" aria-hidden>
            {manageLocationId !== null ? <span /> : null}
            <span>Box</span>
            <span>Quantity</span>
            <span>Reservation</span>
            <span>Actions</span>
          </div>
          {folder.rows.map((row, index) => (
            <InventoryBoxRow
              key={row.id}
              row={row}
              index={index}
              reserve={reservedByLotId.get(row.id)}
              manageLocationId={manageLocationId}
              selected={selectedEntryIds.has(row.id)}
              onToggleSelect={onToggleSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              onTransfer={onTransfer}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SecondaryFolder({
  folder,
  parentKey,
  expandedKeys,
  reservedByLotId,
  manageLocationId,
  selectedEntryIds,
  onToggleExpanded,
  onStartManage,
  onToggleSelect,
  onAdd,
  onEdit,
  onDelete,
  onTransfer,
}: {
  folder: InventorySecondaryFolder;
  parentKey: string;
} & Omit<Props, "folders" | "presentation">) {
  const key = `${parentKey}:${folder.axis}:${folder.key}`;
  const open = expandedKeys.has(key);
  const first = folder.rows[0];
  const isLocation = folder.axis === "location";

  return (
    <section className="logi-inv-tree-secondary">
      <div className="logi-inv-tree-secondary-head">
        <button type="button" className="logi-inv-tree-disclosure" onClick={() => onToggleExpanded(key)} aria-expanded={open}>
          <Chevron />
          {!isLocation ? <MaterialIcon materialName={folder.label} size={17} /> : null}
          <strong>{folder.label}</strong>
          <span>{formatInventoryQuantity(folder.totalQuantity, folder.unitType)}</span>
          <span>{folder.rows.length} {folder.rows.length === 1 ? "record" : "records"}</span>
        </button>
        <div className="logi-inv-tree-folder-actions">
          {isLocation ? (
            <button type="button" onClick={() => onStartManage(first.locationKey)}>Select records</button>
          ) : null}
          {first.entry.materialId ? (
            <button type="button" className="logi-inv-tree-add" onClick={() => onAdd(rowAddContext(first))}>+ Add</button>
          ) : null}
        </div>
      </div>
      {open ? (
        <div className="logi-inv-tree-quality-list">
          {folder.qualityFolders.map((qualityFolder) => (
            <QualityFolder
              key={qualityFolder.key}
              folder={qualityFolder}
              parentKey={key}
              expandedKeys={expandedKeys}
              reservedByLotId={reservedByLotId}
              manageLocationId={manageLocationId}
              selectedEntryIds={selectedEntryIds}
              onToggleExpanded={onToggleExpanded}
              onToggleSelect={onToggleSelect}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
              onTransfer={onTransfer}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ListFolder({
  folder,
  ...props
}: { folder: InventoryPrimaryFolder } & Omit<Props, "folders" | "presentation">) {
  const key = `list:${folder.axis}:${folder.key}`;
  const open = props.expandedKeys.has(key);
  const rows = folder.rows.slice().sort((left, right) =>
    left.itemName.localeCompare(right.itemName) ||
    left.locationName.localeCompare(right.locationName) ||
    (right.quality ?? -1) - (left.quality ?? -1));

  return (
    <section className="logi-inv-list-folder">
      <div className="logi-inv-tree-primary-head">
        <button type="button" className="logi-inv-tree-disclosure" onClick={() => props.onToggleExpanded(key)} aria-expanded={open}>
          <Chevron />
          {folder.axis === "item" ? <MaterialIcon materialName={folder.label} size={18} /> : null}
          <strong>{folder.label}</strong>
          <span>{folderQuantityLabel(folder)}</span>
          <span>{folder.rows.length} {folder.rows.length === 1 ? "record" : "records"}</span>
        </button>
        {folder.axis === "location" ? (
          <button type="button" onClick={() => props.onStartManage(folder.rows[0].locationKey)}>Select records</button>
        ) : null}
      </div>
      {open ? (
        <div className="logi-inv-list-rows">
          {rows.map((row, index) => (
            <InventoryBoxRow
              key={row.id}
              row={row}
              index={index}
              contextLabel={`${folder.axis === "location" ? row.itemName : row.locationName} · ${row.quality == null ? "Quality not recorded" : `Quality ${row.quality}`}`}
              reserve={props.reservedByLotId.get(row.id)}
              manageLocationId={props.manageLocationId}
              selected={props.selectedEntryIds.has(row.id)}
              onToggleSelect={props.onToggleSelect}
              onEdit={props.onEdit}
              onDelete={props.onDelete}
              onTransfer={props.onTransfer}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function InventoryHierarchy({
  folders,
  presentation,
  ...props
}: Props) {
  if (folders.length === 0) {
    return <div className="logi-empty">No inventory records match the current filters.</div>;
  }

  if (presentation === "list") {
    return (
      <div className="logi-inv-list-folders">
        {folders.map((folder) => <ListFolder key={folder.key} folder={folder} {...props} />)}
      </div>
    );
  }

  return (
    <div className="logi-inv-tree">
      {folders.map((folder) => {
        const key = `${folder.axis}:${folder.key}`;
        const open = props.expandedKeys.has(key);
        const first = folder.rows[0];
        const isLocation = folder.axis === "location";
        return (
          <section key={folder.key} className="logi-inv-tree-primary">
            <div className="logi-inv-tree-primary-head">
              <button type="button" className="logi-inv-tree-disclosure" onClick={() => props.onToggleExpanded(key)} aria-expanded={open}>
                <Chevron />
                {!isLocation ? <MaterialIcon materialName={folder.label} size={20} /> : null}
                <strong>{folder.label}</strong>
                <span>{folderQuantityLabel(folder)}</span>
                <span>{folder.secondaryFolders.length} {isLocation ? "items" : "locations"}</span>
                <span>{folder.rows.length} {folder.rows.length === 1 ? "record" : "records"}</span>
              </button>
              <div className="logi-inv-tree-folder-actions">
                {isLocation ? (
                  <button type="button" onClick={() => props.onStartManage(first.locationKey)}>Select records</button>
                ) : null}
                <button
                  type="button"
                  className="logi-inv-tree-add"
                  onClick={() => props.onAdd(isLocation
                    ? { locationId: folder.locationId }
                    : {
                        materialId: first.entry.materialId,
                        displayName: first.itemName,
                      })}
                >
                  + Add
                </button>
              </div>
            </div>
            {open ? (
              <div className="logi-inv-tree-secondary-list">
                {folder.secondaryFolders.map((secondary) => (
                  <SecondaryFolder key={secondary.key} folder={secondary} parentKey={key} {...props} />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
