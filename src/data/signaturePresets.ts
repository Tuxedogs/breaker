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

const locationSourceById = new Map(SIGNATURE_LOCATION_SOURCES.map((source) => [source.id, source]));
export const signaturePresetById = new Map(SIGNATURE_PRESETS.map((preset) => [preset.id, preset]));

export function resolveSignaturePresetMaterialKeys(presetId: string | null): string[] {
  if (!presetId) return [];
  const preset = signaturePresetById.get(presetId);
  if (!preset?.enabled) return [];

  const materialKeys = new Set<string>();
  for (const sourceLocationId of preset.sourceLocationIds) {
    const source = locationSourceById.get(sourceLocationId);
    if (!source?.enabled) continue;
    for (const materialKey of source.materialKeys) {
      materialKeys.add(materialKey);
    }
  }

  return [...materialKeys];
}
