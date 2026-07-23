import type { FittingComponentSummary, FittingCompatibleComponentsResult } from "./fittingApi";

import {
  isFittingItemInstallableForPort,
  isItemSizeCompatibleWithPort,
} from "./fittingItemConstraints";

import { getFittingItemCompatibilityKeys, itemKeysIntersect } from "./fittingItemIdentity";

import { mockupSlotDisplayLabel } from "./fittingMockupSlotLabels";

import type { FittingComponentRecord, PortBreakdownRow } from "./fittingPortGrouping";



const PORT_TYPE_TO_COMPONENT_TYPES: Record<string, string[]> = {

  PowerPlant: ["power_plant"],

  Cooler: ["cooler"],

  Shield: ["shield"],

  QuantumDrive: ["quantum_drive"],

  Radar: ["radar"],

  WeaponGun: ["ship_weapon"],

  Missile: ["missile"],

  MissileLauncher: ["missile_rack"],

  Bomb: ["bomb"],

  BombLauncher: ["bomb_rack"],

  WeaponMissile: ["missile"],

  WeaponDefensive: ["ship_weapon"],

};



export type SlotCompatibilityIndex = {

  portId: string;

  status: "known" | "unknown" | "none" | "unavailable";

  constraint: FittingCompatibleComponentsResult["constraint"] | null;

  compatibleComponentIds: Set<string>;

  unavailableReason: string | null;

};



export type SlotCompatibilityItem = {

  id: string;

  type: string | null;

  subtype: string | null;

  size: number | null;

  grade: string | null;

  class: string | null;

  displayName: string | null;

  name: string;

};



export type SlotCompatibilityVerdict = {

  compatible: boolean;

  reason: string | null;

  code?: string | null;

};



export type SlotCompatibilityRejection = {

  itemId: string;

  itemLabel: string;

  code: string;

  reason: string;

};



export { canonicalFittingId } from "./fittingItemIdentity";



export function isPortStructurallyEditable(slot: PortBreakdownRow): boolean {

  return slot.editable && !slot.locked && !slot.bespoke;

}



function collectCompatibilityKeys(components: FittingComponentSummary[]): Set<string> {

  const keys = new Set<string>();

  for (const component of components) {

    for (const key of getFittingItemCompatibilityKeys(component)) {

      keys.add(key);

    }

  }

  return keys;

}



export function buildSlotCompatibilityIndex(

  slot: PortBreakdownRow,

  result: FittingCompatibleComponentsResult | null,

  apiError = false,

): SlotCompatibilityIndex {

  if (apiError || !result || result.portId !== slot.portId) {

    return {

      portId: slot.portId,

      status: "unavailable",

      constraint: null,

      compatibleComponentIds: new Set(),

      unavailableReason: "Compatibility data unavailable for this slot.",

    };

  }



  const compatibleComponentIds = collectCompatibilityKeys(result.components);



  if (result.status === "unknown") {

    return {

      portId: slot.portId,

      status: "unknown",

      constraint: result.constraint,

      compatibleComponentIds,

      unavailableReason: "Compatibility data unavailable for this slot.",

    };

  }



  if (result.status === "none" || compatibleComponentIds.size === 0) {

    return {

      portId: slot.portId,

      status: "none",

      constraint: result.constraint,

      compatibleComponentIds,

      unavailableReason: null,

    };

  }



  return {

    portId: slot.portId,

    status: "known",

    constraint: result.constraint,

    compatibleComponentIds,

    unavailableReason: null,

  };

}



export function isSlotCompatibilityEditable(

  slot: PortBreakdownRow,

  index: SlotCompatibilityIndex,

): boolean {

  if (!isPortStructurallyEditable(slot)) return false;

  if (index.portId !== slot.portId) return false;

  if (index.constraint?.bespoke || index.constraint?.editable === false) return false;

  if (index.status !== "known" || index.compatibleComponentIds.size === 0) return false;

  return true;

}



function typeMismatch(

  constraint: SlotCompatibilityIndex["constraint"],

  itemType: string | null | undefined,

): SlotCompatibilityVerdict | null {

  const portType = constraint?.type;

  if (!portType || !itemType) return null;

  const expected = PORT_TYPE_TO_COMPONENT_TYPES[portType];

  if (!expected) return null;

  if (!expected.includes(itemType)) {

    return {

      compatible: false,

      reason: `Component type ${itemType} is not compatible with port type ${portType}.`,

      code: "type_mismatch",

    };

  }

  return null;

}



function itemMatchesCompatibilityIndex(

  item: SlotCompatibilityItem | FittingComponentSummary,

  index: SlotCompatibilityIndex,

): boolean {

  const itemKeys = getFittingItemCompatibilityKeys(item);

  return itemKeysIntersect(itemKeys, index.compatibleComponentIds);

}



function itemLabel(item: SlotCompatibilityItem | FittingComponentSummary): string {

  return item.displayName || item.name || item.id;

}



