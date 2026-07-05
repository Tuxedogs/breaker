import { useMemo, useState } from 'react';
import type { InventoryEntry, InventoryLocation, MaterialTemplate } from '../../types/logistics';
import {
  formatInventoryQuantity,
  resolveInventoryItemName,
  resolveInventoryUnitType,
} from '../../lib/logistics/inventory';
import InventoryTransferLocationPicker from './InventoryTransferLocationPicker';

type MaterialSummaryLine = {
  id: string;
  materialName: string;
  totalLabel: string;
};

type Props = {
  selectedEntryIds: Set<string>;
  entries: InventoryEntry[];
  materials: MaterialTemplate[];
  sourceLocationId: string;
  locations: InventoryLocation[];
  onConfirm: (targetLocationId: string) => Promise<void>;
  onCancel: () => void;
};

function buildMaterialSummaryLines(
  selectedEntryIds: Set<string>,
  entries: InventoryEntry[],
  materials: MaterialTemplate[],
): MaterialSummaryLine[] {
  const materialById = new Map(materials.map((material) => [material.id, material]));
  const groups = new Map<string, { materialName: string; total: number; unitType: 'scu' | 'unit' }>();

  for (const entryId of selectedEntryIds) {
    const entry = entries.find((candidate) => candidate.id === entryId);
    if (!entry) continue;

    const material = entry.materialId ? materialById.get(entry.materialId) : undefined;
    const groupKey = entry.materialId ?? entry.itemName ?? entry.id;
    const materialName = resolveInventoryItemName(entry, material);
    const unitType = resolveInventoryUnitType(entry, material);
    const existing = groups.get(groupKey);

    if (existing) {
      existing.total += entry.quantity;
      continue;
    }

    groups.set(groupKey, { materialName, total: entry.quantity, unitType });
  }

  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      materialName: group.materialName,
      totalLabel: formatInventoryQuantity(group.total, group.unitType),
    }))
    .sort((a, b) => a.materialName.localeCompare(b.materialName));
}

function formatTransferError(error: unknown): string {
  const detail = error instanceof Error ? error.message.trim() : String(error).trim();
  if (!detail) return 'Transfer failed. Your inventory was not changed.';
  return `Transfer failed. Your inventory was not changed. ${detail}`;
}

export default function InventoryTransferDialog({
  selectedEntryIds,
  entries,
  materials,
  sourceLocationId,
  locations,
  onConfirm,
  onCancel,
}: Props) {
  const [targetLocationId, setTargetLocationId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const sourceName = locations.find((location) => location.id === sourceLocationId)?.name ?? 'Unknown location';
  const selectedCount = selectedEntryIds.size;
  const materialSummary = useMemo(
    () => buildMaterialSummaryLines(selectedEntryIds, entries, materials),
    [entries, materials, selectedEntryIds],
  );
  const visibleSummary = materialSummary.slice(0, 6);
  const hiddenSummaryCount = Math.max(0, materialSummary.length - visibleSummary.length);
  const canTransfer = Boolean(targetLocationId) && targetLocationId !== sourceLocationId && !isPending;

  async function handleTransfer() {
    if (!targetLocationId || isPending) return;
    if (targetLocationId === sourceLocationId) {
      setErrorMessage('Transfer failed. Your inventory was not changed. Source and target location must be different.');
      return;
    }

    setErrorMessage('');
    setIsPending(true);
    try {
      await onConfirm(targetLocationId);
    } catch (error) {
      setErrorMessage(formatTransferError(error));
    } finally {
      setIsPending(false);
    }
  }

  function handleCancel() {
    if (isPending) return;
    onCancel();
  }

  return (
    <>
      <div className="logi-inv-modal-overlay" onClick={handleCancel} aria-hidden />
      <div
        className="logi-inv-modal logi-inv-modal--transfer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inv-transfer-title"
        aria-describedby="inv-transfer-desc"
      >
        <div className="logi-inv-modal-head">
          <h2 id="inv-transfer-title">Transfer stacks</h2>
        </div>
        <div className="logi-inv-modal-body">
          <p id="inv-transfer-desc" className="logi-inv-transfer-lead">
            {selectedCount} lot{selectedCount === 1 ? '' : 's'} selected from <strong>{sourceName}</strong>
          </p>

          {visibleSummary.length > 0 ? (
            <ul className="logi-inv-transfer-summary" aria-label="Selected materials">
              {visibleSummary.map((line) => (
                <li key={line.id}>
                  <span className="logi-inv-transfer-summary-material">{line.materialName}</span>
                  <span className="logi-inv-transfer-summary-qty">{line.totalLabel}</span>
                </li>
              ))}
              {hiddenSummaryCount > 0 ? (
                <li className="logi-inv-transfer-summary-more">+{hiddenSummaryCount} more material{hiddenSummaryCount === 1 ? '' : 's'}</li>
              ) : null}
            </ul>
          ) : null}

          <InventoryTransferLocationPicker
            locations={locations}
            excludeLocationId={sourceLocationId}
            selectedLocationId={targetLocationId}
            onSelect={setTargetLocationId}
          />
        </div>
        <div className="logi-inv-modal-foot">
          {errorMessage ? (
            <p className="logi-inv-modal-error" role="alert">{errorMessage}</p>
          ) : null}
          <div className="logi-inv-modal-foot-actions">
            <button type="button" className="logi-inv-modal-btn logi-inv-modal-btn--ghost" onClick={handleCancel} disabled={isPending}>Cancel</button>
            <button
              type="button"
              className="logi-inv-modal-btn logi-inv-modal-btn--primary"
              disabled={!canTransfer}
              aria-busy={isPending}
              onClick={() => void handleTransfer()}
            >
              {isPending ? 'Transferring…' : 'Transfer'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
