import type { StaticLocationMaterialRow } from "../features/mining/staticMiningIndex";
import { canonicalMiningMaterialKey } from "../features/mining/materialIdentity";

export type SignatureLocationSource = {
  id: string;
  label: string;
  shortLabel: string;
  system: string;
  parentLocation: string;
  locationType: "moon" | "planet" | "asteroid_group" | string;
  materialKeys: string[];
  enabled: boolean;
};

export type SignaturePreset = {
  id: string;
  label: string;
  shortLabel: string;
  system: string;
  presetType: "location" | string;
  sourceLocationIds: string[];
  sortOrder: number;
  enabled: boolean;
};

export type SignaturePresetGroup = {
  id: string;
  label: string;
  system: string;
  presetIds: string[];
};

export type SignaturePresetCatalog = {
  locationSources: SignatureLocationSource[];
  presets: SignaturePreset[];
  presetGroups: SignaturePresetGroup[];
  locationSourceById: Map<string, SignatureLocationSource>;
  presetById: Map<string, SignaturePreset>;
};

export const SIGNATURE_LOCATION_SOURCES: SignatureLocationSource[] = [
  {
    id: "stanton.crusader.daymar",
    label: "Daymar",
    shortLabel: "Daymar",
    system: "stanton",
    parentLocation: "Crusader",
    locationType: "moon",
    materialKeys: [
      "agricium",
      "aphorite",
      "beradom",
      "dolivine",
      "feynmaline",
      "glacosite",
      "hadanite",
      "quantanium",
      "quartz",
      "silicon",
    ],
    enabled: true,
  },
];

export const SIGNATURE_PRESETS: SignaturePreset[] = [
  {
    id: "daymar",
    label: "Daymar",
    shortLabel: "Daymar",
    system: "stanton",
    presetType: "location",
    sourceLocationIds: ["stanton.crusader.daymar"],
    sortOrder: 10,
    enabled: true,
  },
];

export const SIGNATURE_PRESET_GROUPS: SignaturePresetGroup[] = [
  {
    id: "stanton-moons",
    label: "Stanton Moons",
    system: "stanton",
    presetIds: ["daymar"],
  },
];

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function normalizeSystem(value: string): string {
  return value.trim().toLowerCase() || "unknown";
}

function locationTypeFromRows(rows: StaticLocationMaterialRow[]): string {
  const location = rows[0]?.locationDisplayName ?? rows[0]?.location ?? "";
  const normalized = location.toLowerCase();
  if (normalized.includes("ring")) return "ring";
  if (normalized.includes("belt")) return "belt";
  if (normalized.includes("lagrange")) return "lagrange";
  if (normalized.includes("asteroid")) return "asteroid_group";
  if (normalized.includes("deep space")) return "deep_space";
  if (rows.some((row) => row.resolvedMineableClass === "Orbitborne")) return "space";
  if (rows.some((row) => row.resolvedMineableClass === "Shipborne")) return "surface";
  return "location";
}

function groupLabel(system: string, locationType: string): string {
  switch (locationType) {
    case "ring":
    case "belt":
    case "lagrange":
    case "asteroid_group":
    case "deep_space":
    case "space":
      return `${system} Space`;
    case "surface":
      return `${system} Bodies`;
    default:
      return `${system} Locations`;
  }
}

function signatureMaterialKeysFromRow(row: StaticLocationMaterialRow): string[] {
  const materialKey = canonicalMiningMaterialKey(row.sources?.[0]?.materialKey ?? row.materialId ?? row.materialName);
  const keys = new Set<string>();
  if (materialKey) keys.add(materialKey);
  if (materialKey === "aluminum") keys.add("aluminium");
  if (materialKey === "pressurizedice") keys.add("ice");
  if (row.resolvedMineableClass === "Handborne") keys.add("fpsmineables");
  if (row.resolvedMineableClass === "Geoborne") keys.add("rocmineables");
  return [...keys];
}

function createSignaturePresetCatalog(
  locationSources: SignatureLocationSource[],
  presets: SignaturePreset[],
  presetGroups: SignaturePresetGroup[],
): SignaturePresetCatalog {
  return {
    locationSources,
    presets,
    presetGroups,
    locationSourceById: new Map(locationSources.map((source) => [source.id, source])),
    presetById: new Map(presets.map((preset) => [preset.id, preset])),
  };
}

