import type { BuildQueueItem, BuildStatus, ItemCategory } from '../../data/models';

interface Props {
  category: ItemCategory;
  items: BuildQueueItem[];
}

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  component: 'Component',
  weapon:    'Weapon',
  armor:     'Armor',
  consumable: 'Consumable',
  ship_part: 'Ship Part',
  other:     'Other',
};

const STATUS_CLASS: Record<BuildStatus, string> = {
  queued:      'logi-badge--queued',
  in_progress: 'logi-badge--in-progress',
  paused:      'logi-badge--paused',
  complete:    'logi-badge--complete',
  cancelled:   'logi-badge--cancelled',
};

const STATUS_LABELS: Record<BuildStatus, string> = {
  queued:      'Queued',
  in_progress: 'In Progress',
  paused:      'Paused',
  complete:    'Complete',
  cancelled:   'Cancelled',
};

export default function BuildQueueGroup({ category, items }: Props) {
  return (
    <div className="logi-bq-group">
      <div className="logi-bq-group-header">
        <span className="logi-bq-group-label">{CATEGORY_LABELS[category]}</span>
        <span className="logi-bq-group-count">{items.length}</span>
      </div>
      {items.map((item) => (
        <div key={item.id} className="logi-bq-item">
          <div className="logi-bq-priority" aria-label={`Priority ${item.priority}`}>
            {item.priority}
          </div>
          <div className="logi-bq-item-name">{item.itemName}</div>
          <div className="logi-bq-item-qty">{item.quantity}×</div>
          <span className={`logi-badge ${STATUS_CLASS[item.status]}`}>
            {STATUS_LABELS[item.status]}
          </span>
        </div>
      ))}
    </div>
  );
}
