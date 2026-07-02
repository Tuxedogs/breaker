import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { buildComponentCardSchemaFromIndex } from "../industry/crafting/utils/componentCardSchema";

export type BuildQueueStatGroup = {
  id: string;
  label: string;
  rows: { label: string; value: string }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStatsObject(record: ComponentCardIndexRecord, key: string): Record<string, unknown> | null {
  const stats = record.stats as unknown;
  if (!isRecord(stats)) return null;
  const value = stats[key];
  return isRecord(value) ? value : null;
}

function asNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value);
}

function formatCompact(value: unknown, suffix = ""): string | null {
  const number = asNumber(value);
  if (number === null) return null;
  return `${formatNumber(number)}${suffix}`;
}

function formatRange(value: unknown, suffix = ""): string | null {
  if (!isRecord(value)) return null;
  const min = asNumber(value.min);
  const max = asNumber(value.max);
  if (min === null || max === null) return null;
  return min === max ? `${formatNumber(min)}${suffix}` : `${formatNumber(min)}-${formatNumber(max)}${suffix}`;
}

function formatPair(minValue: unknown, maxValue: unknown, suffix = ""): string | null {
  const min = asNumber(minValue);
  const max = asNumber(maxValue);
  if (min === null && max === null) return null;
  if (min !== null && max !== null && min !== max) return `${formatNumber(min)}-${formatNumber(max)}${suffix}`;
  return `${formatNumber(max ?? min ?? 0)}${suffix}`;
}

function pushRow(rows: { label: string; value: string }[], label: string, value: string | null) {
  if (value) rows.push({ label, value });
}

function buildShieldGroups(record: ComponentCardIndexRecord): BuildQueueStatGroup[] {
  const shield = getStatsObject(record, "shield");
  const generic = getStatsObject(record, "generic");
  const defense: { label: string; value: string }[] = [];
  const signatures: { label: string; value: string }[] = [];
  const powerHeat: { label: string; value: string }[] = [];
  const specifications: { label: string; value: string }[] = [];
  const additional: { label: string; value: string }[] = [];

  pushRow(defense, "Health", formatCompact(generic?.health));
  pushRow(defense, "Shield HP", formatCompact(shield?.maxShieldHealth));
  pushRow(defense, "Regen Delay", formatCompact(shield?.damageRegenDelay, "s"));
  pushRow(defense, "Regen Rate", formatCompact(shield?.regenRate, "/s"));
  pushRow(defense, "Physical Resistance", formatRange(shield?.physicalResistance));
  pushRow(defense, "Energy Absorption", formatRange(shield?.physicalAbsorption));
  pushRow(defense, "Distortion Resistance", formatRange(shield?.distortionResistance));

  pushRow(signatures, "EM Signature", formatCompact(generic?.onlineEmSignature ?? generic?.emSignature));
  pushRow(signatures, "IR Signature", formatCompact(generic?.onlineIrSignature ?? generic?.irSignature));

  pushRow(powerHeat, "Power Draw", formatPair(shield?.powerUsageMin, shield?.powerUsageMax));
  pushRow(powerHeat, "Heat Generation", formatCompact(generic?.heatGeneration));

  if (record.size !== null) pushRow(specifications, "Size", `S${record.size}`);
  pushRow(specifications, "Class", record.class ? record.class : null);
  pushRow(specifications, "Grade", record.grade);
  pushRow(specifications, "Integrity", formatCompact(generic?.integrity));
  pushRow(specifications, "Mass", formatCompact(generic?.mass));
  pushRow(specifications, "Volume", formatCompact(generic?.volume));

  pushRow(additional, "Coverage", formatCompact(shield?.coverage));
  pushRow(additional, "Shield Type", typeof shield?.shieldType === "string" ? shield.shieldType : null);
  pushRow(additional, "Recharge Mode", typeof shield?.rechargeType === "string" ? shield.rechargeType : null);
  pushRow(additional, "Facing", typeof shield?.facing === "string" ? shield.facing : null);
  pushRow(additional, "Mount", typeof shield?.mount === "string" ? shield.mount : null);

  return [
    { id: "defense", label: "Defense", rows: defense },
    { id: "signatures", label: "Signatures", rows: signatures },
    { id: "power", label: "Power & Heat", rows: powerHeat },
    { id: "specs", label: "Specifications", rows: specifications },
    { id: "additional", label: "Additional", rows: additional },
  ].filter((group) => group.rows.length > 0);
}

export function buildQueueStatGroups(record: ComponentCardIndexRecord | undefined): BuildQueueStatGroup[] {
  if (!record) return [];

  if (record.type === "shield") {
    return buildShieldGroups(record);
  }

  const schema = buildComponentCardSchemaFromIndex(record, { preserveDisplayName: true });
  const combined = [...schema.meta, ...schema.genericStats, ...schema.familyStats];
  if (combined.length === 0) return [];

  return [{
    id: "stats",
    label: `${record.typeLabel} Stats`,
    rows: combined.map((row) => ({ label: row.label, value: row.value })),
  }];
}
