import {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type { ComponentRecipe } from "./utils/craftingTypes";
import {
  ACQUIRED_BLUEPRINTS_STORAGE_KEY,
  COMPLETED_MISSIONS_STORAGE_KEY,
  MISSION_BOOKMARK_STORAGE_KEY,
  PINNED_MISSIONS_STORAGE_KEY,
  RECIPE_BOOKMARK_STORAGE_KEY,
  buildTrackerEntries,
  loadMissionBlueprintRewards,
  loadMissionDetailMap,
  readStoredStringSet,
  writeStoredStringSet,
  type BlueprintRewardItem,
  type BlueprintTrackerEntry,
  type MissionBlueprintReward,
  type MissionSourceDetail,
} from "./utils/blueprintTrackerStore";
import { getCraftingItems } from "@/lib/craftingData";
import { useAuthSession } from "@/lib/auth/useAuthSession";
import { hasSupabaseConfig, signInWithDiscord } from "@/lib/supabaseClient";
import {
  fetchUserBlueprintTrackerState,
  saveUserBlueprintTrackerState,
  type UserBlueprintTrackerState,
} from "@/lib/userBlueprintTracker";
import { deleteUserBlueprint, fetchSavedBlueprints, saveUserBlueprint } from "@/lib/userSavedBlueprints";

type TrackerMode = "missions" | "library";

function formatChance(value?: number): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 1) return `${Math.round(value * 100)}%`;
  return `${Math.round(value)}%`;
}

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

function rewardStorageKey(reward: BlueprintRewardItem): string {
  return reward.blueprintGuid ?? reward.rewardKey;
}

function setToList(values: Set<string>): string[] {
  return Array.from(values);
}

function DisabledBadge() {
  return <span className="bt-disabled-badge">[DISABLED]</span>;
}

function RewardMeta({ reward }: { reward: BlueprintRewardItem }) {
  const chance = formatChance(reward.chance);
  const meta = [
    reward.componentType,
    reward.size ? `S${reward.size}` : null,
    reward.grade ? `Grade ${reward.grade}` : null,
    reward.itemClass,
    reward.poolName,
    chance ? `${chance} chance` : null,
    reward.weight !== undefined ? `Weight ${reward.weight}` : null,
  ].filter(Boolean);
  return <span className="bt-reward-meta">{meta.length > 0 ? meta.join(" / ") : "Unknown reward metadata"}</span>;
}

// --- Blueprint-first view model layer (derived, read-only over existing data) ---
// Every count, list, flag, and group below is computed from the loaded MissionBlueprintReward[]
// plus the existing acquiredBlueprintIds / completedMissionIds sets.
// No hardcoded stats, no placeholder "2/5", no invented fields. All wired.

type UiCategory = "armorSet" | "fpsWeapon" | "shipWeapon" | "component" | "other";

type MissionAvailabilityEntry = {
  sourceMissionId: string;
  system?: string;
  locationAddress?: string;
  destinationAddress?: string;
  disabled?: boolean;
  disabledReason?: string;
  faction?: string;
  maxStanding?: string;
  prerequisiteReputation?: string;
  reputationReward?: string;
};

type CanonicalMissionView = {
  canonicalMissionKey: string;
  title: string;
  description?: string;
  missionType?: string;
  prerequisiteReputation?: string;
  reputationReward?: string;
  maxStanding?: string;
  status: "available" | "unavailable" | "mixed";
  linkedRewards: string[];
  availabilityEntries: MissionAvailabilityEntry[];
};

type AcquisitionFactionGroup = {
  faction: string;
  missions: CanonicalMissionView[];
};

type AcquisitionSystemGroup = {
  system: string;
  factions: AcquisitionFactionGroup[];
};

type BlueprintRewardView = {
  rewardId: string;
  name: string;
  category: UiCategory;
  type?: string;
  subtype?: string;
  manufacturer?: string;
  rarity?: string;
  description?: string;
  imageUrl?: string;
  fallbackIconKey: string;
  collectedCount: number;
  totalCount: number;
  isCollected: boolean;
  hasDisabledSources: boolean;
  allSourcesDisabled: boolean;
  acquisitionGroups: AcquisitionSystemGroup[];
};

type ArmorPieceType = "helmet" | "core" | "arms" | "legs" | "backpack" | "undersuit" | "other";

type ArmorSetPieceView = {
  reward: BlueprintRewardView;
  pieceType: ArmorPieceType;
};

type ArmorSetVariantView = {
  variantKey: string;
  displayName: string;
  pieces: ArmorSetPieceView[];
  totalPieces: number;
  collectedPieces: number;
  hasDisabledSources: boolean;
  allSourcesDisabled: boolean;
};

type ArmorSetGroupView = {
  baseSetKey: string;
  displayName: string;
  category: "armorSet";
  variants: ArmorSetVariantView[];
  totalPieces: number;
  collectedPieces: number;
  hasDisabledSources: boolean;
  allSourcesDisabled: boolean;
  fallbackIconKey: string;
  searchText: string;
};

type FpsWeaponRelatedPartType = "magazine" | "battery" | "ammo" | "barrel" | "optic" | "attachment" | "other";

type FpsWeaponFamilyView = {
  baseWeaponKey: string;
  displayName: string;
  category: "fpsWeapon";
  weaponType: string;
  variants: { variantKey: string; displayName: string; reward: BlueprintRewardView }[];
  relatedParts: { partType: FpsWeaponRelatedPartType; reward: BlueprintRewardView }[];
  totalRewards: number;
  collectedRewards: number;
  hasDisabledSources: boolean;
  allSourcesDisabled: boolean;
  fallbackIconKey: string;
  searchText: string;
};

type TrackerTab = "tracker" | "browse" | "completed";

type TrackerItemView = {
  id: string;
  name: string;
  category: UiCategory;
  typeLabel: string;
  memberIds: string[];
  collectedCount: number;
  totalCount: number;
  sourceCount: number;
  bestSource: string;
  searchText: string;
  allSourcesDisabled: boolean;
  open: () => void;
};

const CATEGORY_ORDER: UiCategory[] = ["armorSet", "fpsWeapon", "shipWeapon", "component", "other"];

const CATEGORY_LABEL: Record<UiCategory, string> = {
  armorSet: "Armor Sets",
  fpsWeapon: "FPS Weapons",
  shipWeapon: "Ship Weapons",
  component: "Components",
  other: "Other",
};

const ARMOR_PIECE_PATTERN = /\b(helmet|helm|core|chest|torso|arms?|gauntlets?|legs?|boots?|backpack|pack|undersuit)\b/i;

function normalizeArmorPieceType(value: string): ArmorPieceType {
  const piece = value.toLowerCase();
  if (piece === "helmet" || piece === "helm") return "helmet";
  if (piece === "core" || piece === "chest" || piece === "torso") return "core";
  if (piece === "arm" || piece === "arms" || piece.startsWith("gauntlet")) return "arms";
  if (piece === "leg" || piece === "legs" || piece.startsWith("boot")) return "legs";
  if (piece === "backpack" || piece === "pack") return "backpack";
  if (piece === "undersuit") return "undersuit";
  return "other";
}

