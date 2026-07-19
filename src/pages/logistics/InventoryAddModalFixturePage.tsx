import { useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';

import InventoryAddModal from '../../components/logistics/InventoryAddModal';
import '../../components/logistics/logistics.css';
import '../../components/logistics/build-queue.css';
import { repairInventoryEntryIds } from '../../stores/logisticsStore';
import type { InventoryEntry } from '../../types/logistics';
import { buildQueueStatsFixture } from './buildQueueStatsFixture';

const fixtureTimestamp = '2026-07-16T12:00:00.000Z';

export default function InventoryAddModalFixturePage() {
  const nextId = useRef(1);
  const [emitted, setEmitted] = useState<InventoryEntry[]>([]);
  const reloaded = useMemo(
    () => repairInventoryEntryIds(emitted.map((entry) => ({ ...entry }))),
    [emitted],
  );
  const material = buildQueueStatsFixture.materials.find((entry) => entry.id === 'iron')
    ?? buildQueueStatsFixture.materials[0];
  const location = buildQueueStatsFixture.locations[0];

  if (!import.meta.env.DEV || !material || !location) {
    return <Navigate to="/logistics/build-queue" replace />;
  }

  return (
    <main className="bq-page" data-inventory-add-fixture="nested-boxes">
      <InventoryAddModal
        target={{ materialId: material.id, displayName: material.name, material }}
        materials={buildQueueStatsFixture.materials}
        locations={buildQueueStatsFixture.locations}
        onSave={setEmitted}
        onCancel={() => undefined}
        fixture={{
          locationId: location.id,
          qualityGroups: [
            { quality: '937', quantities: ['1.00', '0.74', '0.32'] },
            { quality: '860', quantities: ['0.80', '0.50', '0.20'] },
          ],
          createEntryId: () => `00000000-0000-4000-8000-${String(nextId.current++).padStart(12, '0')}`,
          timestamp: fixtureTimestamp,
          bypassFreshnessGuard: true,
          syncWarning: 'Inventory needs a fresh server sync before this action.',
        }}
      />
      <output hidden data-fixture-emitted={JSON.stringify(emitted)} data-fixture-reloaded={JSON.stringify(reloaded)} />
    </main>
  );
}
