const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MATERIAL_GUID_ALIASES: Record<string, string> = {
  "93c8b7df-d6ac-4b4f-a115-b0e3afc238b8": "beryl",
  "f386a33c-ac9a-400a-a7b8-fe1fc7c8d270": "iron",
  "8cd317a3-df9b-4315-8ac3-0f1fca42dfd4": "stileron",
  "6426f04e-2f7d-4c8e-a615-64aa582eaa31": "savrilium",
  "4a47cad8-0271-4048-b19b-d9b52521fc20": "savrilium",
  "61189578-ed7a-4491-9774-37ae2f82b8b0": "hephaestanite",
  "bde5a2c8-2ef4-46ac-9403-2fcb79e4016c": "quantanium",
};

const TEXT_ALIASES: Record<string, string> = {
  quantanium: "quantanium",
  quantainium: "quantanium",
  savrilium: "savrilium",
  savrillium: "savrilium",
  savrilum: "savrilium",
  hephaestonite: "hephaestanite",
  hephaestanite: "hephaestanite",
  hephaestonice: "hephaestanite",
  carinitepure: "carinite-pure",
  purecarinite: "carinite-pure",
};

const DISPLAY_NAMES: Record<string, string> = {
  "carinite-pure": "Pure Carinite",
  hephaestanite: "Hephaestonite",
  quantanium: "Quantanium",
  savrilium: "Savrilium",
};

function compact(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isUuidMaterialKey(value: string | null | undefined): boolean {
  return UUID_PATTERN.test(value ?? "");
}

export function canonicalMiningMaterialKey(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  const lower = trimmed.toLowerCase();
  if (MATERIAL_GUID_ALIASES[lower]) return MATERIAL_GUID_ALIASES[lower];
  const normalized = compact(trimmed);
  return TEXT_ALIASES[normalized] ?? normalized;
}

export function canonicalMiningMaterialName(value: string | null | undefined): string {
  const key = canonicalMiningMaterialKey(value);
  return DISPLAY_NAMES[key] ?? (value ?? "").trim();
}

export function canonicalMiningMaterial(input: {
  id?: string | null;
  materialKey?: string | null;
  materialId?: string | null;
  label?: string | null;
  displayName?: string | null;
  materialName?: string | null;
}): { key: string; label: string; unresolvedUuid: boolean } {
  const candidates = [
    input.materialKey,
    input.id,
    input.materialId,
    input.displayName,
    input.materialName,
    input.label,
  ];
  const first = candidates.find((candidate) => {
    const value = candidate?.trim();
    if (!value) return false;
    return !isUuidMaterialKey(value) || Boolean(MATERIAL_GUID_ALIASES[value.toLowerCase()]);
  }) ?? candidates.find((candidate) => Boolean(candidate?.trim())) ?? "";
  const key = canonicalMiningMaterialKey(first);
  const nameCandidate = [input.displayName, input.materialName, input.label]
    .find((candidate) => Boolean(candidate?.trim()));
  const label = DISPLAY_NAMES[key] ?? nameCandidate?.trim() ?? key;
  return {
    key,
    label,
    unresolvedUuid: isUuidMaterialKey(first) && key === compact(first),
  };
}