export const DEFAULT_SIGNATURE_PRESET_CATALOG = createSignaturePresetCatalog(
  SIGNATURE_LOCATION_SOURCES,
  SIGNATURE_PRESETS,
  SIGNATURE_PRESET_GROUPS,
);

export const signaturePresetById = DEFAULT_SIGNATURE_PRESET_CATALOG.presetById;

export function buildSignaturePresetCatalog(rows: StaticLocationMaterialRow[]): SignaturePresetCatalog {
  const rowsByLocation = new Map<string, StaticLocationMaterialRow[]>();
  for (const row of rows) {
    const system = row.systemDisplayName || row.system || row.systemKey || "Unknown";
    const location = row.locationDisplayName || row.location || row.locationKey || "Unknown Location";
    const key = `${normalizeSystem(system)}::${location.trim().toLowerCase()}`;
    const locationRows = rowsByLocation.get(key) ?? [];
    locationRows.push(row);
    rowsByLocation.set(key, locationRows);
  }

  const locationGroups = [...rowsByLocation.values()]
    .map((locationRows) => {
      const first = locationRows[0];
      const system = first.systemDisplayName || first.system || first.systemKey || "Unknown";
      const location = first.locationDisplayName || first.location || first.locationKey || "Unknown Location";
      return { system, location, rows: locationRows };
    })
    .sort((left, right) =>
      left.system.localeCompare(right.system) || left.location.localeCompare(right.location)
    );

  const slugCounts = new Map<string, number>();
  for (const group of locationGroups) {
    const locationSlug = slug(group.location);
    slugCounts.set(locationSlug, (slugCounts.get(locationSlug) ?? 0) + 1);
  }

  const locationSources: SignatureLocationSource[] = [];
  const presets: SignaturePreset[] = [];
  const presetGroupsById = new Map<string, SignaturePresetGroup>();

  locationGroups.forEach((group, index) => {
    const systemSlug = slug(group.system);
    const locationSlug = slug(group.location);
    const presetId = (slugCounts.get(locationSlug) ?? 0) > 1 ? `${systemSlug}-${locationSlug}` : locationSlug;
    const sourceId = `${systemSlug}.${locationSlug}`;
    const locationType = locationTypeFromRows(group.rows);
    const materialKeys = [...new Set(group.rows.flatMap(signatureMaterialKeysFromRow))].sort();
    if (materialKeys.length === 0) return;

    locationSources.push({
      id: sourceId,
      label: group.location,
      shortLabel: group.location,
      system: normalizeSystem(group.system),
      parentLocation: group.system,
      locationType,
      materialKeys,
      enabled: true,
    });

    presets.push({
      id: presetId,
      label: group.location,
      shortLabel: group.location,
      system: normalizeSystem(group.system),
      presetType: "location",
      sourceLocationIds: [sourceId],
      sortOrder: index + 1,
      enabled: true,
    });

    const presetGroupId = `${systemSlug}-${slug(locationType === "surface" ? "bodies" : "space")}`;
    const presetGroup = presetGroupsById.get(presetGroupId) ?? {
      id: presetGroupId,
      label: groupLabel(group.system, locationType),
      system: normalizeSystem(group.system),
      presetIds: [],
    };
    presetGroup.presetIds.push(presetId);
    presetGroupsById.set(presetGroupId, presetGroup);
  });

  return createSignaturePresetCatalog(locationSources, presets, [...presetGroupsById.values()]);
}

export function resolveSignaturePresetMaterialKeys(
  presetId: string | null,
  catalog: SignaturePresetCatalog = DEFAULT_SIGNATURE_PRESET_CATALOG,
): string[] {
  if (!presetId) return [];
  const preset = catalog.presetById.get(presetId);
  if (!preset?.enabled) return [];

  const materialKeys = new Set<string>();
  for (const sourceLocationId of preset.sourceLocationIds) {
    const source = catalog.locationSourceById.get(sourceLocationId);
    if (!source?.enabled) continue;
    for (const materialKey of source.materialKeys) {
      materialKeys.add(materialKey);
    }
  }

  return [...materialKeys];
}
