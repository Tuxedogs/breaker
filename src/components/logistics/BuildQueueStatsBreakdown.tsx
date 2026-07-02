import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { getComponentCardIndex } from "@/lib/componentCardIndexApi";
import { buildQueueStatGroups } from "./buildQueueStatsGroups";

interface Props {
  blueprintId?: string;
  itemId?: string;
  recipeId: string;
}

function findComponentCard(
  records: ComponentCardIndexRecord[],
  blueprintId?: string,
  itemId?: string,
): ComponentCardIndexRecord | undefined {
  const normalizedBlueprint = blueprintId?.trim().toLowerCase();
  const normalizedItem = itemId?.trim().toLowerCase();
  return records.find((record) => {
    const recordId = record.id.trim().toLowerCase();
    return (normalizedBlueprint && recordId === normalizedBlueprint)
      || (normalizedItem && recordId === normalizedItem);
  });
}

export default function BuildQueueStatsBreakdown({ blueprintId, itemId, recipeId }: Props) {
  const [record, setRecord] = useState<ComponentCardIndexRecord | undefined>();

  useEffect(() => {
    let cancelled = false;
    getComponentCardIndex()
      .then((index) => {
        if (cancelled) return;
        setRecord(findComponentCard(index.records, blueprintId, itemId));
      })
      .catch(() => {
        if (!cancelled) setRecord(undefined);
      });
    return () => { cancelled = true; };
  }, [blueprintId, itemId]);

  const groups = buildQueueStatGroups(record);

  return (
    <section className="bq-stats-breakdown" aria-label="Stats breakdown">
      <header className="bq-stats-breakdown-head">
        <h3>Stats Breakdown</h3>
        <Link className="bq-stats-breakdown-link" to={`/industry/crafting?recipe=${encodeURIComponent(recipeId)}`}>
          View in Planner
        </Link>
      </header>
      {groups.length === 0 ? (
        <p className="bq-stats-breakdown-empty">No indexed stat sheet available for this item.</p>
      ) : (
        <div className="bq-stats-breakdown-grid">
          {groups.map((group) => (
            <div className="bq-stats-breakdown-group" key={group.id}>
              <h4>{group.label}</h4>
              <dl className="bq-stats-breakdown-rows">
                {group.rows.map((row) => (
                  <div className="bq-stats-breakdown-row" key={`${group.id}:${row.label}`}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