export function isItemCompatibleWithSlot(input: {

  slot: PortBreakdownRow;

  item: SlotCompatibilityItem | FittingComponentSummary;

  compatibilityIndex: SlotCompatibilityIndex;

}): SlotCompatibilityVerdict {

  const { slot, item, compatibilityIndex: index } = input;



  if (!isPortStructurallyEditable(slot)) {

    return {

      compatible: false,

      reason: "This port is locked or bespoke and cannot be changed.",

      code: "port_not_editable",

    };

  }



  if (index.portId !== slot.portId) {

    return {

      compatible: false,

      reason: "Compatibility data is out of date for this slot.",

      code: "stale_port",

    };

  }



  if (index.status === "unavailable" || index.status === "unknown") {

    return {

      compatible: false,

      reason: index.unavailableReason ?? "Compatibility data unavailable for this slot.",

      code: "compatibility_unavailable",

    };

  }



  if (index.status === "none") {

    return {

      compatible: false,

      reason: "No compatible items were found for this slot.",

      code: "compatibility_none",

    };

  }



  if (!itemMatchesCompatibilityIndex(item, index)) {

    return {

      compatible: false,

      reason: "Item is not listed as compatible for this slot.",

      code: "not_in_compatible_list",

    };

  }



  const typeReason = typeMismatch(index.constraint, item.type);

  if (typeReason) return typeReason;



  const sizeVerdict = isItemSizeCompatibleWithPort(slot, item, index.constraint);

  if (!sizeVerdict.ok) {

    return {

      compatible: false,

      reason: sizeVerdict.reason,

      code: sizeVerdict.code,

    };

  }



  const installableVerdict = isFittingItemInstallableForPort(slot, item);

  if (!installableVerdict.ok) {

    return {

      compatible: false,

      reason: installableVerdict.reason,

      code: installableVerdict.code,

    };

  }



  return { compatible: true, reason: null, code: null };

}



export function resolveCompatibleItemsForSlot(input: {

  slot: PortBreakdownRow;

  candidateItems: FittingComponentSummary[];

  compatibilityIndex: SlotCompatibilityIndex;

}): FittingComponentSummary[] {

  const { slot, candidateItems, compatibilityIndex } = input;



  if (compatibilityIndex.portId !== slot.portId) return [];

  if (compatibilityIndex.status === "unavailable" || compatibilityIndex.status === "unknown") return [];

  if (compatibilityIndex.status === "none") return [];

  if (compatibilityIndex.status !== "known") return [];

  if (!isPortStructurallyEditable(slot)) return [];

  if (compatibilityIndex.constraint?.bespoke || compatibilityIndex.constraint?.editable === false) return [];



  return candidateItems.filter((item) => (

    isItemCompatibleWithSlot({ slot, item, compatibilityIndex }).compatible

  ));

}



export function resolveCompatibilityRejections(input: {

  slot: PortBreakdownRow;

  candidateItems: FittingComponentSummary[];

  compatibilityIndex: SlotCompatibilityIndex;

  limit?: number;

}): SlotCompatibilityRejection[] {

  const { slot, candidateItems, compatibilityIndex, limit = 20 } = input;

  const rejections: SlotCompatibilityRejection[] = [];



  for (const item of candidateItems) {

    const verdict = isItemCompatibleWithSlot({ slot, item, compatibilityIndex });

    if (verdict.compatible) continue;

    rejections.push({

      itemId: item.id,

      itemLabel: itemLabel(item),

      code: verdict.code ?? "rejected",

      reason: verdict.reason ?? "Rejected by compatibility resolver.",

    });

    if (rejections.length >= limit) break;

  }



  return rejections;

}



export function toCompatibilityItem(

  item: FittingComponentSummary | FittingComponentRecord,

): SlotCompatibilityItem {

  if ("componentKey" in item) {

    return {

      id: item.componentKey,

      type: item.category,

      subtype: item.subtype,

      size: item.size ?? null,

      grade: null,

      class: null,

      displayName: item.displayName,

      name: item.displayName ?? item.componentKey,

    };

  }



  return {

    id: item.id,

    type: item.type,

    subtype: item.subtype,

    size: item.size,

    grade: item.grade,

    class: item.class,

    displayName: item.displayName,

    name: item.name,

  };

}



export function compatibilityDrawerMessage(

  slot: PortBreakdownRow,

  index: SlotCompatibilityIndex,

  loading: boolean,

  itemCount: number,

): string | null {

  if (loading) return "Loading compatible components…";

  if (index.portId !== slot.portId) return "Loading compatible components…";

  if (index.status === "unavailable" || index.status === "unknown") {

    return index.unavailableReason ?? "Compatibility data unavailable for this slot.";

  }

  const slotLabel = mockupSlotDisplayLabel(slot);

  if (!isSlotCompatibilityEditable(slot, index)) {

    if (!isPortStructurallyEditable(slot)) return "This port is locked or bespoke and cannot be changed.";

    if (index.status === "none" || itemCount === 0) {

      return `No compatible items were found for ${slotLabel}.`;

    }

    return "Compatibility data unavailable for this slot.";

  }

  if (itemCount === 0) return `No compatible items were found for ${slotLabel}.`;

  return null;

}



export function portCompatibleApiComponents(

  result: FittingCompatibleComponentsResult | null,

  portId: string,

): FittingComponentSummary[] {

  if (!result || result.portId !== portId) return [];

  return result.components;

}



export { getFittingPortSizeConstraint } from "./fittingItemConstraints";


