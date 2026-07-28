import type { DetailStatRow } from "./craftingDetailStats";
import type { FittingComponentDetail } from "../fitting/fittingApi";

type DetailStatSubclusterDefinition = {
  title: string;
  labels: string[];
};

type DetailStatGroupDefinition =
  | { title: string; kind: "flat"; labels: string[] }
  | { title: string; kind: "nested"; subclusters: DetailStatSubclusterDefinition[] };

export type DetailStatSubcluster = {
  title: string;
  stats: DetailStatRow[];
};

export type DetailStatMatrixRow = {
  label: string;
  values: string[];
};

export type DetailStatGroup =
  | { title: string; kind: "flat"; stats: DetailStatRow[] }
  | { title: string; kind: "nested"; subclusters: DetailStatSubcluster[] }
  | { title: string; kind: "matrix"; columns: string[]; rows: DetailStatMatrixRow[] };

export const DETAIL_META_LABELS = new Set(
  [
    "Size",
    "Grade",
    "Class",
    "Craft Time",
    "Weapon Type",
    "Weapon Class",
    "Fire Mode",
    "Ammo Class",
    "Compatible Weapon Class",
    "Damage Type",
  ].map(normalizeDetailStatLabel),
);

const WEAPON_PERFORMANCE_STAT_GROUPS: DetailStatGroupDefinition[] = [
  {
    title: "Ballistics / Damage",
    kind: "nested",
    subclusters: [
      {
        title: "Damage Output",
        labels: [
          "Alpha Damage",
          "Theoretical DPS",
          "60s Sustained DPS",
          "Damage Over 60s",
          "DPS",
          "Physical Damage",
          "Energy Damage",
          "Distortion Damage",
          "Thermal Damage",
          "Biochemical Damage",
          "Stun Damage",
          "Fire Rate",
          "Burst Size",
          "Ammo Capacity",
          "Loaded Rounds",
          "Ballistic Reserve",
          "Energy Maximum Load",
          "Ammo Cost Per Shot",
          "Energy Cost Per Shot",
          "Energy Recharge Rate",
          "Recharge Cooldown",
          "Charge Time",
        ],
      },
      {
        title: "Projectile",
        labels: [
          "Projectile Speed",
          "Projectile Lifetime",
          "Projectile Range / Max Travel",
          "Projectile Max Travel",
          "Stated Range",
          "Hard Range",
          "Damage Falloff Start",
          "Damage Drop Per Meter",
          "Minimum Damage After Falloff",
          "Damage Falloff Range",
          "Damage Falloff Max",
        ],
      },
      {
        title: "Penetration",
        labels: [
          "Penetration",
          "Penetration Distance",
          "Penetration Near Radius",
          "Penetration Far Radius",
          "Impulse Falloff Start",
          "Impulse Drop Falloff",
          "Impulse Maximum Falloff",
        ],
      },
      {
        title: "Spread",
        labels: [
          "Spread Min–Max",
          "Spread First Attack",
          "Spread Per Attack",
          "Spread Decay",
        ],
      },
      {
        title: "Handling",
        labels: [
          "Recoil Smoothness",
          "Recoil Handling",
          "Recoil Kick",
          "Weapon Recoil Smoothness",
          "Weapon Recoil Handling",
          "Weapon Recoil Kick",
        ],
      },
    ],
  },
  {
    title: "Thermal / Power",
    kind: "flat",
    labels: [
      "Heat Per Shot",
      "Heat Generation",
      "Heat Capacity",
      "Cooling Rate",
      "Cooling Delay",
      "Overheat Recovery",
      "Minimum Temperature",
      "Overheat Temperature",
      "Post-Overheat Temperature",
      "Wear Per Shot",
      "Power",
      "Power Maximum",
      "Power Minimum (derived)",
      "Power Draw",
      "Cooling Draw",
      "Coolant",
    ],
  },
  {
    title: "Signature / Detection",
    kind: "flat",
    labels: [
      "Online EM",
      "Online IR",
      "Firing EM",
      "Firing IR",
      "EM Signature",
      "IR Signature",
      "EM Maximum",
      "EM Decay Rate",
      "Distortion Maximum",
      "Distortion Resistance",
    ],
  },
  {
    title: "Repair",
    kind: "flat",
    labels: [
      "Self-Repair Uses",
      "Self-Repair Cycle",
      "Self-Repair Health Ratio",
      "Baseline HP Restored (derived)",
      "Repair Restore Ratio",
    ],
  },
  {
    title: "Durability / Physical",
    kind: "flat",
    labels: ["Component HP", "Health", "Mass"],
  },
];

