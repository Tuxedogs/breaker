import type { ComponentCardIndex, ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { formatMaterialDisplayName } from "@/lib/crafting/materialDisplayName";
import { buildResourceGroups } from "../../shared/msbResourceGroups";

export type RecipeBrowserMaterialOption = {
  value: string;
  label: string;
  count: number;
};

function materialMatches(record: ComponentCardIndexRecord, value: string, label: string): boolean {
  const normalizedLabel = label.toLowerCase();
  return (record.facets?.materials ?? []).includes(value)
    || (record.facets?.materialNames ?? []).some((name) => name.toLowerCase() === normalizedLabel);
}

export function buildRecipeBrowserMaterialOptions(
  materialFacets: ComponentCardIndex["facets"]["materials"] | undefined,
  records: ComponentCardIndexRecord[],
): RecipeBrowserMaterialOption[] {
  const byValue = new Map<string, { value: string; label: string }>();

  for (const material of materialFacets ?? []) {
    const value = material.value?.trim();
    const label = material.label?.trim();
    if (value && label) byValue.set(value, { value, label });
  }

  if (byValue.size === 0) {
    for (const record of records) {
      for (const material of record.materials ?? []) {
        const label = formatMaterialDisplayName(material.name);
        const value = (material.costId ?? material.materialId ?? label)?.trim();
        if (value && label && !byValue.has(value)) byValue.set(value, { value, label });
      }
    }
  }

  const countByValue = new Map<string, number>();
  for (const option of byValue.values()) {
    countByValue.set(
      option.value,
      records.reduce(
        (count, record) => count + (materialMatches(record, option.value, option.label) ? 1 : 0),
        0,
      ),
    );
  }

  const groups = buildResourceGroups(
    [...byValue.values()].map((option) => ({ id: option.value, label: option.label })),
  );
  return [
    ...groups.shipAndHarvestable,
    ...groups.vehicle,
    ...groups.hand,
  ].map((item) => ({
    value: item.id,
    label: item.label,
    count: countByValue.get(item.id) ?? 0,
  }));
}
