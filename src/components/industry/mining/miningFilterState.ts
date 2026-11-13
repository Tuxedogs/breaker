import type { RequiredMaterial } from "../../../features/mining/types";
import { canonicalMiningMaterialKey } from "../../../features/mining/materialIdentity";
import { getStaticMaterialKey, type StaticLocationMaterialRow } from "../../../features/mining/staticMiningIndex";

/**
 * Public material presence: system -> location -> canonical material keys.
 * Built only from the public static location-material index so chip muting and
 * disabling never depend on authenticated quality, score, or ranking data.
 */
export type MiningPresenceIndex = ReadonlyMap<string, ReadonlyMap<string, ReadonlySet<string>>>;

export type MiningChipAvailability = "normal" | "muted" | "disabled" | "selectedUnavailable";

export interface MiningChipState {
  availability: MiningChipAvailability;
  selected: boolean;
}

export interface MiningFilterState {
  /** Every system in the presence index, in selector order. Never depends on material selection. */
  systemsShown: string[];
  /** Selected systems that exist in the index. Empty means all systems. */
  activeSystems: Set<string>;
  /** Materials present in the selected systems; null when presence is unknown (index not loaded). */
  availableMaterials: Set<string> | null;
  /** Materials co-occurring with ALL available selected materials; null when nothing constrains muting. */
  coOccurringMaterials: Set<string> | null;
  chipStateByMaterial: Map<string, MiningChipState>;
  /** Selected materials minus those unavailable in the selected systems, in selection order. */
  requestMaterials: Set<string>;
}

type PresenceRow = Pick<StaticLocationMaterialRow, "system" | "systemDisplayName" | "locationKey" | "materialId" | "materialName" | "sources">;

export function buildMiningPresenceIndex(rows: readonly PresenceRow[]): MiningPresenceIndex {
  const index = new Map<string, Map<string, Set<string>>>();
  for (const row of rows) {
    // Matches the systemName the recommendation entries carry.
    const system = (row.systemDisplayName || row.system || "").trim();
    const location = (row.locationKey ?? "").trim();
    const materialKey = getStaticMaterialKey(row as StaticLocationMaterialRow);
    if (!system || !location || !materialKey) continue;
    const locations = index.get(system) ?? new Map<string, Set<string>>();
    const materials = locations.get(location) ?? new Set<string>();
    materials.add(materialKey);
    locations.set(location, materials);
    index.set(system, locations);
  }
  return index;
}

export function orderMiningSystems(systems: Iterable<string>, preferredOrder: readonly string[]): string[] {
  const all = [...new Set(systems)];
  const ordered = preferredOrder.filter((system) => all.includes(system));
  const remaining = all.filter((system) => !ordered.includes(system)).sort((a, b) => a.localeCompare(b));
  return [...ordered, ...remaining];
}

/** Restores persisted systems, dropping unknown names; any invalid value falls back to empty (all). */
export function restoreMiningSystemSelection(stored: unknown, knownSystems: readonly string[]): Set<string> {
  if (!Array.isArray(stored)) return new Set();
  const known = new Set(knownSystems);
  return new Set(stored.filter((value): value is string => typeof value === "string" && known.has(value)));
}

export function deriveMiningFilterState({
  presence,
  selectedSystems,
  selectedMaterials,
  materialKeys,
  systemOrder = [],
}: {
  presence: MiningPresenceIndex;
  selectedSystems: ReadonlySet<string>;
  selectedMaterials: ReadonlySet<string>;
  materialKeys: Iterable<string>;
  systemOrder?: readonly string[];
}): MiningFilterState {
  const systemsShown = orderMiningSystems(presence.keys(), systemOrder);
  const activeSystems = new Set([...selectedSystems].filter((system) => presence.has(system)));
  const scopeSystems = activeSystems.size > 0 ? [...activeSystems] : systemsShown;
  const scopeLocations: ReadonlySet<string>[] = scopeSystems.flatMap((system) => [...(presence.get(system)?.values() ?? [])]);

  const presenceKnown = presence.size > 0;
  const availableMaterials = presenceKnown ? new Set(scopeLocations.flatMap((materials) => [...materials])) : null;
  const requestMaterials = new Set([...selectedMaterials].filter((key) => !availableMaterials || availableMaterials.has(key)));

  let coOccurringMaterials: Set<string> | null = null;
  if (availableMaterials && requestMaterials.size > 0) {
    coOccurringMaterials = new Set();
    for (const materials of scopeLocations) {
      if ([...requestMaterials].every((key) => materials.has(key))) {
        for (const key of materials) coOccurringMaterials.add(key);
      }
    }
  }

  const chipStateByMaterial = new Map<string, MiningChipState>();
  for (const key of new Set([...materialKeys, ...selectedMaterials])) {
    const selected = selectedMaterials.has(key);
    let availability: MiningChipAvailability = "normal";
    if (availableMaterials && !availableMaterials.has(key)) availability = selected ? "selectedUnavailable" : "disabled";
    else if (!selected && coOccurringMaterials && !coOccurringMaterials.has(key)) availability = "muted";
    chipStateByMaterial.set(key, { availability, selected });
  }

  return { systemsShown, activeSystems, availableMaterials, coOccurringMaterials, chipStateByMaterial, requestMaterials };
}

/** Project request demand without changing the user's sidebar selection. */
export function projectMiningRequestMaterials(
  sidebarMaterials: RequiredMaterial[],
  queueMaterials: RequiredMaterial[],
  queueActive: boolean,
  availableMaterials: ReadonlySet<string> | null,
) {
  const keyOf = (material: RequiredMaterial) => canonicalMiningMaterialKey(material.materialKey ?? material.materialId);
  const queueKeys = new Set(queueMaterials.map(keyOf));
  const available = (material: RequiredMaterial) => !availableMaterials || availableMaterials.has(keyOf(material));
  const sidebarOnlyMaterials = sidebarMaterials.filter((material) =>
    (!queueActive || !queueKeys.has(keyOf(material))) && available(material));
  return {
    sidebarOnlyMaterials,
    recommenderRequiredMaterials: [
      ...(queueActive ? queueMaterials.filter(available) : []),
      ...sidebarOnlyMaterials,
    ],
  };
}