const SHIELD_STAT_GROUPS: DetailStatGroupDefinition[] = [
  {
    title: "Shield Performance",
    kind: "flat",
    labels: ["Shield HP", "Regen Rate", "Regen Delay", "Downed Regen Delay", "Regen by Power"],
  },
  { title: "Power & Thermal", kind: "flat", labels: ["Power", "Power Maximum", "Power Minimum (derived)", "Power Draw", "Cooling Draw", "Heat Generation"] },
  { title: "Signatures", kind: "flat", labels: ["Online EM", "Online IR", "EM Signature", "IR Signature", "EM Maximum", "EM Decay Rate", "Distortion Maximum"] },
  { title: "Repair", kind: "flat", labels: ["Self-Repair Uses", "Self-Repair Cycle", "Self-Repair Health Ratio", "Baseline HP Restored (derived)", "Repair Restore Ratio"] },
  { title: "Durability / Physical", kind: "flat", labels: ["Component HP", "Health", "Mass", "Volume"] },
];

const RESOURCE_STAT_GROUPS: DetailStatGroupDefinition[] = [
  {
    title: "Output",
    kind: "flat",
    labels: [
      "Power Generation",
      "Coolant Generation",
      "Thermal Equalization Rate",
      "Cooling by Power",
    ],
  },
  { title: "Power & Thermal", kind: "flat", labels: ["Power", "Power Maximum", "Power Minimum (derived)", "Power Draw", "Cooling Draw", "Heat Generation"] },
  { title: "Signatures", kind: "flat", labels: ["Online EM", "Online IR", "EM Signature", "IR Signature", "EM Maximum", "EM Decay Rate", "Distortion Maximum"] },
  { title: "Repair", kind: "flat", labels: ["Self-Repair Uses", "Self-Repair Cycle", "Self-Repair Health Ratio", "Baseline HP Restored (derived)", "Repair Restore Ratio"] },
  { title: "Durability / Physical", kind: "flat", labels: ["Component HP", "Health", "Mass", "Volume"] },
];

const QUANTUM_STAT_GROUPS: DetailStatGroupDefinition[] = [
  {
    title: "Quantum Travel",
    kind: "flat",
    labels: [
      "Quantum Speed",
      "Spool Time",
      "Cooldown",
      "Fuel Requirement",
      "Calibration Delay",
      "Calibration Rate",
      "Calibration Minimum",
      "Calibration Maximum",
      "Calibration Time (derived)",
      "Stage One Acceleration",
      "Stage Two Acceleration",
    ],
  },
  { title: "Power & Thermal", kind: "flat", labels: ["Power", "Power Maximum", "Power Minimum (derived)", "Power Draw", "Cooling Draw", "Heat Generation"] },
  { title: "Signatures", kind: "flat", labels: ["Online EM", "Online IR", "EM Signature", "IR Signature", "EM Maximum", "EM Decay Rate", "Distortion Maximum"] },
  { title: "Repair", kind: "flat", labels: ["Self-Repair Uses", "Self-Repair Cycle", "Self-Repair Health Ratio", "Baseline HP Restored (derived)", "Repair Restore Ratio"] },
  { title: "Durability / Physical", kind: "flat", labels: ["Component HP", "Health", "Mass", "Volume"] },
];

const RADAR_STAT_GROUPS: DetailStatGroupDefinition[] = [
  { title: "Radar Performance", kind: "flat", labels: ["Detection Range", "Scan Range", "Scan Rate", "Scan Cooldown", "Signature Sensitivity"] },
  { title: "Power & Thermal", kind: "flat", labels: ["Power", "Power Maximum", "Power Minimum (derived)", "Power Draw", "Cooling Draw", "Heat Generation"] },
  { title: "Signatures", kind: "flat", labels: ["Online EM", "Online IR", "EM Signature", "IR Signature", "EM Maximum", "EM Decay Rate", "Distortion Maximum"] },
  { title: "Repair", kind: "flat", labels: ["Self-Repair Uses", "Self-Repair Cycle", "Self-Repair Health Ratio", "Baseline HP Restored (derived)", "Repair Restore Ratio"] },
  { title: "Durability / Physical", kind: "flat", labels: ["Component HP", "Health", "Mass", "Volume"] },
];

