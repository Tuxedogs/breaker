import type { EquipmentRowView } from "../../../lib/fitting/mockup/fittingMockupViewTypes";

type FittingEquipmentRowProps = {
  row: EquipmentRowView;
  onSelect: (id: string) => void;
};

export default function FittingEquipmentRow({ row, onSelect }: FittingEquipmentRowProps) {
  return (
    <article
      className={["fm-equip-row", `is-tone-${row.tone}`, row.selected ? "is-selected" : ""].filter(Boolean).join(" ")}
    >
      <span className="fm-equip-accent" aria-hidden />
      <div className="fm-equip-icon" aria-hidden>
        <img src={row.iconSrc} alt="" draggable={false} />
      </div>
      <span className="fm-equip-qty">{row.quantity}</span>
      <button type="button" className="fm-equip-body" onClick={() => onSelect(row.id)}>
        <strong className="fm-equip-title">{row.title}</strong>
        {row.subtitle ? <span className="fm-equip-sub">{row.subtitle}</span> : null}
      </button>
      {row.tag ? <span className="fm-equip-tag">{row.tag}</span> : null}
    </article>
  );
}
