import type { InventoryEntry } from '../../types/logistics';

export type InventoryRecordPresentation = {
  isPhysicalBox: boolean;
  label: 'Physical box' | 'Aggregate stock';
  moveNoun: 'physical box' | 'aggregate stock record';
};

/** Only an explicit box record owns physical-container identity. */
export function getInventoryRecordPresentation(
  entry: Pick<InventoryEntry, 'recordKind'>,
): InventoryRecordPresentation {
  if (entry.recordKind === 'box') {
    return {
      isPhysicalBox: true,
      label: 'Physical box',
      moveNoun: 'physical box',
    };
  }

  return {
    isPhysicalBox: false,
    label: 'Aggregate stock',
    moveNoun: 'aggregate stock record',
  };
}

export function getInventoryTransferPresentation(entries: Array<Pick<InventoryEntry, 'recordKind'>>) {
  const physicalBoxCount = entries.filter((entry) => entry.recordKind === 'box').length;
  if (physicalBoxCount === entries.length) {
    return { title: 'Move physical boxes', selectionNoun: 'lot' } as const;
  }
  if (physicalBoxCount === 0) {
    return { title: 'Move aggregate stock', selectionNoun: 'record' } as const;
  }
  return { title: 'Move inventory records', selectionNoun: 'record' } as const;
}