const TOOL_STAT_GROUPS: DetailStatGroupDefinition[] = [
  {
    title: "Tool Output",
    kind: "flat",
    labels: [
      "Mining Power",
      "Extraction Power",
      "Instability Modifier",
      "Resistance Modifier",
      "Fracture Window",
      "Material Efficiency",
      "Max Health Repair Rate",
      "Max Damage Map Repair Rate",
      "Hull Scraping Speed Modifier",
      "Hull Scraping Radius Modifier",
      "Hull Scraping Efficiency Modifier",
      "Fuel Transfer Rate",
      "Quantum Fuel Transfer Rate",
    ],
  },
  {
    title: "Beam / Range",
    kind: "flat",
    labels: [
      "Laser Range",
      "Beam Range",
      "Tractor Max Force",
      "Tractor Max Distance",
      "Tractor Full Strength Distance",
      "Capture Radius",
      "Throttle Minimum",
      "Wear Rate",
    ],
  },
  { title: "Power & Thermal", kind: "flat", labels: ["Power", "Power Maximum", "Power Minimum (derived)", "Power Draw", "Cooling Draw", "Heat Generation"] },
  { title: "Signatures", kind: "flat", labels: ["Online EM", "Online IR", "EM Signature", "IR Signature", "EM Maximum", "EM Decay Rate", "Distortion Maximum"] },
  { title: "Repair", kind: "flat", labels: ["Self-Repair Uses", "Self-Repair Cycle", "Self-Repair Health Ratio", "Baseline HP Restored (derived)", "Repair Restore Ratio"] },
  { title: "Durability / Physical", kind: "flat", labels: ["Component HP", "Health", "Mass", "Volume"] },
];

const FPS_ARMOR_STAT_GROUPS: DetailStatGroupDefinition[] = [
  {
    title: "Identity",
    kind: "flat",
    labels: ["Armor Slot", "Armor Weight"],
  },
  {
    title: "Protection",
    kind: "flat",
    labels: ["Armor Damage Mitigation", "Armor DamageMitigation", "Damage Mitigation"],
  },
  {
    title: "Environment",
    kind: "flat",
    labels: ["Temp Range", "Temp Min", "Temp Max", "Radiation Dissipation", "Storage"],
  },
  {
    title: "Durability / Physical",
    kind: "flat",
    labels: ["Mass", "Health"],
  },
];

const MATRIX_SOURCE_LABELS = new Set([
  "Physical Resistance",
  "Energy Absorption",
  "Physical Res",
  "Energy Res",
  "Distortion Res",
  "Thermal Res",
  "Biochemical Res",
  "Stun Res",
].map(normalizeDetailStatLabel));
const DAMAGE_TYPE_ORDER = ["physical", "energy", "distortion", "thermal", "biochemical", "stun"] as const;