function parseArmorRewardName(name: string): { baseSet: string; variant: string; pieceType: ArmorPieceType } {
  const match = ARMOR_PIECE_PATTERN.exec(name);
  if (!match || match.index === undefined) {
    return { baseSet: name.trim(), variant: "Default", pieceType: "other" };
  }

  const baseSet = name
    .slice(0, match.index)
    .replace(/\barmor\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || name.trim();
  const variant = name
    .slice(match.index + match[0].length)
    .replace(/^[\s\-:]+|[\s\-:]+$/g, "")
    .replace(/^\((.+)\)$/, "$1")
    .trim() || "Default";

  return { baseSet, variant, pieceType: normalizeArmorPieceType(match[0]) };
}

function buildArmorSetGroups(rewards: BlueprintRewardView[]): ArmorSetGroupView[] {
  const groups = new Map<string, { displayName: string; variants: Map<string, ArmorSetPieceView[]> }>();

  for (const reward of rewards.filter((item) => item.category === "armorSet")) {
    const parsed = parseArmorRewardName(reward.name);
    const baseSetKey = parsed.baseSet.toLowerCase();
    const variantKey = parsed.variant.toLowerCase();
    const group = groups.get(baseSetKey) ?? { displayName: parsed.baseSet, variants: new Map() };
    const pieces = group.variants.get(variantKey) ?? [];
    pieces.push({ reward, pieceType: parsed.pieceType });
    group.variants.set(variantKey, pieces);
    groups.set(baseSetKey, group);
  }

  return Array.from(groups.entries())
    .map(([baseSetKey, group]) => {
      const variants = Array.from(group.variants.entries())
        .map(([variantKey, pieces]) => ({
          variantKey,
          displayName: variantKey === "default" ? "Default" : parseArmorRewardName(pieces[0].reward.name).variant,
          pieces: pieces.sort((a, b) => a.pieceType.localeCompare(b.pieceType)),
          totalPieces: pieces.length,
          collectedPieces: pieces.filter((piece) => piece.reward.isCollected).length,
          hasDisabledSources: pieces.some((piece) => piece.reward.hasDisabledSources),
          allSourcesDisabled: pieces.every((piece) => piece.reward.allSourcesDisabled),
        }))
        .sort((a, b) => a.displayName === "Default" ? -1 : b.displayName === "Default" ? 1 : a.displayName.localeCompare(b.displayName));
      const allPieces = variants.flatMap((variant) => variant.pieces);
      return {
        baseSetKey,
        displayName: group.displayName,
        category: "armorSet" as const,
        variants,
        totalPieces: allPieces.length,
        collectedPieces: allPieces.filter((piece) => piece.reward.isCollected).length,
        hasDisabledSources: allPieces.some((piece) => piece.reward.hasDisabledSources),
        allSourcesDisabled: allPieces.every((piece) => piece.reward.allSourcesDisabled),
        fallbackIconKey: "armorSet-armor",
        searchText: [group.displayName, ...allPieces.map((piece) => piece.reward.name)].join(" ").toLowerCase(),
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

const WEAPON_TYPE_PATTERN = /\b(sniper rifle|assault rifle|laser rifle|energy rifle|rifle|shotgun|submachine gun|smg|light machine gun|lmg|pistol|launcher|melee)\b/i;
const WEAPON_PART_PATTERN = /\b(magazine|mag|battery|ammo|rounds?|cartridge|barrel|optic|scope|sight|suppressor|compensator|grip|stock|attachment)\b/i;

function normalizeWeaponType(name: string): string {
  const type = WEAPON_TYPE_PATTERN.exec(name)?.[0].toLowerCase() || "weapon";
  if (type.includes("sniper")) return "sniper";
  if (type === "pistol") return "pistol";
  if (type.includes("shotgun")) return "shotgun";
  if (type === "smg" || type.includes("submachine")) return "smg";
  if (type === "lmg" || type.includes("light machine")) return "lmg";
  if (type.includes("launcher")) return "launcher";
  if (type.includes("melee")) return "melee";
  return "rifle";
}

function normalizeRelatedPartType(name: string): FpsWeaponRelatedPartType {
  const value = name.toLowerCase();
  if (/\bmagazine|\bmag\b/.test(value)) return "magazine";
  if (/\bbattery\b/.test(value)) return "battery";
  if (/\bammo|\bround|\bcartridge/.test(value)) return "ammo";
  if (/\bbarrel\b/.test(value)) return "barrel";
  if (/\boptic|\bscope|\bsight/.test(value)) return "optic";
  if (/\bsuppressor|\bcompensator|\bgrip|\bstock|\battachment/.test(value)) return "attachment";
  return "other";
}

function parseFpsWeaponRewardName(name: string): {
  baseWeapon: string;
  variant: string;
  weaponType: string;
  relatedPartType?: FpsWeaponRelatedPartType;
} | null {
  const weaponMatch = WEAPON_TYPE_PATTERN.exec(name);
  if (!weaponMatch || weaponMatch.index === undefined) return null;
  const partMatch = WEAPON_PART_PATTERN.exec(name);
  const quoteMatch = /["“](.+?)["”]/.exec(name);
  const weaponEnd = weaponMatch.index + weaponMatch[0].length;
  const baseWeapon = name
    .slice(0, weaponEnd)
    .replace(/["“].+?["”]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    baseWeapon,
    variant: quoteMatch?.[1]?.trim() || "Default",
    weaponType: normalizeWeaponType(name),
    relatedPartType: partMatch && partMatch.index >= weaponEnd ? normalizeRelatedPartType(partMatch[0]) : undefined,
  };
}

function buildFpsWeaponFamilies(rewards: BlueprintRewardView[]): FpsWeaponFamilyView[] {
  const families = new Map<string, {
    displayName: string;
    weaponType: string;
    variants: FpsWeaponFamilyView["variants"];
    relatedParts: FpsWeaponFamilyView["relatedParts"];
  }>();

  for (const reward of rewards.filter((item) => item.category === "fpsWeapon")) {
    const parsed = parseFpsWeaponRewardName(reward.name);
    if (!parsed) continue;
    const baseWeaponKey = parsed.baseWeapon.toLowerCase();
    const family = families.get(baseWeaponKey) ?? {
      displayName: parsed.baseWeapon,
      weaponType: parsed.weaponType,
      variants: [],
      relatedParts: [],
    };
    if (parsed.relatedPartType) {
      family.relatedParts.push({ partType: parsed.relatedPartType, reward });
    } else {
      family.variants.push({ variantKey: parsed.variant.toLowerCase(), displayName: parsed.variant, reward });
    }
    families.set(baseWeaponKey, family);
  }

  return Array.from(families.entries())
    .map(([baseWeaponKey, family]) => {
      const rewardsInFamily = [...family.variants.map((item) => item.reward), ...family.relatedParts.map((item) => item.reward)];
      return {
        baseWeaponKey,
        displayName: family.displayName,
        category: "fpsWeapon" as const,
        weaponType: family.weaponType,
        variants: family.variants.sort((a, b) => a.displayName === "Default" ? -1 : b.displayName === "Default" ? 1 : a.displayName.localeCompare(b.displayName)),
        relatedParts: family.relatedParts.sort((a, b) => a.reward.name.localeCompare(b.reward.name)),
        totalRewards: rewardsInFamily.length,
        collectedRewards: rewardsInFamily.filter((item) => item.isCollected).length,
        hasDisabledSources: rewardsInFamily.some((item) => item.hasDisabledSources),
        allSourcesDisabled: rewardsInFamily.every((item) => item.allSourcesDisabled),
        fallbackIconKey: `fpsWeapon-${family.weaponType}`,
        searchText: [family.displayName, ...rewardsInFamily.map((item) => item.name)].join(" ").toLowerCase(),
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

type BlueprintFallbackIconProps = {
  category: UiCategory;
  type?: string;
  subtype?: string;
  status?: "default" | "collected" | "unavailable";
};

export function BlueprintFallbackIcon({ category, type, subtype, status = "default" }: BlueprintFallbackIconProps) {
  const key = `${category} ${type || ""} ${subtype || ""}`.toLowerCase();
  let paths;

  if (/\bhelmet|\bhelm/.test(key)) {
    paths = <><path d="M7 18v-5.5A5 5 0 0 1 17 12.5V18" /><path d="M7 14h10M9 18v-3m6 3v-3M10 8.5h4" /></>;
  } else if (/\bcore|\bchest|\btorso/.test(key)) {
    paths = <><path d="m8 5 4-2 4 2 3 4-3 2v8H8v-8L5 9l3-4Z" /><path d="M10 8h4m-4 4h4" /></>;
  } else if (/\barms?|\bgauntlet/.test(key)) {
    paths = <><path d="m7 5-3 3 3 10 4-1-1-8m7-4 3 3-3 10-4-1 1-8" /><path d="m8 7 2 2m6-2-2 2" /></>;
  } else if (/\blegs?|\bboots?/.test(key)) {
    paths = <><path d="M8 4h8l1 7-2 8h-3l-1-7-1 7H7l-1-8 2-7Z" /><path d="M8 8h8m-5-4v8" /></>;
  } else if (/\bbackpack|\bpack/.test(key)) {
    paths = <><rect x="6" y="7" width="12" height="13" rx="2" /><path d="M9 7V5h6v2M9 11h6m-7 3H5m11 0h3" /></>;
  } else if (category === "armorSet" || /\bshield/.test(key)) {
    paths = <><path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6l-7-3Z" /><path d="M9 11.5 11 14l4-5" /></>;
  } else if (/\b(sniper|rifle|smg|shotgun|weapons?)\b/.test(key)) {
    paths = <><path d="M3 10h12l3 2h3v3h-8l-2 2H7l-1-4H3v-3Z" /><path d="M8 17 7 21m7-6 2 4m-7-9V7h6v3" /></>;
  } else if (/\bpistol/.test(key)) {
    paths = <><path d="M4 9h13l3 2v3h-9l-2 2H6l-1-4H4V9Z" /><path d="m10 16-1 5H6l-1-5" /></>;
  } else if (/\bammo|\bmagazine/.test(key)) {
    paths = <><path d="M8 4h8v15l-4 2-4-2V4Z" /><path d="M10 8h4m-4 4h4m-4 4h4" /></>;
  } else if (category === "shipWeapon" || /\bcannon|\brepeater|\bmissile|\btorpedo|\blaser|\bdistortion/.test(key)) {
    paths = <><path d="M3 11h12l5 3-5 3H3v-6Z" /><path d="M7 11V7h8v4m-6 6v3h6v-3" /><path d="m18 10 3-2m-3 10 3 2" /></>;
  } else if (/\bcooler/.test(key)) {
    paths = <><circle cx="12" cy="12" r="3" /><path d="M12 3v6m0 6v6M3 12h6m6 0h6M5.6 5.6l4.2 4.2m4.4 4.4 4.2 4.2m0-12.8-4.2 4.2m-4.4 4.4-4.2 4.2" /></>;
  } else if (/\bpower/.test(key)) {
    paths = <path d="m13 2-7 12h6l-1 8 7-12h-6l1-8Z" />;
  } else if (/\bquantum/.test(key)) {
    paths = <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="8" /><path d="M12 1v3m0 16v3M1 12h3m16 0h3" /></>;
  } else if (/\bradar|\bscanner/.test(key)) {
    paths = <><circle cx="12" cy="12" r="2" /><path d="M12 6a6 6 0 0 1 0 12m0-16a10 10 0 0 1 0 20M12 12l6-6" /></>;
  } else if (/\bthruster/.test(key)) {
    paths = <><path d="m12 3 5 7-2 7H9l-2-7 5-7Z" /><path d="m10 17-2 4m6-4 2 4" /></>;
  } else if (/\bpaint|\bswirl/.test(key)) {
    paths = <><path d="M12 4a8 8 0 1 0 8 8c0-2-1-3-3-3h-2a2 2 0 0 1-2-2c0-2-1-3-1-3Z" /><circle cx="8" cy="10" r=".8" /><circle cx="10" cy="7" r=".8" /></>;
  } else if (/\btool|\butility|\battachment/.test(key)) {
    paths = <><path d="m14 6 4-3 3 3-3 4-3-1-7 7 1 3-2 2-4-4 2-2 3 1 7-7-1-3Z" /></>;
  } else {
    paths = <><path d="M7 3h8l4 4v14H7V3Z" /><path d="M15 3v5h5M10 12h6m-6 4h6" /></>;
  }

  return (
    <svg className={`bp-fallback-icon is-${status}`} viewBox="0 0 24 24" aria-hidden="true">
      {paths}
    </svg>
  );
}

function getUiCategory(componentType?: string): UiCategory {
  const t = (componentType || "").toLowerCase();
  if (t === "armor") return "armorSet";
  if (t === "weapons" || t === "ammo") return "fpsWeapon";
  if (t === "weapongun" || t === "weaponmining") return "shipWeapon";
  if (["radar", "cooler", "powerplant", "shield", "quantumdrive", "dockingcollar", "salvagemodifier"].includes(t)) return "component";
  return "other";
}

/**
 * Pure derived view model builder.
 * - Uniques rewards using the existing rewardStorageKey (blueprintGuid preferred).
 * - totalCount = actual # of missions in data that award this reward.
 * - collectedCount = # of those missions that are in completedMissionIds (or full if acquired flag set).
 *   This produces real, state-driven fractions (e.g. 0/12 or 3/12) with zero placeholders.
 * - acquisitionGroups and canonical entries built from the real MissionBlueprintReward sources.
 * - Disabled flags, category etc. all from live data.
 * Reuses existing normalization and key logic. No new data fetching or mutation.
 */
function buildBlueprintRewardViews(
  missions: MissionBlueprintReward[],
  acquiredBlueprintIds: Set<string>,
  completedMissionIds: Set<string>,
): BlueprintRewardView[] {
  const rewardMap = new Map<string, { reward: BlueprintRewardItem; sources: MissionBlueprintReward[] }>();

  for (const mission of missions) {
    for (const reward of mission.rewards) {
      const key = rewardStorageKey(reward);
      if (!rewardMap.has(key)) {
        rewardMap.set(key, { reward, sources: [] });
      }
      const entry = rewardMap.get(key)!;
      if (!entry.sources.some((s) => s.missionId === mission.missionId)) {
        entry.sources.push(mission);
      }
    }
  }

  const views: BlueprintRewardView[] = [];
  for (const [key, { reward, sources }] of rewardMap.entries()) {
    const category = getUiCategory(reward.componentType);
    const isAcquired = acquiredBlueprintIds.has(key);

    const hasDisabledSources = sources.some((s) => !!s.isDisabled);
    const allSourcesDisabled = sources.length > 0 && sources.every((s) => !!s.isDisabled);

    // Canonical consolidation (spec):
    // key = normalized title + faction + type/handler + objective archetype (via rewards) 
    // One Canonical per key; all location variants nested in availabilityEntries.
    // No top-level dup missions for multi-location variants of the same contract.
    function makeCanonicalKey(m: MissionBlueprintReward): string {
      // Inline the normalization (the one in store is not exported; keep behavior identical)
      const rawTitle = m.title || "";
      const title = rawTitle.replace(/~mission\(([^)]+)\)/g, "$1").toLowerCase().trim();
      const fac = (m.factionName || "").toLowerCase().trim();
      const typ = (m.missionType || m.category || "").toLowerCase().trim();
      const rec = m as unknown as Record<string, unknown>;
      const handler = (String(rec.generatorName || rec.debugName || "")).toLowerCase().trim();
      const obj = m.rewards.length ? m.rewards.map((r) => r.displayName).sort().join("|").toLowerCase().slice(0, 64) : "";
      return [title, fac, typ, handler, obj].join("||");
    }

    const canonByKey = new Map<string, { base: MissionBlueprintReward; avails: MissionAvailabilityEntry[] }>();
    for (const src of sources) {
      const ckey = makeCanonicalKey(src);
      if (!canonByKey.has(ckey)) {
        canonByKey.set(ckey, { base: src, avails: [] });
      }
      const entry = canonByKey.get(ckey)!;
      entry.avails.push({
        sourceMissionId: src.missionId,
        system: src.system,
        locationAddress: src.location ?? src.station ?? src.planet,
        disabled: src.isDisabled,
        faction: src.factionName,
        maxStanding: src.maxStanding,
        prerequisiteReputation: src.minStanding,
        reputationReward: src.reputationRewards?.join(", "),
      });
    }

    // Build groups from canonicals (not raw sources)
    const sysToFac = new Map<string, Map<string, CanonicalMissionView[]>>();
    for (const { base: src, avails } of canonByKey.values()) {
      const sys = (src.system || src.location || src.station || src.planet || "Unknown System").toString();
      const fac = src.factionName || "Unknown Faction";
      if (!sysToFac.has(sys)) sysToFac.set(sys, new Map());
      const facMap = sysToFac.get(sys)!;
      if (!facMap.has(fac)) facMap.set(fac, []);
      const canonsForFac = facMap.get(fac)!;

      const status: "available" | "unavailable" | "mixed" =
        avails.every((a) => a.disabled) ? "unavailable" : avails.some((a) => a.disabled) ? "mixed" : "available";

      canonsForFac.push({
        canonicalMissionKey: makeCanonicalKey(src),
        title: src.title,
        description: src.description,
        missionType: src.missionType ?? src.category,
        prerequisiteReputation: src.minStanding,
        reputationReward: src.reputationRewards?.join(", "),
        maxStanding: src.maxStanding,
        status,
        linkedRewards: src.rewards.map((r) => r.displayName),
        availabilityEntries: avails,
      });
    }

    const acquisitionGroups: AcquisitionSystemGroup[] = Array.from(sysToFac.entries()).map(([system, facMap]) => ({
      system,
      factions: Array.from(facMap.entries()).map(([faction, missions]) => ({ faction, missions })),
    }));

    // Re-derive counts from post-consolidation canonicals (real, smaller N possible)
    const canonicalCount = canonByKey.size || 1;
    const completedCanonicals = Array.from(canonByKey.values()).filter(({ avails }) =>
      avails.some((a) => completedMissionIds.has(a.sourceMissionId))
    ).length;
    const finalCollected = isAcquired ? canonicalCount : completedCanonicals;

    views.push({
      rewardId: key,
      name: reward.displayName,
      category,
      type: reward.componentType,
      rarity: reward.grade || reward.itemClass || undefined,
      imageUrl: undefined,
      fallbackIconKey: `${category}-${reward.componentType || "generic"}`,
      collectedCount: finalCollected,
      totalCount: canonicalCount,
      isCollected: isAcquired || finalCollected >= canonicalCount,
      hasDisabledSources,
      allSourcesDisabled,
      acquisitionGroups,
    });
  }

  return views.sort((a, b) => a.name.localeCompare(b.name));
}

function MissionDetailPanel({
  mission,
  onClose,
}: {
  mission: MissionBlueprintReward | null;
  onClose?: () => void;
}) {
  if (!mission) {
    return (
      <div className="bt-detail-panel bt-detail-panel--empty">
        <div className="bt-detail-kicker">Mission Details</div>
        <div className="bt-detail-title">Select a Mission</div>
        <p className="bt-detail-description">
          Use the info control on a mission row to inspect mission data and linked blueprint rewards.
        </p>
      </div>
    );
  }

  const rows = [
    ["Faction", mission.factionName],
    ["Type", mission.missionType ?? mission.category],
    ["Location", mission.location ?? mission.station ?? mission.planet ?? mission.system],
    ["XP", formatValue(mission.xp)],
    ["Prerequisite Reputation", mission.minStanding],
    ["Reputation Reward", mission.reputationRewards.join(", ")],
    ["Max Standing", mission.maxStanding],
  ].filter(([, value]) => Boolean(value));

  return (
    <div className="bt-detail-panel" role="region" aria-label={`Mission details: ${mission.title}`}>
      <div className="bt-detail-head">
        <div>
          <div className="bt-detail-kicker">Mission Details</div>
          <div className="bt-detail-title">
            {mission.isDisabled && <DisabledBadge />}
            <span>{mission.title}</span>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            className="bt-detail-close"
            aria-label="Close mission details"
            onClick={onClose}
          >
            <span aria-hidden="true">x</span>
          </button>
        )}
      </div>

      {mission.description && <p className="bt-detail-description">{mission.description}</p>}

      <div className="bt-detail-grid">
        {rows.map(([label, value]) => (
          <div key={label} className="bt-detail-row">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="bt-detail-section">
        <div className="bt-detail-section-title">Linked Rewards</div>
        {mission.rewards.slice(0, 10).map((reward) => (
          <div key={reward.rewardKey} className="bt-detail-reward">{reward.displayName}</div>
        ))}
      </div>

      <div className="bt-detail-debug">
        ID {mission.missionId}
        {mission.debugName ? ` / ${mission.debugName}` : ""}
        {mission.generatorName ? ` / ${mission.generatorName}` : ""}
      </div>
    </div>
  );
}

function MissionRow({
  mission,
  completed,
  pinned,
  acquiredBlueprintIds,
  expanded,
  selected,
  onToggleCompleted,
  onTogglePinned,
  onToggleAcquired,
  onToggleExpanded,
  onSelectMission,
  onClearSelectedMission,
}: {
  mission: MissionBlueprintReward;
  completed: boolean;
  pinned: boolean;
  acquiredBlueprintIds: Set<string>;
  expanded: boolean;
  selected: boolean;
  onToggleCompleted: (id: string) => void;
  onTogglePinned: (id: string) => void;
  onToggleAcquired: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  onSelectMission: (mission: MissionBlueprintReward) => void;
  onClearSelectedMission: () => void;
}) {
  const acquiredCount = mission.rewards.filter((reward) => acquiredBlueprintIds.has(rewardStorageKey(reward))).length;
  const location = mission.location ?? mission.station ?? mission.planet ?? mission.system ?? "Unknown";

  return (
    <div className={`bt-mission-entry${completed ? " is-completed" : ""}${expanded ? " is-expanded" : ""}${pinned ? " is-pinned" : ""}${selected ? " is-selected" : ""}${mission.isDisabled ? " is-disabled" : ""}`}>
      <div
        className="bt-mission-main"
        role="button"
        tabIndex={0}
        aria-label={`Show ${mission.title} details`}
        onClick={() => onSelectMission(mission)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectMission(mission);
          }
        }}
      >
        <button
          type="button"
          className={`bt-pin-btn${pinned ? " is-active" : ""}`}
          aria-pressed={pinned}
          aria-label={pinned ? `Unpin ${mission.title}` : `Pin ${mission.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePinned(mission.missionId);
          }}
        >
          <span aria-hidden>*</span>
        </button>
        <label
          className="bt-check bt-check--mission"
          aria-label={`Mark ${mission.title} completed`}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={completed}
            onChange={() => onToggleCompleted(mission.missionId)}
          />
          <span aria-hidden />
          <span className="bt-sr-only">Mission completed</span>
        </label>

        <div className="bt-mission-nameblock">
          <div className="bt-mission-title-line">
            {mission.isDisabled && <DisabledBadge />}
            <span className="bt-mission-title">{mission.title}</span>
            <span className={`bt-status ${completed ? "bt-status--done" : "bt-status--open"}`}>
              {completed ? "Completed" : "Open"}
            </span>
          </div>
          <div className="bt-mission-meta">
            {[mission.factionName, mission.missionType ?? mission.category ?? "Unknown type", location].join(" / ")}
          </div>
        </div>

        <div className="bt-mission-count">
          <strong>{acquiredCount} / {mission.rewards.length}</strong>
          <span>Rewards acquired</span>
        </div>

        <button
          type="button"
          className="bt-icon-btn bt-icon-btn--info"
          aria-label={`Show ${mission.title} details`}
          onClick={(e) => {
            e.stopPropagation();
            onSelectMission(mission);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="8.25" />
            <path d="M12 10.75v5" />
            <path d="M12 7.5h.01" />
          </svg>
        </button>
        <button
          type="button"
          className="bt-icon-btn bt-icon-btn--expand"
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${mission.title}` : `Expand ${mission.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpanded(mission.missionId);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d={expanded ? "M7 14l5-5 5 5" : "M7 10l5 5 5-5"} />
          </svg>
        </button>
      </div>

      {selected && (
        <div className="bt-mission-detail-slot">
          <MissionDetailPanel mission={mission} onClose={onClearSelectedMission} />
        </div>
      )}

      {expanded && (
        <div className="bt-reward-list">
          {mission.rewards.map((reward) => {
            const key = rewardStorageKey(reward);
            const acquired = acquiredBlueprintIds.has(key);
            return (
              <div key={reward.rewardKey} className={`bt-reward-row${acquired ? " is-acquired" : ""}`}>
                <label className="bt-check bt-check--small" aria-label={`Mark ${reward.displayName} acquired`}>
                  <input
                    type="checkbox"
                    checked={acquired}
                    onChange={() => onToggleAcquired(key)}
                  />
                  <span aria-hidden />
                  <span className="bt-sr-only">Blueprint acquired</span>
                </label>
                <div className="bt-reward-copy">
                  <div className="bt-reward-name">{reward.displayName}</div>
                  <RewardMeta reward={reward} />
                </div>
                <span className={`bt-reward-state${acquired ? " is-acquired" : ""}`}>
                  {acquired ? "Acquired" : "Unclaimed"}
                </span>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

function MissionFactionGroup({
  factionName,
  missions,
  completedMissionIds,
  pinnedMissionIds,
  acquiredBlueprintIds,
  expandedMissionIds,
  selectedMissionId,
  onToggleCompleted,
  onTogglePinned,
  onToggleAcquired,
  onToggleExpanded,
  onSelectMission,
  onClearSelectedMission,
}: {
  factionName: string;
  missions: MissionBlueprintReward[];
  completedMissionIds: Set<string>;
  pinnedMissionIds: Set<string>;
  acquiredBlueprintIds: Set<string>;
  expandedMissionIds: Set<string>;
  selectedMissionId: string | null;
  onToggleCompleted: (id: string) => void;
  onTogglePinned: (id: string) => void;
  onToggleAcquired: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  onSelectMission: (mission: MissionBlueprintReward) => void;
  onClearSelectedMission: () => void;
}) {
  const [groupExpanded, setGroupExpanded] = useState(false);
  const completedCount = missions.filter((mission) => completedMissionIds.has(mission.missionId)).length;
  const containsSelectedMission = selectedMissionId
    ? missions.some((mission) => mission.missionId === selectedMissionId)
    : false;

  useEffect(() => {
    if (!containsSelectedMission) return;
    queueMicrotask(() => setGroupExpanded(true));
  }, [containsSelectedMission]);

  return (
    <section className={`bt-faction-group${groupExpanded ? " is-expanded" : ""}`}>
      <button
        type="button"
        className="bt-faction-header"
        aria-expanded={groupExpanded}
        onClick={() => setGroupExpanded((value) => !value)}
      >
        <span className="bt-faction-title">
          <span className="bt-faction-name">{factionName}</span>
          <span className="bt-faction-count">{completedCount} / {missions.length} complete</span>
        </span>
        <span className="bt-faction-toggle" aria-hidden>
          <svg viewBox="0 0 24 24">
            <path d={groupExpanded ? "M7 14l5-5 5 5" : "M7 10l5 5 5-5"} />
          </svg>
        </span>
      </button>
      {groupExpanded && (
        <div className="bt-mission-list">
          {missions.map((mission) => (
            <MissionRow
              key={mission.missionId}
              mission={mission}
              completed={completedMissionIds.has(mission.missionId)}
              pinned={pinnedMissionIds.has(mission.missionId)}
              acquiredBlueprintIds={acquiredBlueprintIds}
              expanded={expandedMissionIds.has(mission.missionId)}
              selected={selectedMissionId === mission.missionId}
              onToggleCompleted={onToggleCompleted}
              onTogglePinned={onTogglePinned}
              onToggleAcquired={onToggleAcquired}
              onToggleExpanded={onToggleExpanded}
              onSelectMission={onSelectMission}
              onClearSelectedMission={onClearSelectedMission}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function missionMatchesQuery(mission: MissionBlueprintReward, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    mission.title,
    mission.factionName,
    mission.missionType,
    mission.category,
    mission.location,
    mission.system,
    mission.planet,
    mission.station,
    mission.missionGiver,
    mission.isDisabled ? "disabled" : null,
    ...mission.rewardPools,
    ...mission.rewards.map((reward) => [
      reward.displayName,
      reward.componentType,
      reward.grade,
      reward.itemClass,
      reward.poolName,
    ].filter(Boolean).join(" ")),
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(needle);
}

function MissionTrackerSidebar({
  selectedMission,
  pinnedMissions,
  searchQuery,
  onSearchChange,
  onSelectMission,
  onTogglePinned,
}: {
  selectedMission: MissionBlueprintReward | null;
  pinnedMissions: MissionBlueprintReward[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectMission: (mission: MissionBlueprintReward) => void;
  onTogglePinned: (id: string) => void;
}) {
  return (
    <aside className="bt-sidebar" aria-label="Mission tracker sidebar">
      <div className="bt-sidebar-panel">
        <label className="bt-search-label" htmlFor="bt-mission-search">Search Missions</label>
        <input
          id="bt-mission-search"
          className="bt-search-input"
          type="search"
          value={searchQuery}
          placeholder="Faction, reward, mission..."
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="bt-sidebar-panel">
        <div className="bt-sidebar-heading">
          <span>Pinned Missions</span>
          <span>{pinnedMissions.length}</span>
        </div>
        {pinnedMissions.length === 0 ? (
          <div className="bt-sidebar-empty">Star missions to keep them here.</div>
        ) : (
          <div className="bt-pinned-list">
            {pinnedMissions.map((mission) => (
              <div
                key={mission.missionId}
                className={`bt-pinned-row${selectedMission?.missionId === mission.missionId ? " is-active" : ""}`}
              >
                <button
                  type="button"
                  className="bt-pinned-select"
                  onClick={() => onSelectMission(mission)}
                >
                  <span className="bt-pinned-title">
                    {mission.isDisabled && <DisabledBadge />}
                    <span>{mission.title}</span>
                  </span>
                  <span className="bt-pinned-meta">{mission.factionName} / {mission.rewards.length} rewards</span>
                </button>
                <button
                  type="button"
                  className="bt-pinned-unpin"
                  aria-label={`Unpin ${mission.title}`}
                  onClick={() => onTogglePinned(mission.missionId)}
                >
                  <span aria-hidden="true">*</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function ReverseMissionRow({
  mission,
  bookmarked,
  onToggle,
}: {
  mission: MissionSourceDetail;
  bookmarked: boolean;
  onToggle: (id: string) => void;
}) {
  const chance = formatChance(mission.chance);
  return (
    <div className="bt-library-source-row">
      <button
        type="button"
        className={`bt-star-btn${bookmarked ? " is-active" : ""}`}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? `Remove ${mission.title} source bookmark` : `Bookmark ${mission.title} source`}
        onClick={() => onToggle(mission.id)}
      >
        <span aria-hidden>*</span>
      </button>
      <div>
        <div className="bt-library-source-title">
          {mission.isDisabled && <DisabledBadge />}
          <span>{mission.title}</span>
        </div>
        <div className="bt-library-source-meta">
          {[mission.factionName, mission.poolName ?? mission.subtitle, chance ? `${chance} chance` : null].filter(Boolean).join(" / ")}
        </div>
      </div>
    </div>
  );
}

function LibraryItem({
  entry,
  bookmarkedMissionIds,
  onToggleRecipe,
  onToggleMission,
}: {
  entry: BlueprintTrackerEntry;
  bookmarkedMissionIds: Set<string>;
  onToggleRecipe: (id: string) => void;
  onToggleMission: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasRecipe = entry.sourceTypes.has("recipe");
  const hasMission = entry.sourceTypes.has("mission");

  return (
    <div className={`bt-library-item${expanded ? " is-expanded" : ""}`}>
      <button type="button" className="bt-library-head" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
        <div className="bt-library-nameblock">
          <span className="bt-library-name">{entry.itemName}</span>
          <span className="bt-library-meta">
            {[entry.componentType ?? entry.category, entry.size ? `S${entry.size}` : null, entry.grade, entry.itemClass].filter(Boolean).join(" / ") || "Unknown"}
          </span>
        </div>
        <div className="bt-library-badges">
          {hasRecipe && <span className="bt-badge bt-badge--recipe">Blueprint</span>}
          {hasMission && <span className="bt-badge bt-badge--mission">Sources {entry.missions.length}</span>}
          <span className="bt-library-chevron">{expanded ? "^" : "v"}</span>
        </div>
      </button>

      {expanded && (
        <div className="bt-library-body">
          {entry.recipes.map((recipe) => (
            <div key={recipe.blueprint_id} className="bt-library-source-row">
              <button
                type="button"
                className="bt-star-btn is-active"
                aria-label={`Remove ${recipe.component_name} saved blueprint`}
                onClick={() => onToggleRecipe(recipe.blueprint_id)}
              >
                <span aria-hidden>*</span>
              </button>
              <div>
                <div className="bt-library-source-title">{recipe.component_name}</div>
                <div className="bt-library-source-meta">Saved blueprint recipe</div>
              </div>
            </div>
          ))}
          {entry.missions.map((mission) => (
            <ReverseMissionRow
              key={mission.id}
              mission={mission}
              bookmarked={bookmarkedMissionIds.has(mission.id)}
              onToggle={onToggleMission}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Legacy (kept for adaptability; not used in current default blueprint library render)
const _LibraryFactionGroup = function LibraryFactionGroup({
  factionName,
  entries,
  bookmarkedMissionIds,
  onToggleRecipe,
  onToggleMission,
}: {
  factionName: string;
  entries: BlueprintTrackerEntry[];
  bookmarkedMissionIds: Set<string>;
  onToggleRecipe: (id: string) => void;
  onToggleMission: (id: string) => void;
}) {
  return (
    <section className="bt-faction-group">
      <div className="bt-faction-header">
        <span className="bt-faction-name">{factionName}</span>
        <span className="bt-faction-count">{entries.length}</span>
      </div>
      <div className="bt-library-list">
        {entries.map((entry) => (
          <LibraryItem
            key={`${entry.factionKey}::${entry.itemKey}`}
            entry={entry}
            bookmarkedMissionIds={bookmarkedMissionIds}
            onToggleRecipe={onToggleRecipe}
            onToggleMission={onToggleMission}
          />
        ))}
      </div>
    </section>
  );
}
void _LibraryFactionGroup;

function EmptyState({ mode }: { mode: TrackerMode }) {
  return (
    <div className="bt-empty-state">
      <div className="bt-empty-title">{mode === "missions" ? "No mission rewards found" : "No saved blueprints yet"}</div>
      <div className="bt-empty-body">
        {mode === "missions"
          ? "Mission reward data is unavailable or empty."
          : "Bookmark recipes and mission sources in Crafting to track them here."}
      </div>
    </div>
  );
}

export default function BlueprintTrackerPage() {
  // Default to blueprint-first library per requirements. Old "missions" mode kept only for the loading/empty conditionals (content replaced in follow-up steps).
  const [mode] = useState<TrackerMode>("library");
  const [recipes, setRecipes] = useState<ComponentRecipe[]>([]);
  const [missions, setMissions] = useState<MissionBlueprintReward[]>([]);
  const [missionMap, setMissionMap] = useState<Map<string, MissionSourceDetail[]>>(new Map());
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [missionsLoading, setMissionsLoading] = useState(true);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [missionSearchQuery, setMissionSearchQuery] = useState("");
  // New states for blueprint-first controls (search + chips + toggles). Reuses acquired/completed for real progress.
  const [bpSearchQuery, setBpSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | UiCategory>("all");
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [showDisabledSources, setShowDisabledSources] = useState(true); // default show so disabled are discoverable
  const [trackerTab, setTrackerTab] = useState<TrackerTab>("tracker");
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null); // for blueprint detail panel
  const [selectedArmorSetKey, setSelectedArmorSetKey] = useState<string | null>(null);
  const [selectedArmorVariantKey, setSelectedArmorVariantKey] = useState<string | null>(null);
  const [selectedFpsWeaponKey, setSelectedFpsWeaponKey] = useState<string | null>(null);
  const [expandedMissionIds, setExpandedMissionIds] = useState<Set<string>>(new Set());
  const [completedMissionIds, setCompletedMissionIds] = useState<Set<string>>(
    () => readStoredStringSet(COMPLETED_MISSIONS_STORAGE_KEY),
  );
  const [acquiredBlueprintIds, setAcquiredBlueprintIds] = useState<Set<string>>(
    () => readStoredStringSet(ACQUIRED_BLUEPRINTS_STORAGE_KEY),
  );
  const [pinnedMissionIds, setPinnedMissionIds] = useState<Set<string>>(
    () => readStoredStringSet(PINNED_MISSIONS_STORAGE_KEY),
  );
  const [bookmarkedRecipeIds, setBookmarkedRecipeIds] = useState<Set<string>>(
    () => readStoredStringSet(RECIPE_BOOKMARK_STORAGE_KEY),
  );
  const [bookmarkedMissionIds, setBookmarkedMissionIds] = useState<Set<string>>(
    () => readStoredStringSet(MISSION_BOOKMARK_STORAGE_KEY),
  );
  const { session, loading: authLoading } = useAuthSession();
  const accessToken = session?.access_token;

  const persistTrackerState = useCallback((state: UserBlueprintTrackerState) => {
    writeStoredStringSet(COMPLETED_MISSIONS_STORAGE_KEY, new Set(state.completedMissionIds));
    writeStoredStringSet(ACQUIRED_BLUEPRINTS_STORAGE_KEY, new Set(state.acquiredBlueprintIds));
    writeStoredStringSet(PINNED_MISSIONS_STORAGE_KEY, new Set(state.pinnedMissionIds));
    if (accessToken) {
      saveUserBlueprintTrackerState(accessToken, state).catch(() => {});
    }
  }, [accessToken]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (!session?.access_token && e.key === RECIPE_BOOKMARK_STORAGE_KEY) {
        setBookmarkedRecipeIds(readStoredStringSet(RECIPE_BOOKMARK_STORAGE_KEY));
      }
      if (e.key === MISSION_BOOKMARK_STORAGE_KEY) setBookmarkedMissionIds(readStoredStringSet(MISSION_BOOKMARK_STORAGE_KEY));
      if (e.key === COMPLETED_MISSIONS_STORAGE_KEY) setCompletedMissionIds(readStoredStringSet(COMPLETED_MISSIONS_STORAGE_KEY));
      if (e.key === ACQUIRED_BLUEPRINTS_STORAGE_KEY) setAcquiredBlueprintIds(readStoredStringSet(ACQUIRED_BLUEPRINTS_STORAGE_KEY));
      if (e.key === PINNED_MISSIONS_STORAGE_KEY) setPinnedMissionIds(readStoredStringSet(PINNED_MISSIONS_STORAGE_KEY));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [session?.access_token]);

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) return;
    let cancelled = false;
    fetchSavedBlueprints(accessToken)
      .then((savedBlueprints) => {
        if (!cancelled) setBookmarkedRecipeIds(new Set(savedBlueprints.map((item) => item.blueprintId)));
      })
      .catch(() => {
        if (!cancelled) setBookmarkedRecipeIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    fetchUserBlueprintTrackerState(accessToken)
      .then((state) => {
        if (cancelled || !state) return;
        setCompletedMissionIds(new Set(state.completedMissionIds));
        setAcquiredBlueprintIds(new Set(state.acquiredBlueprintIds));
        setPinnedMissionIds(new Set(state.pinnedMissionIds));
        writeStoredStringSet(COMPLETED_MISSIONS_STORAGE_KEY, new Set(state.completedMissionIds));
        writeStoredStringSet(ACQUIRED_BLUEPRINTS_STORAGE_KEY, new Set(state.acquiredBlueprintIds));
        writeStoredStringSet(PINNED_MISSIONS_STORAGE_KEY, new Set(state.pinnedMissionIds));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    getCraftingItems()
      .then((data) => {
        if (!cancelled) setRecipes(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRecipesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadMissionBlueprintRewards()
      .then((data) => {
        if (!cancelled) setMissions(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setMissionsLoading(false);
      });
    loadMissionDetailMap()
      .then((map) => {
        if (!cancelled) setMissionMap(map);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSourcesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCompletedMission = useCallback((missionId: string) => {
    setCompletedMissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(missionId)) next.delete(missionId);
      else next.add(missionId);
      persistTrackerState({
        completedMissionIds: setToList(next),
        acquiredBlueprintIds: setToList(acquiredBlueprintIds),
        pinnedMissionIds: setToList(pinnedMissionIds),
      });
      return next;
    });
  }, [acquiredBlueprintIds, persistTrackerState, pinnedMissionIds]);

  const toggleAcquiredBlueprint = useCallback((blueprintId: string) => {
    setAcquiredBlueprintIds((prev) => {
      const next = new Set(prev);
      if (next.has(blueprintId)) next.delete(blueprintId);
      else next.add(blueprintId);
      persistTrackerState({
        completedMissionIds: setToList(completedMissionIds),
        acquiredBlueprintIds: setToList(next),
        pinnedMissionIds: setToList(pinnedMissionIds),
      });
      return next;
    });
  }, [completedMissionIds, persistTrackerState, pinnedMissionIds]);

  const toggleExpandedMission = useCallback((missionId: string) => {
    setExpandedMissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(missionId)) next.delete(missionId);
      else next.add(missionId);
      return next;
    });
  }, []);

  const togglePinnedMission = useCallback((missionId: string) => {
    setPinnedMissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(missionId)) next.delete(missionId);
      else next.add(missionId);
      persistTrackerState({
        completedMissionIds: setToList(completedMissionIds),
        acquiredBlueprintIds: setToList(acquiredBlueprintIds),
        pinnedMissionIds: setToList(next),
      });
      return next;
    });
  }, [acquiredBlueprintIds, completedMissionIds, persistTrackerState]);

  const selectMission = useCallback((mission: MissionBlueprintReward) => {
    setSelectedMissionId(mission.missionId);
  }, []);

  const clearSelectedMission = useCallback(() => {
    setSelectedMissionId(null);
  }, []);

  useEffect(() => {
    if (!selectedMissionId) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedMissionId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedMissionId]);

  const toggleRecipe = useCallback(async (recipeId: string) => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      if (hasSupabaseConfig() && !authLoading) {
        await signInWithDiscord();
        return;
      }
      setBookmarkedRecipeIds((prev) => {
        const next = new Set(prev);
        if (next.has(recipeId)) next.delete(recipeId);
        else next.add(recipeId);
        writeStoredStringSet(RECIPE_BOOKMARK_STORAGE_KEY, next);
        return next;
      });
      return;
    }

    const wasSaved = bookmarkedRecipeIds.has(recipeId);
    const recipe = recipes.find((item) => item.blueprint_id === recipeId);
    setBookmarkedRecipeIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(recipeId);
      else next.add(recipeId);
      return next;
    });

    try {
      if (wasSaved) {
        await deleteUserBlueprint(accessToken, recipeId);
      } else {
        await saveUserBlueprint(accessToken, {
          blueprintId: recipeId,
          faction: recipe?.manufacturer,
          itemName: recipe?.component_name,
          sourceType: "blueprint",
        });
      }
    } catch {
      setBookmarkedRecipeIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(recipeId);
        else next.delete(recipeId);
        return next;
      });
    }
  }, [authLoading, bookmarkedRecipeIds, recipes, session?.access_token]);

  const setRecipesTracked = useCallback(async (recipeIds: string[], tracked: boolean) => {
    const uniqueIds = Array.from(new Set(recipeIds.filter(Boolean)));
    if (uniqueIds.length === 0) return;
    const accessToken = session?.access_token;
    if (!accessToken) {
      if (hasSupabaseConfig() && !authLoading) {
        await signInWithDiscord();
        return;
      }
      setBookmarkedRecipeIds((prev) => {
        const next = new Set(prev);
        for (const recipeId of uniqueIds) {
          if (tracked) next.add(recipeId);
          else next.delete(recipeId);
        }
        writeStoredStringSet(RECIPE_BOOKMARK_STORAGE_KEY, next);
        return next;
      });
      return;
    }

    const previous = bookmarkedRecipeIds;
    setBookmarkedRecipeIds((prev) => {
      const next = new Set(prev);
      for (const recipeId of uniqueIds) {
        if (tracked) next.add(recipeId);
        else next.delete(recipeId);
      }
      return next;
    });

    try {
      await Promise.all(uniqueIds.map((recipeId) => {
        if (!tracked) return deleteUserBlueprint(accessToken, recipeId);
        const recipe = recipes.find((item) => item.blueprint_id === recipeId);
        return saveUserBlueprint(accessToken, {
          blueprintId: recipeId,
          faction: recipe?.manufacturer,
          itemName: recipe?.component_name,
          sourceType: "blueprint",
        });
      }));
    } catch {
      setBookmarkedRecipeIds(new Set(previous));
    }
  }, [authLoading, bookmarkedRecipeIds, recipes, session?.access_token]);

  const setBlueprintsCompleted = useCallback((blueprintIds: string[], completed: boolean) => {
    setAcquiredBlueprintIds((prev) => {
      const next = new Set(prev);
      for (const blueprintId of blueprintIds) {
        if (completed) next.add(blueprintId);
        else next.delete(blueprintId);
      }
      persistTrackerState({
        completedMissionIds: setToList(completedMissionIds),
        acquiredBlueprintIds: setToList(next),
        pinnedMissionIds: setToList(pinnedMissionIds),
      });
      return next;
    });
  }, [completedMissionIds, persistTrackerState, pinnedMissionIds]);

  const _toggleMissionBookmark = useCallback((missionId: string) => {
    setBookmarkedMissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(missionId)) next.delete(missionId);
      else next.add(missionId);
      writeStoredStringSet(MISSION_BOOKMARK_STORAGE_KEY, next);
      return next;
    });
  }, []);
  void _toggleMissionBookmark;

  const filteredMissions = useMemo(
    () => missions.filter((mission) => missionMatchesQuery(mission, missionSearchQuery)),
    [missionSearchQuery, missions],
  );

  const missionGroups = useMemo(() => {
    const map = new Map<string, MissionBlueprintReward[]>();
    for (const mission of filteredMissions) {
      const list = map.get(mission.factionName) ?? [];
      list.push(mission);
      map.set(mission.factionName, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([factionName, groupMissions]) => ({
        factionName,
        missions: groupMissions.sort((a, b) => a.title.localeCompare(b.title)),
      }));
  }, [filteredMissions]);

  const missionById = useMemo(() => new Map(missions.map((mission) => [mission.missionId, mission])), [missions]);
  const selectedMission = selectedMissionId ? missionById.get(selectedMissionId) ?? null : null;
  const pinnedMissions = useMemo(
    () => Array.from(pinnedMissionIds)
      .map((missionId) => missionById.get(missionId))
      .filter((mission): mission is MissionBlueprintReward => Boolean(mission))
      .sort((a, b) => a.factionName.localeCompare(b.factionName) || a.title.localeCompare(b.title)),
    [missionById, pinnedMissionIds],
  );

  const trackerEntries = useMemo(
    () => buildTrackerEntries(recipes, bookmarkedRecipeIds, bookmarkedMissionIds, missionMap),
    [recipes, bookmarkedRecipeIds, bookmarkedMissionIds, missionMap],
  );

  const _libraryGroups = useMemo(() => {
    const map = new Map<string, { factionName: string; entries: BlueprintTrackerEntry[] }>();
    for (const entry of trackerEntries) {
      const group = map.get(entry.factionKey);
      if (group) group.entries.push(entry);
      else map.set(entry.factionKey, { factionName: entry.factionName, entries: [entry] });
    }
    return Array.from(map.values());
  }, [trackerEntries]);
  void _libraryGroups;

  // Wire the new blueprint-first VM layer using the exact same live data + state the page already loads.
  // This makes the symbols "used" for TS and proves the derivation is fully connected to real inputs.
  // Result not yet rendered (next step). All numbers inside are computed, never faked.
  const blueprintRewardViews = useMemo(
    () => buildBlueprintRewardViews(missions, acquiredBlueprintIds, completedMissionIds),
    [missions, acquiredBlueprintIds, completedMissionIds],
  );
  const armorSetGroups = useMemo(() => buildArmorSetGroups(blueprintRewardViews), [blueprintRewardViews]);
  const fpsWeaponFamilies = useMemo(() => buildFpsWeaponFamilies(blueprintRewardViews), [blueprintRewardViews]);
  const groupedFpsRewardIds = useMemo(
    () => new Set(fpsWeaponFamilies.flatMap((family) => [
      ...family.variants.map((variant) => variant.reward.rewardId),
      ...family.relatedParts.map((part) => part.reward.rewardId),
    ])),
    [fpsWeaponFamilies],
  );
  const groupedArmorRewardIds = useMemo(
    () => new Set(armorSetGroups.flatMap((group) => group.variants.flatMap((variant) => variant.pieces.map((piece) => piece.reward.rewardId)))),
    [armorSetGroups],
  );
  const trackerItems = useMemo<TrackerItemView[]>(() => {
    const items: TrackerItemView[] = [];
    const getBestSource = (rewards: BlueprintRewardView[]) => {
      const source = rewards[0]?.acquisitionGroups[0]?.factions[0]?.missions[0];
      return source ? source.title : "Unknown source";
    };
    for (const group of armorSetGroups) {
      const rewards = group.variants.flatMap((variant) => variant.pieces.map((piece) => piece.reward));
      items.push({
        id: `armor:${group.baseSetKey}`,
        name: `${group.displayName} Armor Set`,
        category: "armorSet",
        typeLabel: `${group.variants.length} ${group.variants.length === 1 ? "variant" : "variants"}`,
        memberIds: rewards.map((reward) => reward.rewardId),
        collectedCount: rewards.filter((reward) => reward.isCollected).length,
        totalCount: rewards.length,
        sourceCount: rewards.reduce((sum, reward) => sum + reward.totalCount, 0),
        bestSource: getBestSource(rewards),
        searchText: group.searchText,
        allSourcesDisabled: group.allSourcesDisabled,
        open: () => {
          setSelectedRewardId(null);
          setSelectedFpsWeaponKey(null);
          setSelectedArmorSetKey(group.baseSetKey);
          setSelectedArmorVariantKey(group.variants[0]?.variantKey ?? null);
        },
      });
    }
    for (const group of fpsWeaponFamilies) {
      const rewards = [...group.variants.map((variant) => variant.reward), ...group.relatedParts.map((part) => part.reward)];
      items.push({
        id: `fps:${group.baseWeaponKey}`,
        name: group.displayName,
        category: "fpsWeapon",
        typeLabel: `${group.variants.length} ${group.variants.length === 1 ? "variant" : "variants"}`,
        memberIds: rewards.map((reward) => reward.rewardId),
        collectedCount: rewards.filter((reward) => reward.isCollected).length,
        totalCount: rewards.length,
        sourceCount: rewards.reduce((sum, reward) => sum + reward.totalCount, 0),
        bestSource: getBestSource(rewards),
        searchText: group.searchText,
        allSourcesDisabled: group.allSourcesDisabled,
        open: () => {
          setSelectedRewardId(null);
          setSelectedArmorSetKey(null);
          setSelectedFpsWeaponKey(group.baseWeaponKey);
        },
      });
    }
    for (const reward of blueprintRewardViews) {
      if (groupedArmorRewardIds.has(reward.rewardId) || groupedFpsRewardIds.has(reward.rewardId)) continue;
      items.push({
        id: reward.rewardId,
        name: reward.name,
        category: reward.category,
        typeLabel: reward.type || CATEGORY_LABEL[reward.category],
        memberIds: [reward.rewardId],
        collectedCount: reward.isCollected ? 1 : 0,
        totalCount: 1,
        sourceCount: reward.totalCount,
        bestSource: getBestSource([reward]),
        searchText: `${reward.name} ${reward.type || ""} ${reward.fallbackIconKey}`.toLowerCase(),
        allSourcesDisabled: reward.allSourcesDisabled,
        open: () => {
          setSelectedArmorSetKey(null);
          setSelectedFpsWeaponKey(null);
          setSelectedRewardId(reward.rewardId);
        },
      });
    }
    const representedIds = new Set(items.flatMap((item) => item.memberIds));
    for (const recipe of recipes) {
      if (representedIds.has(recipe.blueprint_id)) continue;
      const category = getUiCategory(recipe.component_type);
      items.push({
        id: recipe.blueprint_id,
        name: recipe.component_name,
        category,
        typeLabel: recipe.component_type || CATEGORY_LABEL[category],
        memberIds: [recipe.blueprint_id],
        collectedCount: acquiredBlueprintIds.has(recipe.blueprint_id) ? 1 : 0,
        totalCount: 1,
        sourceCount: missionMap.get(recipe.blueprint_id)?.length ?? 0,
        bestSource: missionMap.get(recipe.blueprint_id)?.[0]?.title ?? "Unknown source",
        searchText: `${recipe.component_name} ${recipe.component_type} ${recipe.manufacturer || ""}`.toLowerCase(),
        allSourcesDisabled: false,
        open: () => {
          setSelectedArmorSetKey(null);
          setSelectedFpsWeaponKey(null);
          setSelectedRewardId(recipe.blueprint_id);
        },
      });
    }
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [acquiredBlueprintIds, armorSetGroups, blueprintRewardViews, fpsWeaponFamilies, groupedArmorRewardIds, groupedFpsRewardIds, missionMap, recipes]);

  const isItemTracked = useCallback(
    (item: TrackerItemView) => item.memberIds.some((id) => bookmarkedRecipeIds.has(id)),
    [bookmarkedRecipeIds],
  );
  const isItemComplete = useCallback(
    (item: TrackerItemView) => item.memberIds.length > 0 && item.memberIds.every((id) => acquiredBlueprintIds.has(id)),
    [acquiredBlueprintIds],
  );
  const trackedItems = trackerItems.filter(isItemTracked);
  const completedItems = trackedItems.filter(isItemComplete);
  const activeTrackedItems = trackedItems.filter((item) => !isItemComplete(item));
  const visibleTrackerItems = (trackerTab === "browse" ? trackerItems : trackerTab === "completed" ? completedItems : activeTrackedItems)
    .filter((item) => activeCategory === "all" || item.category === activeCategory)
    .filter((item) => !bpSearchQuery.trim() || item.searchText.includes(bpSearchQuery.trim().toLowerCase()))
    .filter((item) => trackerTab !== "browse" || !showMissingOnly || !isItemComplete(item))
    .filter((item) => showDisabledSources || !item.allSourcesDisabled);
  const selectedTrackerItem = trackerItems.find((item) => {
    if (selectedArmorSetKey) return item.id === `armor:${selectedArmorSetKey}`;
    if (selectedFpsWeaponKey) return item.id === `fps:${selectedFpsWeaponKey}`;
    return selectedRewardId ? item.memberIds.includes(selectedRewardId) : false;
  }) ?? null;
  const selectedDetailRewards = selectedTrackerItem
    ? blueprintRewardViews.filter((reward) => selectedTrackerItem.memberIds.includes(reward.rewardId))
    : [];
  void toggleRecipe;

  const missionRewardCount = missions.reduce((sum, mission) => sum + mission.rewards.length, 0);
  const isLoading = mode === "missions" ? missionsLoading : recipesLoading || sourcesLoading;
  // For library (blueprint) view use the real derived unique count; keeps EmptyState wiring intact.
  const isEmpty = !isLoading && (mode === "missions" ? missions.length === 0 : blueprintRewardViews.length === 0);

  if (mode === "library") return (
    <div className="bt-page bt-preference-tracker">
      <div className="bt-shell">
        <header className="bt-page-header">
          <div className="bt-page-title-row">
            <h1 className="bt-page-title">Blueprint Tracker</h1>
            <span className="bt-page-count">{missions.length} missions / {missionRewardCount} rewards</span>
          </div>
          <div className="bt-tabs" role="tablist" aria-label="Blueprint tracker views">
            {([
              ["tracker", "My Tracker", activeTrackedItems.length],
              ["browse", "Browse Blueprints", trackerItems.length],
              ["completed", "Completed", completedItems.length],
            ] as const).map(([key, label, count]) => (
              <button key={key} type="button" role="tab" aria-selected={trackerTab === key} className={`bt-tab${trackerTab === key ? " is-active" : ""}`} onClick={() => setTrackerTab(key)}>
                {label} <span>{count}</span>
              </button>
            ))}
          </div>
        </header>

        <section className="bt-tracker-stats" aria-label="Tracker summary">
          <div className="is-tracked"><i><BlueprintFallbackIcon category="other" /></i><span>Tracked</span><strong>{trackedItems.length}</strong></div>
          <div className="is-missing"><i><BlueprintFallbackIcon category="shipWeapon" /></i><span>Missing</span><strong>{activeTrackedItems.length}</strong></div>
          <div className="is-complete"><i><BlueprintFallbackIcon category="component" type="power" /></i><span>Completed</span><strong>{completedItems.length}</strong></div>
          <div className="is-category"><i><BlueprintFallbackIcon category="armorSet" /></i><span>Categories</span><strong>{new Set(trackedItems.map((item) => item.category)).size}</strong></div>
        </section>

        <div className="bp-controls bt-tracker-controls">
          <input className="bp-search" type="search" value={bpSearchQuery} placeholder={trackerTab === "browse" ? "Search blueprint catalog..." : "Search tracked blueprints..."} onChange={(event) => setBpSearchQuery(event.target.value)} />
          <div className="bp-chips" role="tablist" aria-label="Blueprint categories">
            {[{ key: "all" as const, label: "All" }, ...CATEGORY_ORDER.map((key) => ({ key, label: CATEGORY_LABEL[key] }))].map((chip) => (
              <button key={chip.key} type="button" className={`bp-chip${activeCategory === chip.key ? " is-active" : ""}`} onClick={() => setActiveCategory(chip.key)}>{chip.label}</button>
            ))}
          </div>
          {trackerTab === "browse" && <div className="bp-toggles"><button type="button" className={`bp-toggle${showMissingOnly ? " is-active" : ""}`} onClick={() => setShowMissingOnly((value) => !value)}>Missing only</button><button type="button" className={`bp-toggle${showDisabledSources ? " is-active" : ""}`} onClick={() => setShowDisabledSources((value) => !value)}>Show disabled sources</button></div>}
        </div>

        {isLoading && <div className="bt-loading">Loading blueprint data...</div>}
        {!isLoading && isEmpty && <EmptyState mode={mode} />}
        {!isLoading && !isEmpty && (
          <div className={`bt-tracker-workspace${selectedTrackerItem ? " has-detail" : ""}`}>
            <main className="bt-tracked-list">
              {visibleTrackerItems.length === 0 ? (
                <div className="bt-empty-state"><div className="bt-empty-title">{trackerTab === "browse" ? "No matching blueprints" : trackerTab === "completed" ? "No completed blueprints" : "Nothing tracked yet"}</div><div className="bt-empty-body">{trackerTab === "tracker" ? "Browse the catalog and track blueprints to build your active queue." : "Adjust the search or category filters."}</div>{trackerTab === "tracker" && <button className="bt-action bt-action--primary" type="button" onClick={() => setTrackerTab("browse")}>Browse Blueprints</button>}</div>
              ) : visibleTrackerItems.map((item) => {
                const tracked = isItemTracked(item);
                const complete = isItemComplete(item);
                const partial = item.collectedCount > 0 && !complete;
                const progress = item.totalCount ? Math.round((item.collectedCount / item.totalCount) * 100) : 0;
                return (
                  <article key={item.id} className={`bt-tracked-card${selectedTrackerItem?.id === item.id ? " is-selected" : ""}${complete ? " is-complete" : partial ? " is-partial" : ""}`}>
                    <button className="bt-tracked-card-main" type="button" onClick={item.open}>
                      <span className="bt-tracked-icon"><BlueprintFallbackIcon category={item.category} type={item.typeLabel} status={item.allSourcesDisabled ? "unavailable" : complete ? "collected" : "default"} /></span>
                      <span className="bt-tracked-copy"><strong>{item.name}</strong><span>{item.typeLabel}</span></span>
                      <span className="bt-tracked-category"><span>Category</span><strong>{CATEGORY_LABEL[item.category]}</strong></span>
                      <span className="bt-tracked-progress"><span>Progress</span><strong>{item.collectedCount} / {item.totalCount}</strong><i><b style={{ width: `${progress}%` }} /></i></span>
                      <span className="bt-tracked-source"><span>Sources</span><strong>{item.sourceCount || "Unknown"}</strong><small>{item.bestSource}</small></span>
                      <span className={`bt-tracked-status is-${complete ? "complete" : partial ? "partial" : "tracking"}`}>{complete ? "Complete" : partial ? "Partial" : tracked ? "Tracking" : "Not tracked"}</span>
                    </button>
                    <div className="bt-tracked-actions"><button className="bt-action" type="button" onClick={item.open}>View Details</button>{tracked && <button className="bt-action bt-action--positive" type="button" onClick={() => setBlueprintsCompleted(item.memberIds, !complete)}>{complete ? "Reopen" : "Mark Complete"}</button>}<button className={`bt-action${tracked ? " bt-action--danger" : " bt-action--primary"}`} type="button" onClick={() => void setRecipesTracked(item.memberIds, !tracked)}>{tracked ? "Untrack" : "Track Blueprint"}</button></div>
                  </article>
                );
              })}
            </main>

            {selectedTrackerItem && (
              <aside className="bt-tracker-detail">
                <header className="bt-tracker-detail-head"><div><span>{CATEGORY_LABEL[selectedTrackerItem.category]}</span><h2>{selectedTrackerItem.name}</h2><p>{selectedTrackerItem.typeLabel}</p></div><div className="bt-tracker-detail-head-actions"><button className={`bt-action${isItemTracked(selectedTrackerItem) ? " bt-action--danger" : " bt-action--primary"}`} type="button" onClick={() => void setRecipesTracked(selectedTrackerItem.memberIds, !isItemTracked(selectedTrackerItem))}>{isItemTracked(selectedTrackerItem) ? "Untrack" : "Track Blueprint"}</button>{isItemTracked(selectedTrackerItem) && <button className="bt-action bt-action--positive" type="button" onClick={() => setBlueprintsCompleted(selectedTrackerItem.memberIds, !isItemComplete(selectedTrackerItem))}>{isItemComplete(selectedTrackerItem) ? "Reopen" : "Mark Complete"}</button>}<button className="bt-detail-close-action" type="button" onClick={() => { setSelectedRewardId(null); setSelectedArmorSetKey(null); setSelectedFpsWeaponKey(null); }} aria-label="Close details">x</button></div></header>
                <section className="bt-detail-summary-strip"><div><span>Progress</span><strong>{selectedTrackerItem.collectedCount} / {selectedTrackerItem.totalCount}</strong></div><div><span>Sources</span><strong>{selectedTrackerItem.sourceCount}</strong></div><div><span>Status</span><strong>{isItemComplete(selectedTrackerItem) ? "Complete" : isItemTracked(selectedTrackerItem) ? "Tracking" : "Not tracked"}</strong></div></section>
                {selectedArmorSetKey && (() => {
                  const group = armorSetGroups.find((item) => item.baseSetKey === selectedArmorSetKey);
                  const variant = group?.variants.find((item) => item.variantKey === selectedArmorVariantKey) ?? group?.variants[0];
                  if (!group || !variant) return null;
                  return <section className="bt-detail-section"><h3>Variants</h3><div className="bp-variant-chips">{group.variants.map((item) => <button key={item.variantKey} type="button" className={`bp-variant-chip${variant.variantKey === item.variantKey ? " is-active" : ""}`} onClick={() => setSelectedArmorVariantKey(item.variantKey)}>{item.displayName} <span>{item.collectedPieces}/{item.totalPieces}</span></button>)}</div><div className="bp-family-list">{variant.pieces.map((piece) => <button key={piece.reward.rewardId} type="button" className="bp-family-row" onClick={() => { setSelectedArmorSetKey(null); setSelectedRewardId(piece.reward.rewardId); }}><span className="bp-family-row-copy"><strong>{piece.reward.name}</strong><span>{piece.pieceType}</span></span><span className={`bp-family-state${piece.reward.isCollected ? " is-collected" : ""}`}>{piece.reward.isCollected ? "Complete" : "Inspect"}</span></button>)}</div></section>;
                })()}
                <section className="bt-detail-section">
                  <h3>Blueprint Sources</h3>
                  <p>Grouped by system, faction, and mission family. Expand a source to inspect its variants.</p>
                  <div className="bt-source-groups">
                    {selectedDetailRewards.flatMap((reward) =>
                      reward.acquisitionGroups.flatMap((systemGroup) =>
                        systemGroup.factions.flatMap((factionGroup) =>
                          factionGroup.missions.map((mission) => (
                            <details key={`${reward.rewardId}-${systemGroup.system}-${factionGroup.faction}-${mission.canonicalMissionKey}`} className="bt-source-group">
                              <summary>
                                <span><strong>{factionGroup.faction} - {mission.title}</strong><small>{systemGroup.system} / {mission.availabilityEntries.length} variants</small></span>
                                <span>{mission.maxStanding || "Unknown standing"}</span>
                              </summary>
                              <div className="bt-source-variants">
                                {mission.availabilityEntries.map((entry) => (
                                  <div key={entry.sourceMissionId}>
                                    <strong>{entry.system || systemGroup.system}</strong>
                                    <span>{entry.locationAddress || mission.missionType || "Unknown location"}</span>
                                    <span className={entry.disabled ? "is-disabled" : "is-available"}>{entry.disabled ? "Unavailable" : "Available"}</span>
                                    <span>{entry.maxStanding || mission.maxStanding || "Unknown standing"}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          ))
                        )
                      )
                    )}
                  </div>
                </section>
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );

  /* Preserved mission-mode render below; the preference tracker is the default library mode. */
  return (
    <div className="bt-page">
      <div className="bt-shell">
        <header className="bt-page-header">
          <div className="bt-page-title-row">
            <h1 className="bt-page-title">BLUEPRINT TRACKER</h1>
            {/* Real stats only — computed from loaded data (no fakes/placeholders) */}
            <span className="bt-page-count">
              {missions.length} MISSIONS / {missionRewardCount} REWARDS
            </span>
          </div>
          {/* No mission-first subtitle or tabs — blueprint library is the primary/default view */}
        </header>

        {/* Blueprint-first controls: full-width search + category chips with *real* counts derived from blueprintRewardViews.
            All numbers (total, per-category) come from the VM (unique rewards + category mapper on actual componentType).
            No placeholders. Search matches name/type (extendable to faction/mission later via groups). */}
        <div className="bp-controls">
          <input
            className="bp-search"
            type="search"
            value={bpSearchQuery}
            placeholder="Search blueprints by name, type, faction, mission, or keyword..."
            onChange={(e) => setBpSearchQuery(e.target.value)}
            aria-label="Search blueprints"
          />
          <div className="bp-chips" role="tablist" aria-label="Blueprint categories">
            {(() => {
              const q = bpSearchQuery.trim().toLowerCase();
              const rawVisible = blueprintRewardViews.filter((v) => {
                if (v.category === "armorSet" || groupedFpsRewardIds.has(v.rewardId)) return false;
                if (q && !(v.name + " " + (v.type || "") + " " + v.fallbackIconKey).toLowerCase().includes(q)) return false;
                if (showMissingOnly && v.isCollected) return false;
                if (!showDisabledSources && v.allSourcesDisabled) return false;
                return true;
              });
              const visibleArmor = armorSetGroups.filter((group) =>
                (!q || group.searchText.includes(q))
                && (!showMissingOnly || group.collectedPieces < group.totalPieces)
                && (showDisabledSources || !group.allSourcesDisabled)
              );
              const visibleFps = fpsWeaponFamilies.filter((group) =>
                (!q || group.searchText.includes(q))
                && (!showMissingOnly || group.collectedRewards < group.totalRewards)
                && (showDisabledSources || !group.allSourcesDisabled)
              );
              const counts: Record<"all" | UiCategory, number> = {
                all: rawVisible.length + visibleArmor.length + visibleFps.length,
                armorSet: visibleArmor.length,
                fpsWeapon: visibleFps.length,
                shipWeapon: 0,
                component: 0,
                other: 0,
              };
              for (const v of rawVisible) counts[v.category]++;
              const chips = [
                { key: "all" as const, label: "ALL", count: counts.all },
                ...CATEGORY_ORDER.map((c) => ({ key: c, label: CATEGORY_LABEL[c], count: counts[c] })),
              ];
              return chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === chip.key}
                  className={`bp-chip${activeCategory === chip.key ? " is-active" : ""}`}
                  onClick={() => setActiveCategory(chip.key)}
                >
                  {chip.label} <span className="bp-chip-count">{chip.count}</span>
                </button>
              ));
            })()}
          </div>
          <div className="bp-toggles">
            <button
              type="button"
              className={`bp-toggle${showMissingOnly ? " is-active" : ""}`}
              onClick={() => setShowMissingOnly((v) => !v)}
              title="Show only blueprints with incomplete collection progress"
            >
              Missing only
            </button>
            <button
              type="button"
              className={`bp-toggle${showDisabledSources ? " is-active" : ""}`}
              onClick={() => setShowDisabledSources((v) => !v)}
              title="Include missions currently marked unavailable due to patches"
            >
              Show disabled sources
            </button>
          </div>
        </div>

        {isLoading && <div className="bt-loading">Loading blueprint data...</div>}
        {isEmpty && <EmptyState mode={mode} />}

        {!isLoading && !isEmpty && mode === "missions" && (
          <div className="bt-tracker-layout">
            <div className="bt-faction-list">
              {missionGroups.length === 0 ? (
                <div className="bt-empty-state bt-empty-state--compact">
                  <div className="bt-empty-title">No matching missions</div>
                  <div className="bt-empty-body">Try searching by another faction, mission, or reward name.</div>
                </div>
              ) : (
                missionGroups.map((group) => (
                  <MissionFactionGroup
                    key={group.factionName}
                    factionName={group.factionName}
                    missions={group.missions}
                    completedMissionIds={completedMissionIds}
                    pinnedMissionIds={pinnedMissionIds}
                    acquiredBlueprintIds={acquiredBlueprintIds}
                    expandedMissionIds={expandedMissionIds}
                    selectedMissionId={selectedMissionId}
                    onToggleCompleted={toggleCompletedMission}
                    onTogglePinned={togglePinnedMission}
                    onToggleAcquired={toggleAcquiredBlueprint}
                    onToggleExpanded={toggleExpandedMission}
                    onSelectMission={selectMission}
                    onClearSelectedMission={clearSelectedMission}
                  />
                ))
              )}
            </div>
            <MissionTrackerSidebar
              selectedMission={selectedMission}
              pinnedMissions={pinnedMissions}
              searchQuery={missionSearchQuery}
              onSearchChange={setMissionSearchQuery}
              onSelectMission={selectMission}
              onTogglePinned={togglePinnedMission}
            />
          </div>
        )}

        {false && !isLoading && !isEmpty && (
          <div className={`bp-workspace${selectedRewardId || selectedArmorSetKey || selectedFpsWeaponKey ? " has-detail" : ""}`}>
            <main className="bp-library-content bp-library-scroll">
              {/* Grouped category sections matching the screenshot (full width default; left in split when detail open) */}
              <div className="bp-sections">
                {(() => {
                  const q = bpSearchQuery.trim().toLowerCase();
                  const vis = blueprintRewardViews.filter((v) => {
                    if (v.category === "armorSet" || groupedFpsRewardIds.has(v.rewardId)) return false;
                    if (q) {
                      const hay = (v.name + " " + (v.type || "") + " " + v.fallbackIconKey).toLowerCase();
                      if (!hay.includes(q)) return false;
                    }
                    if (showMissingOnly && v.isCollected) return false;
                    if (!showDisabledSources && v.allSourcesDisabled) return false;
                    if (activeCategory !== "all" && v.category !== activeCategory) return false;
                    return true;
                  });
                  const visibleArmor = armorSetGroups.filter((group) =>
                    (!q || group.searchText.includes(q))
                    && (!showMissingOnly || group.collectedPieces < group.totalPieces)
                    && (showDisabledSources || !group.allSourcesDisabled)
                    && (activeCategory === "all" || activeCategory === "armorSet")
                  );
                  const visibleFps = fpsWeaponFamilies.filter((group) =>
                    (!q || group.searchText.includes(q))
                    && (!showMissingOnly || group.collectedRewards < group.totalRewards)
                    && (showDisabledSources || !group.allSourcesDisabled)
                    && (activeCategory === "all" || activeCategory === "fpsWeapon")
                  );

                  if (vis.length === 0 && visibleArmor.length === 0 && visibleFps.length === 0) {
                    return <div className="bp-empty">No matching blueprints. Clear filters or search.</div>;
                  }

                  const byCat = new Map<UiCategory, BlueprintRewardView[]>();
                  for (const v of vis) {
                    const arr = byCat.get(v.category) || [];
                    arr.push(v);
                    byCat.set(v.category, arr);
                  }

                  return CATEGORY_ORDER.map((cat) => {
                    const items = byCat.get(cat) || [];
                    const groupedCount = cat === "armorSet" ? visibleArmor.length : cat === "fpsWeapon" ? visibleFps.length : 0;
                    if (items.length === 0 && groupedCount === 0) return null;
                    const label = CATEGORY_LABEL[cat];

                    const limit = items.length;
                    const visibleItems = items.slice(0, limit);

                    return (
                      <section key={cat} className="bp-category-section">
                        <div className="bp-section-header">
                          <span className="icon"><BlueprintFallbackIcon category={cat} /></span>
                          <span>{label}</span>
                          <span className="count">{items.length + groupedCount}</span>
                        </div>
                        <div className="bp-section-panel">
                          <div className={`bp-cards${cat === "fpsWeapon" ? " bp-cards--weapons" : ""}`}>
                            {cat === "armorSet" && visibleArmor.map((group) => {
                              const pct = group.totalPieces > 0 ? Math.round((group.collectedPieces / group.totalPieces) * 100) : 0;
                              return (
                                <div
                                  key={group.baseSetKey}
                                  className={`bp-card${group.collectedPieces === group.totalPieces ? " is-collected" : ""}${group.allSourcesDisabled ? " is-unavailable" : ""}`}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => {
                                    setSelectedRewardId(null);
                                    setSelectedFpsWeaponKey(null);
                                    setSelectedArmorSetKey(group.baseSetKey);
                                    setSelectedArmorVariantKey(group.variants[0]?.variantKey ?? null);
                                  }}
                                  onKeyDown={(event) => { if (event.key === "Enter") setSelectedArmorSetKey(group.baseSetKey); }}
                                >
                                  <div className="bp-card-icon">
                                    <BlueprintFallbackIcon category="armorSet" status={group.allSourcesDisabled ? "unavailable" : group.collectedPieces === group.totalPieces ? "collected" : "default"} />
                                  </div>
                                  <div className="bp-card-body">
                                    <div className="bp-card-name">{group.displayName} Armor Set</div>
                                    <div className="bp-card-sub">{group.variants.length} {group.variants.length === 1 ? "variant" : "variants"}</div>
                                    <div className="bp-card-progress">{group.collectedPieces} / {group.totalPieces} pieces collected</div>
                                    <div className="bp-progress-track"><div className="bp-progress-fill" style={{ width: `${pct}%` }} /></div>
                                    {group.allSourcesDisabled && <div className="bp-unavail-badge">Unavailable</div>}
                                  </div>
                                </div>
                              );
                            })}
                            {cat === "fpsWeapon" && visibleFps.map((group) => {
                              const pct = group.totalRewards > 0 ? Math.round((group.collectedRewards / group.totalRewards) * 100) : 0;
                              return (
                                <div
                                  key={group.baseWeaponKey}
                                  className={`bp-card${group.collectedRewards === group.totalRewards ? " is-collected" : ""}${group.allSourcesDisabled ? " is-unavailable" : ""}`}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => {
                                    setSelectedRewardId(null);
                                    setSelectedArmorSetKey(null);
                                    setSelectedFpsWeaponKey(group.baseWeaponKey);
                                  }}
                                  onKeyDown={(event) => { if (event.key === "Enter") setSelectedFpsWeaponKey(group.baseWeaponKey); }}
                                >
                                  <div className="bp-card-icon">
                                    <BlueprintFallbackIcon category="fpsWeapon" type={group.weaponType} status={group.allSourcesDisabled ? "unavailable" : group.collectedRewards === group.totalRewards ? "collected" : "default"} />
                                  </div>
                                  <div className="bp-card-body">
                                    <div className="bp-card-name">{group.displayName}</div>
                                    <div className="bp-card-sub">{group.weaponType} / {group.variants.length} variants{group.relatedParts.length ? ` / ${group.relatedParts.length} parts` : ""}</div>
                                    <div className="bp-card-progress">{group.collectedRewards} / {group.totalRewards} rewards collected</div>
                                    <div className="bp-progress-track"><div className="bp-progress-fill" style={{ width: `${pct}%` }} /></div>
                                    {group.allSourcesDisabled && <div className="bp-unavail-badge">Unavailable</div>}
                                  </div>
                                </div>
                              );
                            })}
                            {visibleItems.map((v) => {
                              const pct = v.totalCount > 0 ? Math.round((v.collectedCount / v.totalCount) * 100) : 0;
                              return (
                                <div
                                  key={v.rewardId}
                                  className={`bp-card${v.isCollected ? " is-collected" : ""}${v.allSourcesDisabled ? " is-unavailable" : ""}`}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => { setSelectedArmorSetKey(null); setSelectedFpsWeaponKey(null); setSelectedRewardId(v.rewardId); }}
                                  onKeyDown={(e) => { if (e.key === "Enter") setSelectedRewardId(v.rewardId); }}
                                >
                                  <div className="bp-card-icon" title={v.fallbackIconKey}>
                                    {v.imageUrl ? <img src={v.imageUrl} alt="" /> : <BlueprintFallbackIcon category={v.category} type={v.type} subtype={v.subtype || v.name} status={v.allSourcesDisabled ? "unavailable" : v.isCollected ? "collected" : "default"} />}
                                  </div>
                                  <div className="bp-card-body">
                                    <div className="bp-card-name">{v.name}</div>
                                    <div className="bp-card-sub">{v.type || v.category}</div>
                                    <div className="bp-card-progress">{v.collectedCount} / {v.totalCount} collected</div>
                                    <div className="bp-progress-track"><div className="bp-progress-fill" style={{width: pct + '%'}} /></div>
                                    {v.allSourcesDisabled && <div className="bp-unavail-badge">UNAVAILABLE</div>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </section>
                    );
                  });
                })()}
              </div>
            </main>

            {selectedArmorSetKey && (() => {
              const group = armorSetGroups.find((item) => item.baseSetKey === selectedArmorSetKey)!;
              if (!group) return null;
              const variant = group.variants.find((item) => item.variantKey === selectedArmorVariantKey) ?? group.variants[0];
              return (
                <aside className="bp-detail-panel">
                  <div className="bp-detail-header">
                    <div className="detail-kicker">Armor Set Details</div>
                    <div className="detail-title-row">
                    <span className="name">{group.displayName} Armor Set</span>
                    <button className="close-btn" type="button" onClick={() => setSelectedArmorSetKey(null)} aria-label="Close armor set details">x</button>
                    </div>
                  </div>
                  <div className="bp-detail-content">
                    <div className="bp-detail-card bp-family-summary">{group.collectedPieces} / {group.totalPieces} pieces collected across {group.variants.length} variants</div>
                    <div className="bp-detail-card bp-variant-chips">
                      {group.variants.map((item) => (
                        <button key={item.variantKey} type="button" className={`bp-variant-chip${variant?.variantKey === item.variantKey ? " is-active" : ""}`} onClick={() => setSelectedArmorVariantKey(item.variantKey)}>
                          {item.displayName} <span>{item.collectedPieces}/{item.totalPieces}</span>
                        </button>
                      ))}
                    </div>
                    <div className="bp-detail-card bp-family-list">
                      {variant?.pieces.map((piece) => (
                        <button key={piece.reward.rewardId} type="button" className="bp-family-row" onClick={() => { setSelectedArmorSetKey(null); setSelectedRewardId(piece.reward.rewardId); }}>
                          <span className="bp-family-row-icon"><BlueprintFallbackIcon category="armorSet" subtype={piece.pieceType} status={piece.reward.allSourcesDisabled ? "unavailable" : piece.reward.isCollected ? "collected" : "default"} /></span>
                          <span className="bp-family-row-copy"><strong>{piece.reward.name}</strong><span>{piece.pieceType} / {piece.reward.collectedCount} of {piece.reward.totalCount} sources complete</span></span>
                          <span className={`bp-family-state${piece.reward.isCollected ? " is-collected" : ""}`}>{piece.reward.isCollected ? "Collected" : "Inspect"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </aside>
              );
            })()}

            {selectedFpsWeaponKey && (() => {
              const group = fpsWeaponFamilies.find((item) => item.baseWeaponKey === selectedFpsWeaponKey)!;
              if (!group) return null;
              return (
                <aside className="bp-detail-panel">
                  <div className="bp-detail-header">
                    <div className="detail-kicker">FPS Weapon Family</div>
                    <div className="detail-title-row">
                      <span className="name">{group.displayName}</span>
                      <button className="close-btn" type="button" onClick={() => setSelectedFpsWeaponKey(null)} aria-label="Close weapon family details">x</button>
                    </div>
                  </div>
                  <div className="bp-detail-content">
                    <div className="bp-detail-card bp-family-summary">{group.collectedRewards} / {group.totalRewards} rewards collected</div>
                    <div className="bp-detail-card bp-family-list">
                      {[...group.variants.map((item) => ({ label: item.displayName, kind: "Variant", reward: item.reward })), ...group.relatedParts.map((item) => ({ label: item.reward.name, kind: item.partType, reward: item.reward }))].map((item) => (
                        <button key={item.reward.rewardId} type="button" className="bp-family-row" onClick={() => { setSelectedFpsWeaponKey(null); setSelectedRewardId(item.reward.rewardId); }}>
                          <span className="bp-family-row-icon"><BlueprintFallbackIcon category="fpsWeapon" type={item.kind === "Variant" ? group.weaponType : item.kind} status={item.reward.allSourcesDisabled ? "unavailable" : item.reward.isCollected ? "collected" : "default"} /></span>
                          <span className="bp-family-row-copy"><strong>{item.label}</strong><span>{item.kind} / {item.reward.name}</span></span>
                          <span className={`bp-family-state${item.reward.isCollected ? " is-collected" : ""}`}>{item.reward.isCollected ? "Collected" : "Inspect"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </aside>
              );
            })()}

            {/* Right detail panel (only when selected). Exact structure from the referenced screenshot: BLUEPRINT DETAILS header, back, name, badge, Track, close, media, description, BLUEPRINT PROGRESS with checklist, Quick Info, warning, Where to Acquire structured entries, consolidated table. */}
            {selectedRewardId && (() => {
              const v = blueprintRewardViews.find((x) => x.rewardId === selectedRewardId)!;
              if (!v) return null;
              const missionsForProgress = v.acquisitionGroups.flatMap(g => g.factions.flatMap(f => f.missions));
              const locationRows = v.acquisitionGroups.flatMap((group) =>
                group.factions.flatMap((faction) =>
                  faction.missions.map((mission) => ({ ...mission, system: group.system, faction: faction.faction }))
                )
              );

              return (
                <aside className="bp-detail-panel">
                  <div className="bp-detail-header">
                    <button className="back" type="button" onClick={() => setSelectedRewardId(null)}>Back to Results</button>
                    <div className="detail-title-row">
                      <span className="name">{v.name}</span>
                      <button className="track-btn" type="button" onClick={() => {}}>Track Blueprint</button>
                      <button className="close-btn" type="button" onClick={() => setSelectedRewardId(null)} aria-label="Close blueprint details">x</button>
                    </div>
                  </div>

                  <div className="bp-detail-content">
                    <section className="bp-detail-card bp-detail-summary">
                      <div className="media-area">
                        {v.imageUrl
                          ? <img src={v.imageUrl} alt="" />
                          : <BlueprintFallbackIcon category={v.category} type={v.type} subtype={v.subtype || v.name} status={v.allSourcesDisabled ? "unavailable" : v.isCollected ? "collected" : "default"} />}
                      </div>
                      <div className="bp-detail-summary-copy">
                        <div className="bp-detail-badges">
                          <span className="bp-detail-badge">{CATEGORY_LABEL[v.category]}</span>
                          {v.type && <span className="bp-detail-badge">{v.type}</span>}
                          {v.rarity && <span className="bp-detail-badge is-rarity">{v.rarity}</span>}
                          <span className={`bp-detail-badge${v.isCollected ? " is-collected" : ""}`}>{v.isCollected ? "Collected" : "In Progress"}</span>
                        </div>
                        <p className="description">{v.description || "Blueprint reward with mission-linked acquisition sources."}</p>
                      </div>
                    </section>

                    <section className="bp-detail-card">
                      <div className="bp-detail-section-title">Blueprint Progress</div>
                      <div className="bp-detail-progress-row"><strong>{v.collectedCount} / {v.totalCount}</strong><span>sources completed</span></div>
                      <div className="bp-progress-track"><div className="bp-progress-fill" style={{ width: `${v.totalCount ? Math.round((v.collectedCount / v.totalCount) * 100) : 0}%` }} /></div>
                      <div className="progress-list">
                        {missionsForProgress.map((mission) => (
                          <div key={mission.canonicalMissionKey}>
                            <span className={`bp-progress-check${v.isCollected ? " is-complete" : ""}`} aria-hidden>{v.isCollected ? "x" : ""}</span>
                            <span>{mission.title}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    {(v.allSourcesDisabled || v.hasDisabledSources) && (
                      <div className={`warning-banner${v.allSourcesDisabled ? " is-unavailable" : ""}`}>
                        <strong>{v.allSourcesDisabled ? "All sources unavailable" : "Some sources unavailable"}</strong>
                        <span>{v.allSourcesDisabled ? "Every known mission source is currently disabled." : "At least one mission source is currently disabled."}</span>
                      </div>
                    )}

                    <section className="bp-detail-section">
                      <div className="bp-detail-section-title">Where to Acquire</div>
                      <div className="bp-acquisition-list">
                        {v.acquisitionGroups.flatMap((group) => group.factions.flatMap((faction) => faction.missions.map((mission) => (
                          <article key={`${group.system}-${faction.faction}-${mission.canonicalMissionKey}`} className="acquire-entry">
                            <div className="bp-acquire-head"><strong>{mission.title}</strong><span className={`status is-${mission.status}`}>{mission.status}</span></div>
                            <dl className="bp-acquire-grid">
                              <div><dt>System</dt><dd>{group.system}</dd></div>
                              <div><dt>Faction</dt><dd>{faction.faction}</dd></div>
                              <div><dt>Mission Type</dt><dd>{mission.missionType || "Unknown"}</dd></div>
                              <div><dt>Max Standing</dt><dd>{mission.maxStanding || "Unknown"}</dd></div>
                              <div><dt>Reputation Reward</dt><dd>{mission.reputationReward || "Unknown"}</dd></div>
                            </dl>
                          </article>
                        ))))}
                      </div>
                    </section>

                    <section className="bp-detail-card">
                      <div className="bp-detail-section-title">Mission Locations</div>
                      <div className="locations-table">
                        <table>
                          <thead><tr><th>System</th><th>Faction</th><th>Mission</th><th>Status</th><th>Max Standing</th></tr></thead>
                          <tbody>
                            {locationRows.map((row) => (
                              <tr key={`${row.system}-${row.faction}-${row.canonicalMissionKey}`}>
                                <td data-label="System">{row.system}</td>
                                <td data-label="Faction">{row.faction}</td>
                                <td data-label="Mission">{row.title}</td>
                                <td data-label="Status"><span className={`status is-${row.status}`}>{row.status}</span></td>
                                <td data-label="Max Standing">{row.maxStanding || "Unknown"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <section className="bp-detail-section">
                      <div className="bp-detail-section-title">Mission Details</div>
                      <div className="bp-mission-accordions">
                        {missionsForProgress.map((mission) => (
                          <details key={mission.canonicalMissionKey} className="bp-mission-accordion">
                            <summary><span>{mission.title}</span><span className={`status is-${mission.status}`}>{mission.status}</span></summary>
                            <div className="bp-mission-accordion-body">
                              <p>{mission.description || "No mission description available."}</p>
                              <div><strong>Linked rewards:</strong> {mission.linkedRewards.join(", ") || "Unknown"}</div>
                              <div><strong>Prerequisite reputation:</strong> {mission.prerequisiteReputation || "Unknown"}</div>
                            </div>
                          </details>
                        ))}
                      </div>
                    </section>

                    <div className="bp-detail-source-note">Duplicates consolidated from processed mission reward sources.</div>
                  </div>
                </aside>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
