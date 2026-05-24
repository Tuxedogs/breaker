import type { FilterChip, ResourceGroups } from "./MsbSidebar";

type ResourceInput = {
  id: string;
  label: string;
  miningType?: string;
};

function classifyMiningType(miningType?: string): FilterChip["group"] {
  const lower = (miningType ?? "").toLowerCase();
  if (lower.includes("ground") || lower.includes("vehicle")) return "vehicle";
  if (lower.includes("hand") || lower.includes("fps")) return "hand";
  return "ship";
}
const HAND_MINABLE_RESOURCE_KEYS = new Set([
  "aphorite",
  "carinitepure",
  "dolivine",
  "hadanite",
  "jaclium",
  "janalite",
  "sadaryx",
  "saldynium",
  "saldyniumore",
]);

const VEHICLE_MINABLE_RESOURCE_KEYS = new Set([
  "beradom",
  "carinite",
  "feynmaline",
  "glacosite",
]);

const MANUFACTURED_RESOURCE_KEYS = new Set([
  "fde0cd6588274b23804dcc8845dfa7ac",
  "insulativelinermaterial",
]);

function normalizeResourceKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isMineableResource(resource: ResourceInput): boolean {
  const idKey = normalizeResourceKey(resource.id);
  const labelKey = normalizeResourceKey(resource.label);
  return !MANUFACTURED_RESOURCE_KEYS.has(idKey) && !MANUFACTURED_RESOURCE_KEYS.has(labelKey);
}

function classifyResourceGroup(resource: ResourceInput): FilterChip["group"] {
  const key = normalizeResourceKey(resource.label || resource.id);

  if (HAND_MINABLE_RESOURCE_KEYS.has(key)) return "hand";
  if (VEHICLE_MINABLE_RESOURCE_KEYS.has(key)) return "vehicle";

  return classifyMiningType(resource.miningType);
}

export function buildResourceGroups(resources: ResourceInput[]): ResourceGroups {
  const groups: ResourceGroups = {
    shipAndHarvestable: [],
    vehicle: [],
    hand: [],
  };

  const seen = new Set<string>();

  for (const resource of resources) {
    if (seen.has(resource.id)) continue;
    if (!isMineableResource(resource)) continue;
    seen.add(resource.id);

    const group = classifyResourceGroup(resource);

    const chip: FilterChip = {
      id: resource.id,
      label: resource.label,
      group,
    };

    if (group === "vehicle") groups.vehicle.push(chip);
    else if (group === "hand") groups.hand.push(chip);
    else groups.shipAndHarvestable.push(chip);
  }

  for (const group of Object.values(groups)) {
    group.sort((left, right) => left.label.localeCompare(right.label));
  }

  return groups;
}