export function normalizeDetailStatLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function readFinite(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatDamageTypeValue(value: { value?: number | null; min?: number | null; max?: number | null } | null | undefined): string | null {
  if (!value) return null;
  const exact = readFinite(value.value ?? undefined);
  const min = readFinite(value.min ?? undefined);
  const max = readFinite(value.max ?? undefined);
  const formatPart = (part: number) => {
    if (Math.abs(part) <= 1) return `${formatNumber(part * 100)}%`;
    return formatNumber(part);
  };

  if (exact !== undefined) return formatPart(exact);
  if (min !== undefined && max !== undefined) {
    return min === max ? formatPart(min) : `${formatPart(min)}-${formatPart(max)}`;
  }
  return null;
}

function buildShieldMitigationMatrix(detail: FittingComponentDetail): DetailStatGroup | null {
  if (detail.mitigation?.kind !== "shield") return null;

  const resistance = detail.mitigation.resistanceByDamageType;
  const absorption = detail.mitigation.absorptionByDamageType;
  const rows = DAMAGE_TYPE_ORDER.flatMap<DetailStatMatrixRow>((type) => {
    const resistanceValue = formatDamageTypeValue(resistance?.[type]);
    const absorptionValue = formatDamageTypeValue(absorption?.[type]);
    if (!resistanceValue && !absorptionValue) return [];
    return [{
      label: titleCase(type),
      values: [resistanceValue ?? "-", absorptionValue ?? "-"],
    }];
  });

  if (rows.length === 0) return null;
  return { title: "Resistance / Absorption", kind: "matrix", columns: ["Resistance", "Absorption"], rows };
}

function buildArmorResistanceMatrix(detail: FittingComponentDetail): DetailStatGroup | null {
  if (detail.mitigation?.kind !== "armor") return null;

  const resistance = detail.mitigation.resistanceByDamageType;
  const rows = DAMAGE_TYPE_ORDER.flatMap<DetailStatMatrixRow>((type) => {
    const resistanceValue = formatDamageTypeValue(resistance?.[type]);
    if (!resistanceValue) return [];
    return [{
      label: titleCase(type),
      values: [resistanceValue],
    }];
  });

  if (rows.length === 0) return null;
  return { title: "Damage Taken Multipliers", kind: "matrix", columns: ["Multiplier"], rows };
}

export function normalizeWeaponPerformanceDisplayStats(stats: DetailStatRow[]): DetailStatRow[] {
  const healthKey = normalizeDetailStatLabel("Health");
  const componentHpKey = normalizeDetailStatLabel("Component HP");
  const healthRow = stats.find((row) => normalizeDetailStatLabel(row.label) === healthKey);

  if (!healthRow) return stats;

  return stats
    .filter((row) => normalizeDetailStatLabel(row.label) !== componentHpKey)
    .map((row) =>
      normalizeDetailStatLabel(row.label) === healthKey
        ? { ...healthRow, label: "Component HP" }
        : row,
    );
}

function collectGroupStats(
  labels: string[],
  rowByLabel: Map<string, DetailStatRow>,
  used: Set<string>,
): DetailStatRow[] {
  return labels.flatMap((label) => {
    const key = normalizeDetailStatLabel(label);
    if (used.has(key)) return [];
    const row = rowByLabel.get(key);
    if (!row) return [];
    used.add(key);
    return [row];
  });
}

function groupsFromDefinitions(
  definitions: DetailStatGroupDefinition[],
  rowByLabel: Map<string, DetailStatRow>,
  used: Set<string>,
): DetailStatGroup[] {
  const groups: DetailStatGroup[] = [];

  for (const definition of definitions) {
    if (definition.kind === "nested") {
      const subclusters = definition.subclusters
        .map((subcluster) => ({
          title: subcluster.title,
          stats: collectGroupStats(subcluster.labels, rowByLabel, used),
        }))
        .filter((subcluster) => subcluster.stats.length > 0);

      if (subclusters.length > 0) {
        groups.push({ title: definition.title, kind: "nested", subclusters });
      }
      continue;
    }

    const stats = collectGroupStats(definition.labels, rowByLabel, used);
    if (stats.length > 0) groups.push({ title: definition.title, kind: "flat", stats });
  }

  return groups;
}

const COMPARISON_LABEL_ALIASES: Record<string, string> = {
  quantumfuelreq: "fuelrequirement",
  health: "componenthp",
  powergeneration: "powergeneration",
  coolantgeneration: "coolantgeneration",
  aimassistmaxrange: "detectionrange",
  aimassistminrange: "detectionrange",
};

export function findDetailStatGroupTitle(
  detail: FittingComponentDetail,
  label: string,
): string | null {
  const normalized = normalizeDetailStatLabel(label);
  const aliasKey = COMPARISON_LABEL_ALIASES[normalized];
  const candidates = aliasKey
    ? [normalized, aliasKey]
    : [normalized];
  const definitions = definitionsForDetail(detail);

  for (const candidate of candidates) {
    for (const definition of definitions) {
      if (definition.kind === "nested") {
        for (const subcluster of definition.subclusters) {
          if (subcluster.labels.some((entry) => normalizeDetailStatLabel(entry) === candidate)) {
            return subcluster.title;
          }
        }
        continue;
      }

      if (definition.labels.some((entry) => normalizeDetailStatLabel(entry) === candidate)) {
        return definition.title;
      }
    }
  }

  return null;
}

function definitionsForDetail(detail: FittingComponentDetail): DetailStatGroupDefinition[] {
  switch (detail.type) {
    case "ship_weapon":
    case "fps_weapon":
    case "fps_ammo":
      return WEAPON_PERFORMANCE_STAT_GROUPS;
    case "fps_armor":
      return FPS_ARMOR_STAT_GROUPS;
    case "shield":
      return SHIELD_STAT_GROUPS;
    case "cooler":
    case "power_plant":
      return RESOURCE_STAT_GROUPS;
    case "quantum_drive":
      return QUANTUM_STAT_GROUPS;
    case "radar":
      return RADAR_STAT_GROUPS;
    case "mining_laser":
    case "salvage_head":
    case "salvage_modifier":
    case "fuel_nozzle":
      return TOOL_STAT_GROUPS;
    default:
      return [];
  }
}

export function groupWeaponPerformanceStats(stats: DetailStatRow[]): DetailStatGroup[] {
  const displayStats = normalizeWeaponPerformanceDisplayStats(stats);
  const rowByLabel = new Map(displayStats.map((row) => [normalizeDetailStatLabel(row.label), row] as const));
  const used = new Set<string>();
  const groups = groupsFromDefinitions(WEAPON_PERFORMANCE_STAT_GROUPS, rowByLabel, used);

  const actionSuffixes = [
    "pelletcount",
    "damagemultiplier",
    "heatpersecond",
    "actiondps",
    "chargetime",
    "chargeup",
    "chargedown",
    "cooldown",
    "spinup",
    "spindown",
    "firesduringspinup",
    "fulldamagerange",
    "zerodamagerange",
  ];
  const actionStats = displayStats.filter((row) => {
    const key = normalizeDetailStatLabel(row.label);
    if (used.has(key)) return false;
    if (!actionSuffixes.some((suffix) => key.endsWith(suffix))) return false;
    used.add(key);
    return true;
  });
  if (actionStats.length > 0) {
    groups.push({ title: "Fire Actions", kind: "flat", stats: actionStats });
  }

  const remaining = displayStats.filter((row) => {
    const key = normalizeDetailStatLabel(row.label);
    if (used.has(key) || DETAIL_META_LABELS.has(key)) return false;
    used.add(key);
    return true;
  });

  if (remaining.length > 0) groups.push({ title: "Additional", kind: "flat", stats: remaining });
  return groups;
}

export function buildDetailStatGroups(
  detail: FittingComponentDetail,
  stats: DetailStatRow[],
): DetailStatGroup[] {
  if (detail.type === "ship_weapon" || detail.type === "fps_weapon" || detail.type === "fps_ammo") {
    return groupWeaponPerformanceStats(stats);
  }

  const displayStats = stats.filter((row) => !DETAIL_META_LABELS.has(normalizeDetailStatLabel(row.label)));
  const rowByLabel = new Map(displayStats.map((row) => [normalizeDetailStatLabel(row.label), row] as const));
  const used = new Set<string>();
  const groups: DetailStatGroup[] = [];
  const definitions = definitionsForDetail(detail);

  if (detail.type === "shield") {
    groups.push(...groupsFromDefinitions(definitions.slice(0, 1), rowByLabel, used));
    const matrix = buildShieldMitigationMatrix(detail);
    if (matrix) {
      groups.push(matrix);
      for (const key of MATRIX_SOURCE_LABELS) used.add(key);
    }
    groups.push(...groupsFromDefinitions(definitions.slice(1), rowByLabel, used));
  } else if (detail.type === "fps_armor") {
    const identity = groupsFromDefinitions(definitions.slice(0, 1), rowByLabel, used);
    groups.push(...identity);
    const matrix = buildArmorResistanceMatrix(detail);
    if (matrix) {
      groups.push(matrix);
      for (const key of MATRIX_SOURCE_LABELS) used.add(key);
    }
    groups.push(...groupsFromDefinitions(definitions.slice(1), rowByLabel, used));
  } else {
    groups.push(...groupsFromDefinitions(definitions, rowByLabel, used));
  }

  const remaining = displayStats.filter((row) => {
    const key = normalizeDetailStatLabel(row.label);
    if (used.has(key) || DETAIL_META_LABELS.has(key)) return false;
    used.add(key);
    return true;
  });

  if (remaining.length > 0) groups.push({ title: "Additional", kind: "flat", stats: remaining });
  return groups;
}
