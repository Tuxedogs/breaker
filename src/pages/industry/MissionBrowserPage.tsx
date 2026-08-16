import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  hasMissionConceptBookmark,
  hasMissionOfferBookmark,
  MISSION_BOOKMARK_STORAGE_KEY,
  missionConceptBookmarkId,
  missionOfferBookmarkId,
  missionRewardSourceBookmarkId,
  readStoredStringSet,
  writeStoredStringSet,
} from "@/components/industry/crafting/utils/blueprintTrackerStore";
import {
  evaluateMissionVariantEligibility,
  loadMissionConceptVariants,
  loadMissionData,
  loadMissionOfferVariants,
  loadMissionVariantDetail,
  solveMissionVariantPrerequisitePath,
  type BlueprintRewardGroupView,
  type MissionBrowserCatalog,
  type MissionFamilyView,
  type MissionEligibilityPayload,
  type MissionPathPayload,
  type MissionConceptView,
  type MissionOfferView,
  type MissionOfferReputationRewardFacetView,
  type MissionPrerequisiteView,
  type MissionRequiredItemEvidenceView,
  type MissionRewardView,
  type MissionRewardedReputationPathView,
  type MissionVariantView,
  type PlayerMissionStateView,
} from "@/lib/missionData";
import { missionOfferMatchesClientFilters } from "@/lib/missionOfferCompatibility";
import {
  MISSION_BROWSER_PATH,
  missionConceptKeyFromSlug,
  missionConceptPath,
  missionConceptSlug,
  resolveLegacyMissionConcept,
} from "@/lib/missionUrls";
import "@/components/industry/crafting/recipe-browser.css";
import "./mission-browser.css";

const MAX_VISIBLE_VARIANTS = 8;
const CONCEPTS_PER_PAGE = 12;
const OFFERS_PER_PAGE = 12;

type RewardFilter = "blueprints" | "reputation" | "credits-fixed" | "credits-calculated" | "credits-variable" | "credits-formula-unresolved" | "credits-unresolved" | "credits-none" | "items" | "items-unresolved";
type ConfidenceFilter = "unresolved" | "locations" | "rewards" | "crime-bounded" | "unlawful";
type BrowserView = "full" | "faction" | "reputation";

function missionOfferProvider(offer: MissionOfferView): string {
  return offer.provider.displayText?.trim()
    || offer.provider.displayRaw?.replace(/^@/, "").trim()
    || offer.providerKey
    || "Unknown provider";
}

function missionVerificationLabel(status: MissionOfferView["verificationStatus"]): string {
  if (status === "verified") return "Verified";
  if (status === "unverified") return "Unverified";
  return "Verification unknown";
}

function offerReputationAmountLabel(facet: MissionOfferReputationRewardFacetView): string {
  const { amountSummary } = facet;
  const minimum = amountSummary.minAmount;
  const maximum = amountSummary.maxAmount;
  if (minimum === undefined || maximum === undefined) return "Reward amount unresolved";
  if (amountSummary.status === "partial") {
    const observed = minimum === maximum
      ? signedAmount(minimum)
      : `${signedAmount(minimum)} to ${signedAmount(maximum)}`;
    return `${observed} observed; partial`;
  }
  if (minimum === maximum) return signedAmount(minimum);
  return `${signedAmount(minimum)} to ${signedAmount(maximum)}`;
}

function offerReputationFilterLabel(facet: MissionOfferReputationRewardFacetView): string {
  const faction = facet.factionDisplayName.trim();
  const scope = shortRepScope(facet.scopeDisplayName);
  if (!faction || /^unknown(?: faction)?$/i.test(faction)) return scope;
  return `${faction} / ${scope}`;
}

function stripSummaryPrefix(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length).trim() : value;
}

function signedAmount(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "unresolved";
  return `${value >= 0 ? "+" : ""}${value.toLocaleString()}`;
}

function shortRepScope(value: string): string {
  return value
    .replace(/\bReputation\b/gi, "")
    .replace(/\bPath\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || value;
}

function repScopeDescription(value: string): string {
  const label = shortRepScope(value);
  const text = label.toLowerCase();
  if (text.includes("haul")) return "Earn Hauling reputation through cargo operations.";
  if (text.includes("ship combat") || text.includes("combat") || text.includes("mercenary")) return "Earn Ship Combat reputation through combat operations.";
  if (text.includes("bounty")) return "Earn Bounty reputation through hunting targets.";
  if (text.includes("salvage")) return "Earn Salvage reputation through recovery operations.";
  if (text.includes("standing")) return "Earn Standing reputation through lawful operations.";
  return `Earn ${label} reputation through available operations.`;
}

function factionInitials(value: string): string {
  const words = value.replace(/[^a-z0-9\s]/gi, " ").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "??";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function repScopeClass(value?: string): string {
  const text = (value ?? "").toLowerCase();
  if (text.includes("haul")) return "mission-rep-scope--hauling";
  if (text.includes("ship combat") || text.includes("combat") || text.includes("mercenary")) return "mission-rep-scope--ship-combat";
  if (text.includes("salvage")) return "mission-rep-scope--salvage";
  if (text.includes("security")) return "mission-rep-scope--security";
  if (text.includes("bounty")) return "mission-rep-scope--bounty";
  if (text.includes("courier")) return "mission-rep-scope--courier";
  if (text.includes("refuel")) return "mission-rep-scope--refuel";
  if (text.includes("standing") || text.includes("wikelo") || text.includes("favor")) return "mission-rep-scope--standing";
  if (text.includes("mixed")) return "mission-rep-scope--mixed";
  return "mission-rep-scope--unknown";
}

function ReputationPathIcon({ scope }: { scope: string }) {
  const label = shortRepScope(scope);
  const text = label.toLowerCase();
  if (text.includes("haul")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 7.5 8-3.5 8 3.5v9L12 20 4 16.5v-9Z" />
        <path d="M4 7.5 12 11l8-3.5M12 11v9" />
        <path d="m8.5 9.4 8-3.5" />
      </svg>
    );
  }
  if (text.includes("combat") || text.includes("mercenary")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="6.5" />
        <circle cx="12" cy="12" r="2.2" />
        <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
      </svg>
    );
  }
  if (text.includes("bounty")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 10.5 6.8 7.2l2.7 1.2M16 10.5l1.2-3.3-2.7 1.2" />
        <path d="M7.5 12.2c0-3 1.8-5 4.5-5s4.5 2 4.5 5c0 2.5-1.5 4.4-4.5 4.4s-4.5-1.9-4.5-4.4Z" />
        <path d="M9.2 18.5h5.6M10 13.3h.1M14 13.3h.1M11 15.2h2" />
        <path d="M5.2 17.5 3 21M18.8 17.5 21 21" />
      </svg>
    );
  }
  if (text.includes("salvage")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m6 6 4 4M10 6l-4 4M14.5 5.5 18 9l-8 8-3.5.8.8-3.5 8-8Z" />
        <path d="m15 14 3 3M17 12l3 3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5 19 7v5.2c0 4.1-2.8 7.2-7 8.3-4.2-1.1-7-4.2-7-8.3V7l7-3.5Z" />
      <path d="m9 12 2 2 4-5" />
    </svg>
  );
}

function repPathLabel(path: MissionRewardedReputationPathView, includeFaction = false): string {
  if (path.confidence === "unresolved") return "Rep reward unresolved";
  const prefix = includeFaction ? `${path.factionDisplayName} ` : "";
  return `${prefix}${shortRepScope(path.scopeDisplayName)} ${signedAmount(path.amount)}`;
}

function repPathSummary(paths: MissionRewardedReputationPathView[]): string {
  if (!paths.length) return "Rep reward unresolved";
  const unresolved = paths.filter((path) => path.confidence === "unresolved").length;
  const byScope = new Map<string, MissionRewardedReputationPathView[]>();
  for (const path of paths.filter((path) => path.confidence !== "unresolved")) {
    byScope.set(path.scopeKey, [...(byScope.get(path.scopeKey) ?? []), path]);
  }
  if (byScope.size > 1) return "Mixed rep paths";
  const scopePaths = Array.from(byScope.values())[0];
  if (!scopePaths?.length) return `Rep reward unresolved${unresolved ? ` (${unresolved})` : ""}`;
  const amounts = scopePaths.map((path) => path.amount).filter((value): value is number => typeof value === "number");
  const min = amounts.length ? Math.min(...amounts) : undefined;
  const max = amounts.length ? Math.max(...amounts) : undefined;
  const amount = min === undefined ? "unresolved" : min === max ? signedAmount(min) : `${signedAmount(min)} to ${signedAmount(max)}`;
  return `${shortRepScope(scopePaths[0]!.scopeDisplayName)} ${amount}${unresolved ? `; ${unresolved} unresolved` : ""}`;
}

function primaryRepScope(paths: MissionRewardedReputationPathView[], fallback: string): string {
  const resolved = paths.filter((path) => path.confidence !== "unresolved");
  const scopes = Array.from(new Set(resolved.map((path) => path.scopeDisplayName)));
  if (scopes.length > 1) return "Mixed";
  return scopes[0] ?? fallback;
}

function variantDifficulty(variant: MissionVariantView): string {
  const text = [variant.displayName, variant.internalName, variant.rawName].filter(Boolean).join(" ");
  const rank = text.match(/\bRank\s*([0-9IVX]+)\b/i)?.[0];
  const difficulty = text.match(/\b(Very Easy|Very Hard|Easy|Medium|Hard|Super)\b/i)?.[0];
  return rank ?? difficulty ?? "Varies";
}

const AUEC_REWARD_NOT_REPORTED = "aUEC reward not reported";

function playerFacingCreditReward(reward: MissionRewardView): string {
  const detail = reward.creditsDetail;
  const currency = detail?.currency?.toUpperCase();
  const payout = detail?.payout;
  if (
    reward.creditStatus === "calculated"
    && payout?.calculationStatus === "resolved"
    && typeof payout.baseSoloAmount === "number"
    && Number.isFinite(payout.baseSoloAmount)
  ) {
    return `${payout.baseSoloAmount.toLocaleString()} ${payout.currency || "aUEC"} base / solo`;
  }
  if (reward.creditStatus === "fixed" && typeof detail?.amount === "number" && Number.isFinite(detail.amount)) {
    return `${detail.amount.toLocaleString()} ${detail.currency || "aUEC"}`;
  }
  if (reward.creditStatus === "fixed" && currency && currency !== "UEC" && currency !== "AUEC") return reward.credits;
  return AUEC_REWARD_NOT_REPORTED;
}

function MissionFactIcon({ label }: { label: string }) {
  const normalized = label.toLowerCase();
  if (normalized.includes("active")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  if (normalized.includes("exact")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="6" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      </svg>
    );
  }
  if (normalized.includes("pickup")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9h16l-1 9H5L4 9Z" />
        <path d="M7 9V6h10v3M9 13h6" />
      </svg>
    );
  }
  if (normalized.includes("payout")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M14.5 8.5h-4a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4h-4M12 6.5v2M12 16.5v2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 7 8-4 8 4v10l-8 4-8-4V7Z" />
      <path d="m4 7 8 4 8-4M12 11v10" />
    </svg>
  );
}

function playerFacingBriefing(value: string): string {
  return value.replace(/\[([A-Za-z][A-Za-z0-9 _.-]*)\]/g, (_match, token: string) => {
    const normalized = token.toLowerCase();
    if (normalized.includes("location") || normalized.includes("destination")) return "an unresolved location";
    if (normalized.includes("target")) return "an unresolved target";
    return "an unresolved mission detail";
  });
}

function groupCreditSummary(variants: MissionVariantView[]): string {
  const rewards = Array.from(new Set(variants.map((variant) => playerFacingCreditReward(variant.rewards))));
  return rewards.length === 1 ? rewards[0]! : "Rewards vary by variant";
}

function groupPickupSummary(family: MissionFamilyView, variants: MissionVariantView[]): string {
  const labels = Array.from(new Set(variants.map((variant) => pickupLabel(variant.pickupLocation))));
  const unresolvedCount = family.pickupUnresolvedCount;
  const coverage = stripSummaryPrefix(family.pickupSummary, "Pickup:");
  if (unresolvedCount === variants.length && unresolvedCount > 0) return `Pickup unresolved for ${unresolvedCount} variants`;
  if (labels.length > 1) return `Pickup varies by variant: ${coverage}`;
  if (unresolvedCount > 0) return `${coverage}; unresolved for ${unresolvedCount} variant${unresolvedCount === 1 ? "" : "s"}`;
  return coverage;
}

function groupStandingSummary(variants: MissionVariantView[]): string {
  const values = Array.from(new Set(variants.map((variant) => variant.standingRequirement).filter((value) => value && value !== "No extracted standing requirement")));
  if (!values.length) return "No standing range extracted";
  if (values.length === 1) return values[0]!;
  return `${values[0]} -> ${values[values.length - 1]}${values.length > 2 ? ` (+${values.length - 2} more)` : ""}`;
}

function cardCreditSummary(variants: MissionVariantView[]): string {
  return groupCreditSummary(variants);
}

function conceptFamilies(concept: MissionConceptView, familiesByKey: Map<string, MissionFamilyView>): MissionFamilyView[] {
  return concept.familyKeys.map((familyKey) => familiesByKey.get(familyKey)).filter((family): family is MissionFamilyView => Boolean(family));
}

function conceptCreditSummary(concept: MissionConceptView, familiesByKey: Map<string, MissionFamilyView>): string {
  const statuses = Array.from(new Set(conceptFamilies(concept, familiesByKey).flatMap((family) => family.creditRewardStatuses ?? [])));
  if (!statuses.length) return AUEC_REWARD_NOT_REPORTED;
  if (statuses.includes("fixed")) return "aUEC reward reported";
  if (statuses.includes("variable")) return "aUEC reward varies";
  if (statuses.includes("unresolved") || statuses.includes("formula_unresolved")) return "aUEC reward unresolved";
  return AUEC_REWARD_NOT_REPORTED;
}

function conceptBlueprintCount(concept: MissionConceptView, familiesByKey: Map<string, MissionFamilyView>): number {
  return new Set(conceptFamilies(concept, familiesByKey).flatMap((family) => family.blueprintRewardGroups.map((group) => group.poolGuid ?? group.poolName))).size;
}

function conceptHasItemRewards(concept: MissionConceptView, familiesByKey: Map<string, MissionFamilyView>): boolean {
  return conceptFamilies(concept, familiesByKey).some((family) => family.itemRewardStatus && family.itemRewardStatus !== "none");
}

function readableSystemLabel(value?: string): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes("stanton")) return "Stanton";
  if (normalized.includes("pyro")) return "Pyro";
  if (normalized.includes("nyx")) return "Nyx";
  return undefined;
}

function familyPickupDisplayLabel(family: MissionFamilyView): string {
  return family.locationRoles?.pickup?.grouping?.displayLabel
    || family.locationRoles?.pickup?.displayLabel
    || stripSummaryPrefix(family.pickupSummary, "Pickup:")
    || "Unknown / unresolved";
}

function conceptPickupBadges(concept: MissionConceptView, familiesByKey: Map<string, MissionFamilyView>): string[] {
  const systems = Array.from(new Set(conceptFamilies(concept, familiesByKey)
    .map((family) => familyPickupDisplayLabel(family))
    .filter((value): value is string => Boolean(value))));
  return systems.length ? systems : ["Unknown / unresolved"];
}

function conceptPickupSummary(concept: MissionConceptView, familiesByKey: Map<string, MissionFamilyView>): string {
  const systems = conceptPickupBadges(concept, familiesByKey);
  if (systems.length === 1) return `Pickup: ${systems[0]}`;
  const visible = systems.slice(0, 3);
  return `Across ${visible.join(", ")}${systems.length > visible.length ? ` +${systems.length - visible.length}` : ""}`;
}

function explicitVariantRegion(variant: MissionVariantView): string | undefined {
  const poolRegion = variant.rewards.blueprintRewardGroups
    .map((group) => group.poolName.match(/\bRegion\s+([A-Z0-9]+)\b/i)?.[0])
    .find(Boolean);
  if (poolRegion) return poolRegion;
  return variant.internalName?.match(/(?:^|_)Region([A-Z0-9]+)(?:_|$)/i)?.[1]
    ? `Region ${variant.internalName.match(/(?:^|_)Region([A-Z0-9]+)(?:_|$)/i)?.[1]?.toUpperCase()}`
    : undefined;
}

function expansionGroupKey(variant: MissionVariantView): string {
  return readableVariantRegion(variant);
}

function readableVariantRegion(variant: MissionVariantView): string {
  const normalizedPickup = variant.locationRoles?.pickup;
  if (normalizedPickup?.primarySystem) return normalizedPickup.primarySystem;
  if (normalizedPickup?.grouping?.displayLabel) return normalizedPickup.grouping.displayLabel;
  const pickup = variant.pickupLocation;
  const candidates = [
    pickup.system,
    pickup.displayName,
    pickup.localityPool,
    pickup.parentLocation,
    ...(pickup.possibleLocations ?? []),
    ...variant.locations,
  ];
  for (const candidate of candidates) {
    const system = readableSystemLabel(candidate);
    if (system) return system;
  }
  return "Unknown / unresolved";
}

function variantRegionSortOrder(label: string): number {
  const order: Record<string, number> = {
    Stanton: 10,
    Pyro: 20,
    Nyx: 30,
    "Unknown / unresolved": 999,
  };
  return order[label] ?? 500;
}

function tierDisplayOrder(tierKey: string): number {
  const normalized = tierKey.toLowerCase();
  const namedOrder: Record<string, number> = {
    veryeasy: 10,
    easy: 20,
    medium: 30,
    hard: 40,
    veryhard: 50,
    super: 60,
    vlrt: 10,
    lrt: 20,
    mrt: 30,
    hrt: 40,
    vhrt: 50,
    ert: 60,
    srt: 70,
    unclassified: 1000,
  };
  if (namedOrder[normalized] !== undefined) return namedOrder[normalized];
  const rank = Number.parseInt(normalized.replace(/^rank-/, ""), 10);
  return Number.isFinite(rank) ? 100 + rank : 900;
}

function normalizedText(value?: string): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizedValues(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)).map(normalizedText))).sort();
}

function variantObjectiveSignature(variant: MissionVariantView) {
  return (variant as MissionVariantView & {
    objectiveSignature?: {
      key?: string;
      activityKey?: string;
      archetype?: string;
      contractType?: string;
      introState?: string;
      chainState?: string;
      legalState?: string;
    };
  }).objectiveSignature;
}

function playerFacingEquivalenceKey(variant: MissionVariantView): string {
  const objectiveSignature = variantObjectiveSignature(variant);
  return JSON.stringify({
    title: normalizedText(variant.displayName),
    briefing: normalizedText(variant.briefing),
    tier: normalizedText(variant.tierLabel ?? variant.tierKey),
    objective: {
      key: normalizedText(objectiveSignature?.key),
      activity: normalizedText(objectiveSignature?.activityKey ?? variant.missionArchetype),
      archetype: normalizedText(objectiveSignature?.archetype ?? variant.missionArchetype),
      contractType: normalizedText(objectiveSignature?.contractType ?? variant.contractType),
      introState: normalizedText(objectiveSignature?.introState),
      chainState: normalizedText(objectiveSignature?.chainState),
      legalState: normalizedText(objectiveSignature?.legalState),
    },
    missionType: normalizedText(variant.missionType),
    contractType: normalizedText(variant.contractType),
    specificityBadges: normalizedValues(variant.specificityBadges ?? []),
    pickup: {
      status: variant.pickupLocation.status,
      displayName: normalizedText(variant.pickupLocation.displayName),
      system: normalizedText(variant.pickupLocation.system),
      parentLocation: normalizedText(variant.pickupLocation.parentLocation),
      locationType: normalizedText(variant.pickupLocation.locationType),
      localityPool: normalizedText(variant.pickupLocation.localityPool),
      regions: normalizedValues(variant.pickupLocation.regions ?? []),
      specificPickup: normalizedText(variant.pickupLocation.specificPickup ?? undefined),
      possibleLocations: normalizedValues(variant.pickupLocation.possibleLocations),
      unresolvedRefs: normalizedValues(variant.pickupLocation.unresolvedRefs),
    },
    locations: normalizedValues(variant.locations),
    unresolvedLocationTokens: normalizedValues(variant.unresolvedLocationTokens),
    standingRequirement: normalizedText(variant.standingRequirement),
    reputationRequirement: normalizedText(variant.reputationRequirement),
    prerequisites: variant.prerequisites.map((item) => ({
      type: item.type,
      label: normalizedText(item.label),
      confidence: item.confidence,
      rawType: normalizedText(item.rawType),
    })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    rewards: {
      creditStatus: variant.rewards.creditStatus,
      credits: normalizedText(variant.rewards.credits),
      blueprintGroups: variant.rewards.blueprintRewardGroups.map((group) => ({
        poolGuid: group.poolGuid ?? "",
        poolName: normalizedText(group.poolName),
        chanceLabel: normalizedText(group.chanceLabel),
        rewards: group.rewards.map((reward) => ({
          blueprintGuid: reward.blueprintGuid ?? "",
          displayName: normalizedText(reward.displayName),
          chanceLabel: normalizedText(reward.chanceLabel),
        })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      itemRewards: (variant.rewards.itemRewards ?? []).map((reward) => ({
        status: reward.status,
        entityClass: reward.entityClass ?? "",
        itemKey: reward.itemKey ?? "",
        amount: reward.amount ?? null,
        displayName: normalizedText(reward.displayName),
        deliveryTarget: reward.deliveryTarget ?? "unknown",
        ownerOnly: reward.ownerOnly ?? false,
      })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      itemRewardStatus: variant.rewards.itemRewardStatus ?? "none",
      unresolvedRewardTokens: normalizedValues(variant.rewards.unresolvedRewardTokens),
    },
    reputationPaths: variant.rewardedReputationPaths.map((path) => ({
      factionKey: path.factionKey,
      scopeKey: path.scopeKey,
      amount: path.amount ?? null,
      xp: path.xp ?? null,
      confidence: path.confidence,
    })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    isIntro: variant.isIntro ?? false,
    flags: normalizedValues(variant.flags),
    releaseFlags: normalizedValues(variant.releaseFlags),
    lawfulClassification: variant.lawfulClassification,
    lawfulConfidence: variant.lawfulConfidence,
    crimeStatRequirement: variant.crimeStatRequirement,
  });
}

function playerFacingDifferenceLabels(groups: MissionVariantView[][]): string[] {
  if (groups.length < 2) return [];
  const representatives = groups.map((group) => group[0]!);
  const differs = (read: (variant: MissionVariantView) => unknown) => new Set(representatives.map((variant) => JSON.stringify(read(variant)))).size > 1;
  return [
    differs((variant) => [normalizedText(variant.displayName), normalizedText(variant.briefing)]) ? "Different briefing" : undefined,
    differs((variant) => [variant.pickupLocation.status, variant.pickupLocation.displayName, variant.pickupLocation.system, variant.pickupLocation.localityPool, explicitVariantRegion(variant)]) ? "Different pickup" : undefined,
    differs((variant) => variant.rewards.blueprintRewardGroups.map((group) => group.poolGuid ?? group.poolName)) ? "Different blueprint pool" : undefined,
    differs((variant) => variant.standingRequirement) ? "Different standing requirement" : undefined,
    differs((variant) => variant.rewardedReputationPaths.map((path) => [path.factionKey, path.scopeKey, path.amount, path.xp])) ? "Different reputation reward" : undefined,
    differs((variant) => [variant.rewards.creditStatus, variant.rewards.credits, variant.rewards.itemRewards, variant.rewards.itemRewardStatus]) ? "Different reward pool" : undefined,
    differs((variant) => [variant.lawfulClassification, variant.lawfulConfidence, variant.crimeStatRequirement]) ? "Different legal status" : undefined,
    differs((variant) => [variantObjectiveSignature(variant), variant.missionArchetype, variant.missionType, variant.contractType, variant.isIntro, variant.flags, variant.releaseFlags]) ? "Different objective / behavior" : undefined,
    differs((variant) => variant.prerequisites.map((item) => [item.type, item.label, item.confidence, item.rawType])) ? "Different prerequisites" : undefined,
  ].filter((value): value is string => Boolean(value));
}

function variantCompletenessScore(variant: MissionVariantView): number {
  return [
    variant.briefing,
    variant.pickupLocation.system,
    variant.pickupLocation.localityPool,
    explicitVariantRegion(variant),
    variant.standingRequirement,
    variant.reputationRequirement,
    variant.rewards.credits,
    variant.rewards.blueprintRewardGroups.length ? "blueprints" : undefined,
    variant.rewards.itemRewards?.length ? "items" : undefined,
    variant.prerequisites.length ? "prerequisites" : undefined,
    variant.locations.length ? "locations" : undefined,
  ].filter(Boolean).length;
}

function variantTabBaseLabel(variants: MissionVariantView[]): string {
  if (variants.length > 1) return `${variants.length} equivalent variants`;
  const variant = variants[0]!;
  return variant.displayName || explicitVariantRegion(variant) || variant.rewards.blueprintRewardGroups[0]?.poolName || "Variant";
}

function VariantTabs({
  variants,
}: {
  variants: MissionVariantView[];
}) {
  const equivalentGroups = useMemo(() => Array.from(variants.reduce((groups, variant) => {
    const key = playerFacingEquivalenceKey(variant);
    groups.set(key, [...(groups.get(key) ?? []), variant]);
    return groups;
  }, new Map<string, MissionVariantView[]>()).values())
    .sort((a, b) => variantCompletenessScore(b[0]!) - variantCompletenessScore(a[0]!)), [variants]);
  const [selectedKey, setSelectedKey] = useState(() => equivalentGroups[0]?.[0]?.variantKey ?? "");
  const selectedGroup = useMemo(
    () => equivalentGroups.find((group) => group[0]?.variantKey === selectedKey) ?? equivalentGroups[0],
    [equivalentGroups, selectedKey],
  );
  const selectedVariant = selectedGroup?.[0];
  const differenceLabels = useMemo(() => playerFacingDifferenceLabels(equivalentGroups), [equivalentGroups]);
  const duplicateLabels = useMemo(() => equivalentGroups.reduce((counts, group) => {
    const label = variantTabBaseLabel(group);
    counts.set(label, (counts.get(label) ?? 0) + 1);
    return counts;
  }, new Map<string, number>()), [equivalentGroups]);
  const showVariantTabs = equivalentGroups.length > 1;
  const showVariantSummary = differenceLabels.length > 0 || (!showVariantTabs && selectedGroup.length > 1);

  if (!selectedVariant || !selectedGroup) return null;
  return (
    <div className="mission-variant-tabs">
      {showVariantTabs && (
        <div className="mission-variant-tabs__list" role="tablist" aria-label="Mission variants">
          {equivalentGroups.map((group) => {
            const representative = group[0]!;
            const baseLabel = variantTabBaseLabel(group);
            const distinguishingLabel = duplicateLabels.get(baseLabel)! > 1
              ? explicitVariantRegion(representative) ?? representative.rewards.blueprintRewardGroups[0]?.poolName ?? variantDifficulty(representative)
              : undefined;
            const isSelected = representative.variantKey === selectedVariant.variantKey;
            return (
              <button
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={isSelected ? "is-active" : ""}
                key={representative.variantKey}
                onClick={() => setSelectedKey(representative.variantKey)}
              >
                <strong>{baseLabel}</strong>
                {distinguishingLabel && <small>{distinguishingLabel}</small>}
                {group.length > 1 && <small>Exact IDs in technical details</small>}
              </button>
            );
          })}
        </div>
      )}
      {showVariantSummary && <div className="mission-variant-tabs__summary">
        <div className="mb-badges">
          {!showVariantTabs && selectedGroup.length > 1 && <Badge tone="is-neutral">{`${selectedGroup.length} equivalent variants`}</Badge>}
          {differenceLabels.map((label) => <Badge key={label} tone="is-amber">{label}</Badge>)}
        </div>
      </div>}
      <div className="mission-variant-tabs__panel" role="tabpanel">
        <VariantDrawer variant={selectedVariant} dossier />
        {selectedGroup.length > 1 && <EquivalentVariantTechnicalDetails variants={selectedGroup} />}
      </div>
    </div>
  );
}

function EquivalentVariantTechnicalDetails({ variants }: { variants: MissionVariantView[] }) {
  return (
    <details className="mb-technical">
      <summary>Exact variant technical details</summary>
      <dl>
        {variants.map((variant) => (
          <div key={variant.variantKey}>
            <dt>{variant.internalName ?? variant.displayName}</dt>
            <dd>Variant: {variant.variantKey} / Contract: {variant.technical.contractId}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function groupUnresolvedSummary(family: MissionFamilyView, variants: MissionVariantView[]): string[] {
  return [
    family.unresolvedRewardFields.length ? `${family.unresolvedRewardFields.length} reward field${family.unresolvedRewardFields.length === 1 ? "" : "s"}` : undefined,
    family.pickupUnresolvedCount ? `${family.pickupUnresolvedCount} pickup field${family.pickupUnresolvedCount === 1 ? "" : "s"}` : undefined,
    variants.filter((variant) => variant.confidence.hasUnresolvedPrerequisites).length
      ? `${variants.filter((variant) => variant.confidence.hasUnresolvedPrerequisites).length} prerequisite field${variants.filter((variant) => variant.confidence.hasUnresolvedPrerequisites).length === 1 ? "" : "s"}`
      : undefined,
    family.titleConfidence === "low" ? "low title confidence" : undefined,
  ].filter((value): value is string => Boolean(value));
}

function pickupLabel(pickup: MissionVariantView["pickupLocation"]): string {
  const normalizedPickup = (pickup as MissionVariantView["pickupLocation"] & { grouping?: { detailLabel?: string; displayLabel?: string } }).grouping;
  if (normalizedPickup?.displayLabel) return normalizedPickup.displayLabel;
  if (normalizedPickup?.detailLabel) return normalizedPickup.detailLabel;
  if (pickup.status === "generated_from_pool" && pickup.possibleLocations.length) {
    const locations = meaningfulLocations(pickup.possibleLocations);
    if (locations.length) {
      const visible = locations.slice(0, 3);
      return `Generated from ${visible.join(", ")}${locations.length > visible.length ? ` +${locations.length - visible.length}` : ""} locality pool`;
    }
  }
  if (pickup.status === "generated_from_pool") return `Generated from ${pickup.displayName} locality pool`;
  return pickup.displayName;
}

function meaningfulLocations(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => {
    const normalized = value.trim().toLowerCase();
    return normalized
      && !/[${}@]/.test(value)
      && !normalized.includes("placeholder")
      && !normalized.includes("unresolved")
      && normalized !== "unknown";
  })));
}

function pickupLocalityChips(pickup: MissionVariantView["pickupLocation"]): string[] {
  return meaningfulLocations([
    ...pickup.possibleLocations,
    ...(pickup.regions ?? []),
  ]).filter((location) => location !== pickup.displayName && location !== pickup.system);
}

function pickupDetail(pickup: MissionVariantView["pickupLocation"]): string {
  const normalizedPickup = (pickup as MissionVariantView["pickupLocation"] & { grouping?: { detailLabel?: string } }).grouping;
  if (normalizedPickup?.detailLabel && normalizedPickup.detailLabel !== pickup.displayName) return normalizedPickup.detailLabel;
  if (pickup.status === "system_only") return "Specific pickup unavailable in source";
  if (pickup.status === "system_scope") {
    const scope = [pickup.localityPool, pickup.regions?.length ? `Regions ${pickup.regions.join(", ").replace(/Region /g, "")}` : undefined].filter(Boolean).join(" / ");
    return scope ? `Scope: ${scope}; specific pickup generated at mission offer` : pickup.reason;
  }
  if (pickup.status === "generated_from_pool") return pickup.possibleLocations.length
    ? `Possible locations: ${pickup.possibleLocations.length}`
    : "Exact pickup generated from locality pool";
  if (pickup.status === "unknown" || pickup.status === "unresolved") return pickup.reason;
  return [pickup.system, pickup.parentLocation, pickup.locationType].filter(Boolean).join(" / ") || pickup.reason;
}

function playerFacingLocations(values: Array<string | undefined>): string[] {
  return meaningfulLocations(values.filter((value): value is string => Boolean(value)))
    .filter((value) => !/^region\s+[a-z]+$/i.test(value));
}

function locationSystemTone(system?: string): string {
  const normalized = system?.trim().toLowerCase();
  if (normalized === "stanton") return "is-system-stanton";
  if (normalized === "pyro") return "is-system-pyro";
  if (normalized === "nyx") return "is-system-nyx";
  return "is-neutral";
}

function dossierLocationBadge(pickup: MissionVariantView["pickupLocation"]): { label: string; unresolved: boolean; tone: string } {
  const tone = locationSystemTone(pickup.system);
  if (pickup.status === "unresolved") return { label: "Location unresolved", unresolved: true, tone: "is-muted" };
  if (pickup.status === "unknown") return { label: "Pickup unresolved", unresolved: true, tone: "is-muted" };
  const grouping = (pickup as MissionVariantView["pickupLocation"] & { grouping?: { displayLabel?: string } }).grouping;
  if (grouping?.displayLabel) {
    return { label: `Pickup: ${grouping.displayLabel}`, unresolved: false, tone };
  }
  const locations = playerFacingLocations([pickup.specificPickup ?? undefined, pickup.system, pickup.localityPool, pickup.displayName]);
  if (pickup.status === "exact" && locations.length) return { label: `Pickup: ${locations[0]}`, unresolved: false, tone };
  const availability = locations[0];
  return { label: availability ? `Availability: ${availability}` : "Location unresolved", unresolved: !availability, tone };
}

function meaningfulPrerequisites(prerequisites: MissionPrerequisiteView[]): MissionPrerequisiteView[] {
  const hiddenTypes = new Set<MissionPrerequisiteView["type"]>(["crimeStat", "standing", "reputation", "rank", "location", "locality", "unresolved"]);
  const labels = new Set<string>();
  return prerequisites.filter((prerequisite) => {
    const normalized = prerequisite.label.trim().toLowerCase();
    if (hiddenTypes.has(prerequisite.type)) return false;
    if (!normalized || normalized === "prerequisite mission or completion tag" || normalized.includes("unresolved")) return false;
    if (labels.has(normalized)) return false;
    labels.add(normalized);
    return true;
  });
}

function crimeStatLabel(value: MissionFamilyView["crimeStatRequirement"] | MissionVariantView["crimeStatRequirement"]): string {
  if (value === "required") return "CrimeStat required";
  if (value === "bounded") return "CrimeStat limited";
  if (value === "notRequired") return "No CrimeStat restriction";
  return "CrimeStat unknown";
}

function lawfulLabel(item: Pick<MissionFamilyView, "lawfulClassification" | "lawfulConfidence">): string {
  if (item.lawfulClassification === "unlawful") return "Unlawful context, requirement unconfirmed";
  if (item.lawfulClassification === "lawful") return item.lawfulConfidence === "explicit" ? "Lawful" : "Likely lawful";
  return "Lawful status unknown";
}

function explicitMissionVerificationTag(values: string[]): "Verified Mission" | "Unverified Mission" | undefined {
  const normalized = new Set(values.map((value) => value.trim().toLowerCase()));
  if (normalized.has("verified") || normalized.has("verified mission")) return "Verified Mission";
  if (normalized.has("unverified") || normalized.has("unverified mission")) return "Unverified Mission";
  return undefined;
}

function legalClassificationSummary(items: Array<Pick<MissionFamilyView, "lawfulClassification" | "lawfulConfidence">>): string {
  const labels = Array.from(new Set(items.map((item) => lawfulLabel(item))));
  if (!labels.length) return "Unknown";
  if (labels.length > 1) return "Varies by exact mission";
  const label = labels[0]!;
  return label === "Lawful status unknown" ? "Unknown" : label;
}

function titleSourceLabel(source: MissionFamilyView["titleSource"]): string {
  return {
    localized_family: "Localized family title",
    localized_clean: "Clean localized title",
    shared_variant_localized: "Shared localized variant title",
    common_variant_title: "Common localized variant title",
    token_template_cleaned: "Cleaned template title",
    generated_from_fields: "Generated from resolved fields",
    provider_archetype_fallback: "Provider/type fallback",
    internal_fallback: "Internal title fallback",
  }[source];
}

function rewardMatches(family: MissionFamilyView, rewardFilter: string): boolean {
  if (!rewardFilter) return true;
  const filter = rewardFilter as RewardFilter;
  if (filter === "blueprints") return family.blueprintRewards.length > 0;
  if (filter === "reputation") return family.reputationRewards.length > 0;
  if (filter === "credits-fixed") return family.creditRewardStatuses?.includes("fixed") ?? family.creditRewardSummary !== "No credit reward extracted";
  if (filter === "credits-calculated") return family.creditRewardStatuses?.includes("calculated") ?? family.creditRewardSummary === "Calculated payout";
  if (filter === "credits-variable") return family.creditRewardStatuses?.includes("variable") ?? family.creditRewardSummary === "Variable payout";
  if (filter === "credits-formula-unresolved") return family.creditRewardStatuses?.includes("formula_unresolved") ?? family.creditRewardSummary === "Credits formula unresolved";
  if (filter === "credits-unresolved") return family.creditRewardSummary === "Credits unresolved";
  if (filter === "credits-none") return family.creditRewardSummary === "No credit reward extracted";
  if (filter === "items") return family.itemRewardStatus === "resolved";
  if (filter === "items-unresolved") return family.itemRewardStatus === "unresolved_entityClass" || family.itemRewardStatus === "weighted_unresolved";
  return true;
}

function confidenceMatches(family: MissionFamilyView, confidenceFilter: string): boolean {
  if (!confidenceFilter) return true;
  const filter = confidenceFilter as ConfidenceFilter;
  if (filter === "unresolved") return family.confidenceFlags.length > 0 || family.unresolvedReferences.length > 0;
  if (filter === "locations") return family.unresolvedLocationTokens.length > 0;
  if (filter === "rewards") return family.unresolvedRewardFields.length > 0 || (family.creditRewardStatuses?.includes("unresolved") ?? family.creditRewardSummary === "Credits unresolved");
  if (filter === "crime-bounded") return family.crimeStatRequirement === "bounded";
  if (filter === "unlawful") return family.lawfulClassification === "unlawful";
  return true;
}

function Badge({ children, tone = "is-neutral", title }: { children: string; tone?: string; title?: string }) {
  return <span className={`mb-badge ${tone}`} title={title}>{children}</span>;
}

function restrictionBadgesForFamilies(families: MissionFamilyView[]): Array<{ label: string; tone: string }> {
  const hasCrimeRequired = families.some((family) => family.crimeStatRequirement === "required");
  const hasCrimeLimited = families.some((family) => family.crimeStatRequirement === "bounded");
  return [
    hasCrimeRequired ? { label: "CrimeStat required", tone: "is-red is-restriction" } : undefined,
    !hasCrimeRequired && hasCrimeLimited ? { label: "CrimeStat limited", tone: "is-amber is-restriction" } : undefined,
  ].filter((value): value is { label: string; tone: string } => Boolean(value));
}

const MissionConceptCard = memo(function MissionConceptCard({
  concept,
  familiesByKey,
  isSelected,
  onSelect,
}: {
  concept: MissionConceptView;
  familiesByKey: Map<string, MissionFamilyView>;
  isSelected: boolean;
  onSelect: (conceptKey: string, trigger: HTMLButtonElement) => void;
}) {
  const families = conceptFamilies(concept, familiesByKey);
  const pickupBadges = conceptPickupBadges(concept, familiesByKey);
  const blueprintCount = conceptBlueprintCount(concept, familiesByKey);
  const hasItemRewards = conceptHasItemRewards(concept, familiesByKey);
  const displayVariantCount = families.reduce((sum, family) => sum + family.variantCount, 0) || concept.variantCount;
  const restrictions = restrictionBadgesForFamilies(families);
  const repScope = shortRepScope(concept.reputationScope.displayName);
  const verificationTag = explicitMissionVerificationTag(concept.specificityBadges);
  const legalClassification = legalClassificationSummary(families);
  const missionSignals = [
    verificationTag ? { label: verificationTag, tone: verificationTag === "Verified Mission" ? "is-verified" : "is-unverified" } : undefined,
    blueprintCount > 0 ? { label: `${blueprintCount} blueprint pool${blueprintCount === 1 ? "" : "s"}`, tone: "is-blueprint" } : undefined,
    hasItemRewards ? { label: "Item rewards", tone: "is-blueprint" } : undefined,
    ...restrictions,
  ].filter((signal): signal is { label: string; tone: string } => Boolean(signal)).slice(0, 4);

  return (
    <div className={`mb-family-block ${repScopeClass(concept.reputationScope.displayName)}${isSelected ? " is-selected" : ""}`}>
      <button
        type="button"
        className="mb-family-row mission-group-card"
        aria-expanded={isSelected}
        aria-haspopup="dialog"
        onClick={(event) => onSelect(concept.conceptKey, event.currentTarget)}
      >
        <span className="mission-group-card__body">
          <span className="mission-group-card__header">
            <span className="mission-faction-initials" aria-hidden="true">{factionInitials(concept.factionDisplayName)}</span>
            <span className="mb-family-copy mission-group-card__title-block">
              <strong className="mission-group-card__title">{concept.displayName}</strong>
              <small>{concept.factionDisplayName} / {concept.displayCategory.label}</small>
            </span>
            <span className="mission-group-card__disclosure" aria-hidden="true">{isSelected ? "−" : "+"}</span>
          </span>
          <span className="mission-group-card__metrics">
            <span><small>Variants</small><strong>{displayVariantCount}</strong></span>
            <span><small>Pickup</small><strong title={pickupBadges.join(", ")}>{conceptPickupSummary(concept, familiesByKey)}</strong></span>
            <span><small>Base / solo</small><strong>{conceptCreditSummary(concept, familiesByKey)}</strong></span>
          </span>
          <span className="mission-group-card__footer">
            <span className="mb-badges">
              <span className={`mission-rep-scope-badge ${repScopeClass(concept.reputationScope.displayName)}`}>{repScope}</span>
              <span className="mission-rep-reward-text">{repPathSummary(concept.rewardedReputationPaths)}</span>
              {missionSignals.map((signal) => <Badge key={signal.label} tone={signal.tone}>{signal.label}</Badge>)}
            </span>
            <span className="mission-card-legal">Legal classification: {legalClassification}</span>
          </span>
        </span>
      </button>
    </div>
  );
});

const MissionOfferCard = memo(function MissionOfferCard({
  offer,
  isSelected,
  onSelect,
}: {
  offer: MissionOfferView;
  isSelected: boolean;
  onSelect: (offerKey: string, trigger: HTMLButtonElement) => void;
}) {
  const provider = missionOfferProvider(offer);
  const verification = missionVerificationLabel(offer.verificationStatus);
  const reputationFacets = offer.reputationRewardFacets ?? [];
  const rewardSignals = [
    offer.rewardTypes.includes("blueprints") ? "Blueprint rewards" : undefined,
    offer.rewardTypes.includes("items") ? "Item rewards" : undefined,
    offer.rewardTypes.includes("reputation") ? "Reputation rewards" : undefined,
  ].filter((value): value is string => Boolean(value));
  return (
    <div className={`mb-family-block ${repScopeClass(reputationFacets[0]?.scopeDisplayName)}${isSelected ? " is-selected" : ""}`}>
      <button
        type="button"
        className="mb-family-row mission-group-card"
        aria-expanded={isSelected}
        aria-haspopup="dialog"
        onClick={(event) => onSelect(offer.offerKey, event.currentTarget)}
      >
        <span className="mission-group-card__body">
          <span className="mission-group-card__header">
            <span className="mission-faction-initials" aria-hidden="true">{factionInitials(provider)}</span>
            <span className="mb-family-copy mission-group-card__title-block">
              <strong className="mission-group-card__title">{offer.displayTitle}</strong>
              <small>{provider} / {offer.missionTypes.join(" / ") || "Mission"}</small>
            </span>
            <span className="mission-group-card__disclosure" aria-hidden="true">{isSelected ? "−" : "+"}</span>
          </span>
          <span className="mission-group-card__metrics">
            <span><small>Exact variants</small><strong>{offer.variantKeys.length}</strong></span>
            <span><small>Provider</small><strong title={provider}>{provider}</strong></span>
            <span><small>Reward detail</small><strong>Per variant</strong></span>
          </span>
          <span className="mission-group-card__footer">
            <span className="mb-badges">
              {reputationFacets.slice(0, 2).map((facet) => (
                <span key={facet.stableKey} className={`mission-rep-scope-badge ${repScopeClass(facet.scopeDisplayName)}`} title={`${offerReputationFilterLabel(facet)} / ${facet.confidence}`}>
                  {shortRepScope(facet.scopeDisplayName)}
                </span>
              ))}
              {reputationFacets.length > 0 && (
                <span className="mission-rep-reward-text">
                  {offerReputationAmountLabel(reputationFacets[0]!)} across {reputationFacets[0]!.variantCount} exact variant{reputationFacets[0]!.variantCount === 1 ? "" : "s"}
                </span>
              )}
              <Badge tone={offer.verificationStatus === "verified" ? "is-verified" : offer.verificationStatus === "unverified" ? "is-unverified" : "is-muted"}>{verification}</Badge>
              {rewardSignals.slice(0, 3).map((signal) => <Badge key={signal} tone={signal === "Blueprint rewards" ? "is-blueprint" : "is-neutral"}>{signal}</Badge>)}
            </span>
          </span>
        </span>
      </button>
    </div>
  );
});

function BadgeList({ values, fallback, tone = "is-neutral", max = 4 }: { values: string[]; fallback: string; tone?: string; max?: number }) {
  if (!values.length) return <span className="mb-muted">{fallback}</span>;
  return (
    <div className="mb-badges">
      {values.slice(0, max).map((value) => <Badge key={value} tone={tone} title={value}>{value}</Badge>)}
      {values.length > max && <Badge tone="is-muted">{`+${values.length - max}`}</Badge>}
    </div>
  );
}

function RepPathBadge({ path, includeFaction = false }: { path: MissionRewardedReputationPathView; includeFaction?: boolean }) {
  return (
    <span className={`mb-rep-badge ${repScopeClass(path.scopeDisplayName)}`} title={`${path.factionDisplayName} / ${path.scopeDisplayName} / ${path.confidence}`}>
      {repPathLabel(path, includeFaction)}
    </span>
  );
}

function RepPathBadgeList({ paths, includeFaction = false, max = 3 }: { paths: MissionRewardedReputationPathView[]; includeFaction?: boolean; max?: number }) {
  if (!paths.length) return <span className="mb-rep-badge mission-rep-scope--unknown">Rep reward unresolved</span>;
  return (
    <div className="mb-rep-badges">
      {paths.slice(0, max).map((path, index) => <RepPathBadge key={`${path.scopeKey}-${path.amount ?? "x"}-${index}`} path={path} includeFaction={includeFaction} />)}
      {paths.length > max && <span className="mb-rep-badge mission-rep-scope--mixed">+{paths.length - max} more</span>}
    </div>
  );
}

function DossierReputationRewards({ paths }: { paths: MissionRewardedReputationPathView[] }) {
  const groups = useMemo(() => Array.from(paths.reduce((grouped, path) => {
    const key = `${path.factionKey}:${path.scopeKey}`;
    grouped.set(key, [...(grouped.get(key) ?? []), path]);
    return grouped;
  }, new Map<string, MissionRewardedReputationPathView[]>()).values()), [paths]);

  if (!groups.length) return <Badge tone="is-muted">Rep reward unresolved</Badge>;
  return (
    <div className="mb-dossier-reputation">
      {groups.map((group) => {
        const first = group[0]!;
        const positive = group.filter((path) => path.confidence !== "unresolved" && typeof path.amount === "number" && path.amount > 0);
        const negative = group.filter((path) => path.confidence !== "unresolved" && typeof path.amount === "number" && path.amount < 0);
        const unresolved = group.filter((path) => typeof path.amount !== "number" || path.confidence === "unresolved");
        return (
          <div className={`mb-dossier-reputation__group ${repScopeClass(first.scopeDisplayName)}`} key={`${first.factionKey}-${first.scopeKey}`}>
            <strong>{/^unknown(?: faction)?$/i.test(first.factionDisplayName) ? shortRepScope(first.scopeDisplayName) : `${first.factionDisplayName} / ${shortRepScope(first.scopeDisplayName)}`}</strong>
            <div className="mb-dossier-reputation__outcomes">
              {positive.map((path, index) => <span className={repOutcomeBadgeClass(path.amount)} key={`pos-${path.scopeKey}-${index}`}>{repOutcomeLabel(path.amount)}</span>)}
              {negative.map((path, index) => <span className={repOutcomeBadgeClass(path.amount)} key={`neg-${path.scopeKey}-${index}`}>{repOutcomeLabel(path.amount)}</span>)}
              {unresolved.length > 0 && <span className="is-unresolved">Rep reward unresolved</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReputationRewardSummary({ variants }: { variants: MissionVariantView[] }) {
  const rows = Array.from(
    variants.flatMap((variant) => variant.rewardedReputationPaths).reduce((grouped, path) => {
      const key = path.confidence === "unresolved" ? "unresolved" : `${path.factionKey}:${path.scopeKey}`;
      grouped.set(key, [...(grouped.get(key) ?? []), path]);
      return grouped;
    }, new Map<string, MissionRewardedReputationPathView[]>()).values()
  );
  if (!rows.length) return <p className="mb-empty-note">Rep reward unresolved across variants.</p>;
  return (
    <div className="mb-rep-summary">
      {rows.map((paths) => {
        const first = paths[0]!;
        const amounts = paths.map((path) => path.amount).filter((value): value is number => typeof value === "number");
        const min = amounts.length ? Math.min(...amounts) : undefined;
        const max = amounts.length ? Math.max(...amounts) : undefined;
        const amount = min === undefined ? "unresolved" : min === max ? signedAmount(min) : `${signedAmount(min)} to ${signedAmount(max)}`;
        return (
          <div className={`mb-rep-summary-row ${repScopeClass(first.scopeDisplayName)}`} key={`${first.factionKey}-${first.scopeKey}`}>
            <strong>{first.confidence === "unresolved" ? "Unresolved" : shortRepScope(first.scopeDisplayName)}</strong>
            <span>{amount} across {paths.length} variant{paths.length === 1 ? "" : "s"}</span>
          </div>
        );
      })}
    </div>
  );
}

function playerFacingChance(value?: string): string | undefined {
  return value?.replace(/\s+-\s+(?=1 of \d+)/i, " · ");
}

const DOSSIER_BLUEPRINT_VISIBLE_COUNT = 5;

function BlueprintRewardGroups({
  groups,
  compact = false,
  dossier = false,
}: {
  groups: BlueprintRewardGroupView[];
  compact?: boolean;
  dossier?: boolean;
}) {
  const [expandedPools, setExpandedPools] = useState<Set<string>>(() => new Set());

  if (!groups.length) return <p className="mb-empty-note">No blueprint rewards reported.</p>;

  const visibleGroups = dossier ? groups : groups.slice(0, compact ? 3 : groups.length);
  const itemLimit = dossier ? DOSSIER_BLUEPRINT_VISIBLE_COUNT : compact ? 4 : 12;

  const togglePoolExpanded = (poolKey: string) => {
    setExpandedPools((current) => {
      const next = new Set(current);
      if (next.has(poolKey)) next.delete(poolKey);
      else next.add(poolKey);
      return next;
    });
  };

  if (dossier) {
    return (
      <div className="mb-blueprint-groups is-compact is-dossier">
        {groups.map((group) => {
          const poolKey = group.poolGuid ?? group.poolName;
          const isExpanded = expandedPools.has(poolKey);
          return (
            <section className="mb-blueprint-group is-dossier-row" key={poolKey}>
              <div className="mb-blueprint-item mb-blueprint-pool-row">
                <span className="mb-blueprint-pool-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="7" />
                    <path d="M12 8.5 15 10v4l-3 1.5L9 14v-4l3-1.5Z" />
                  </svg>
                </span>
                <div className="mb-blueprint-pool-copy">
                  <span>{group.poolName}</span>
                  <small>
                    {[
                      group.missionChanceLabel ? `${group.missionChanceLabel} to award pool` : undefined,
                      playerFacingChance(group.chanceLabel),
                    ].filter(Boolean).join(" / ") || "Chance not reported"}
                  </small>
                </div>
                <button
                  type="button"
                  className="mb-blueprint-pool-action"
                  aria-expanded={isExpanded}
                  onClick={() => togglePoolExpanded(poolKey)}
                >
                  {isExpanded ? "Hide pool" : "View pool"}<span aria-hidden="true">↗</span>
                </button>
              </div>
              {isExpanded && (
                <div className="mb-blueprint-list is-expanded">
                  {group.rewards.length > 0 ? group.rewards.map((reward) => (
                    <div className="mb-blueprint-reward-detail" key={reward.blueprintGuid ?? reward.displayName}>
                      <span>{reward.displayName}</span>
                      <small>{[reward.componentType, reward.size ? `S${reward.size}` : undefined, reward.grade ? `Grade ${reward.grade}` : undefined, playerFacingChance(reward.chanceLabel)].filter(Boolean).join(" / ") || "Blueprint"}</small>
                    </div>
                  )) : <div className="mb-blueprint-unresolved">Blueprint reward pool unresolved</div>}
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`mb-blueprint-groups${compact ? " is-compact" : ""}${dossier ? " is-dossier" : ""}`}>
      {visibleGroups.map((group) => {
        const poolKey = group.poolGuid ?? group.poolName;
        const isExpanded = dossier && expandedPools.has(poolKey);
        const visibleRewards = dossier
          ? (isExpanded ? group.rewards : group.rewards.slice(0, itemLimit))
          : group.rewards.slice(0, itemLimit);
        const hiddenCount = group.rewards.length - itemLimit;

        return (
          <section className="mb-blueprint-group" key={poolKey}>
            <header>
              <strong>{group.poolName}</strong>
              <span>
                {[
                  group.missionChanceLabel ? `${group.missionChanceLabel} to award pool` : undefined,
                  playerFacingChance(group.chanceLabel),
                ].filter(Boolean).join(" / ") || "Chance not reported"}
              </span>
            </header>
            <div className="mb-blueprint-list">
              {group.rewards.length > 0 ? (
                <>
                  {visibleRewards.map((reward) => (
                    <div className="mb-blueprint-item" key={reward.blueprintGuid ?? reward.displayName}>
                      <span>{reward.displayName}</span>
                      <small>{[reward.componentType, reward.size ? `S${reward.size}` : undefined, reward.grade ? `Grade ${reward.grade}` : undefined, playerFacingChance(reward.chanceLabel)].filter(Boolean).join(" / ") || "Blueprint"}</small>
                    </div>
                  ))}
                  {dossier && hiddenCount > 0 && (
                    <button
                      type="button"
                      className="mb-blueprint-more is-action-row"
                      aria-expanded={isExpanded}
                      onClick={() => togglePoolExpanded(poolKey)}
                    >
                      {isExpanded ? "Show fewer" : `+${hiddenCount} more`}
                    </button>
                  )}
                  {!dossier && group.rewards.length > itemLimit && (
                    <button type="button" className="mb-blueprint-more is-action-row" disabled aria-label={`${group.rewards.length - itemLimit} more blueprint rewards not shown`}>
                      +{group.rewards.length - itemLimit} more
                    </button>
                  )}
                </>
              ) : (
                <div className="mb-blueprint-unresolved">Blueprint reward pool unresolved</div>
              )}
            </div>
          </section>
        );
      })}
      {!dossier && groups.length > visibleGroups.length && (
        <button type="button" className="mb-blueprint-more is-action-row" disabled aria-label={`${groups.length - visibleGroups.length} more reward pools not shown`}>
          +{groups.length - visibleGroups.length} more reward pools
        </button>
      )}
    </div>
  );
}

function pickupPrimaryName(pickup: MissionVariantView["pickupLocation"]): string {
  const grouping = (pickup as MissionVariantView["pickupLocation"] & { grouping?: { displayLabel?: string; detailLabel?: string } }).grouping;
  if (grouping?.displayLabel) return grouping.displayLabel;
  if (grouping?.detailLabel) return grouping.detailLabel;
  return pickup.specificPickup || pickup.displayName || pickup.localityPool || pickup.system || "Pickup unresolved";
}

function dossierVariantDetailLabel(variant: MissionVariantView, groupLabel: string): string {
  const groupKey = normalizedText(groupLabel);
  const primary = pickupPrimaryName(variant.pickupLocation);
  const candidates = playerFacingLocations([
    variant.pickupLocation.specificPickup ?? undefined,
    variant.pickupLocation.parentLocation,
    variant.pickupLocation.localityPool,
    ...(variant.pickupLocation.regions ?? []),
    ...variant.pickupLocation.possibleLocations,
  ]);
  return candidates.find((value) => normalizedText(value) !== groupKey && normalizedText(value) !== normalizedText(primary))
    ?? (normalizedText(primary) !== groupKey ? primary : "Location varies");
}

function dossierVariantRewardHint(variant: MissionVariantView): string | undefined {
  const poolCount = variant.rewards.blueprintRewardGroups.length;
  if (poolCount > 0) return `${poolCount} blueprint pool${poolCount === 1 ? "" : "s"}`;
  const credit = playerFacingCreditReward(variant.rewards);
  if (credit !== AUEC_REWARD_NOT_REPORTED) return credit;
  return undefined;
}

function repOutcomeBadgeClass(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "is-unresolved";
  return value >= 0 ? "is-positive" : "is-negative";
}

function repOutcomeLabel(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Rep reward unresolved";
  return `${value >= 0 ? "+" : ""}${value.toLocaleString()} REP`;
}

function DossierRewardsCard({ variant }: { variant: MissionVariantView }) {
  const itemRewards = variant.rewards.itemRewards ?? [];
  const reportedItemRewards = itemRewards.filter((reward) => {
    const label = reward.displayName ?? reward.entityClass ?? "";
    return Boolean(label) && !/^item reward$/i.test(label);
  });
  const creditReward = playerFacingCreditReward(variant.rewards);
  const creditUnresolved = creditReward === AUEC_REWARD_NOT_REPORTED;
  const buyInAmounts = (variant.canonical?.financials.buyIns ?? [])
    .map((entry) => entry.contractBuyInAmount.value)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  const buyIn = buyInAmounts.length ? Math.max(...buyInAmounts) : undefined;
  const payout = variant.rewards.creditsDetail?.payout;
  return (
    <section className="mission-dossier-card mission-dossier-rewards-card is-compact">
      <div className="mission-dossier-card__heading">
        <h3>Rewards</h3>
      </div>
      <div className="mission-dossier-section mission-dossier-rewards-reputation">
        <h4 className="mb-inline-heading">Reputation Reward</h4>
        <DossierReputationRewards paths={variant.rewardedReputationPaths} />
      </div>
      <div className={`mission-dossier-reward-status${creditUnresolved ? " is-muted" : ""}`}>
        <span>aUEC Reward</span>
        {creditUnresolved ? (
          <p className="mission-dossier-reward-muted">{creditReward}</p>
        ) : (
          <strong>{creditReward}</strong>
        )}
      </div>
      {buyIn !== undefined && (
        <div className="mission-dossier-reward-status is-buy-in">
          <span>Certification buy-in</span>
          <strong>{buyIn.toLocaleString()} aUEC</strong>
          <p className="mission-dossier-reward-muted">Separate from the base/solo payout.</p>
        </div>
      )}
      {payout?.resultLoopVerificationRequired && (
        <p className="mission-dossier-source-warning">
          Multiple calculated reward branches require result-loop verification. No branches were summed.
        </p>
      )}
      <div className="mission-dossier-section mission-dossier-item-rewards">
        <h4 className="mb-inline-heading">Item Reward</h4>
        {reportedItemRewards.length > 0
          ? <BadgeList values={reportedItemRewards.map((reward) => [reward.amount, reward.displayName ?? reward.entityClass ?? "Item reward"].filter(Boolean).join(" x "))} fallback="No item rewards reported" max={6} />
          : <p className="mission-dossier-reward-muted">Item reward not reported</p>}
      </div>
    </section>
  );
}

function requirementQuantityLabel(variant: MissionRequiredItemEvidenceView, entryIndex?: number): string | undefined {
  const entry = entryIndex === undefined ? undefined : variant.content.entries?.[entryIndex];
  const min = entry?.quantity?.minAmount?.value;
  const max = entry?.quantity?.maxAmount?.value;
  if (typeof min === "number" && min > 0 && (max === 0 || max == null)) return `At least ${min}`;
  if (typeof min === "number" && typeof max === "number") return min === max ? `${min}` : `${min}-${max}`;
  if (typeof min === "number") return `At least ${min}`;
  const selectorMin = variant.content.selectionBounds?.minItemsToFind?.value;
  const selectorMax = variant.content.selectionBounds?.maxItemsToFind?.value;
  if (typeof selectorMin === "number" && typeof selectorMax === "number") {
    return selectorMin === selectorMax ? `${selectorMin}` : `${selectorMin}-${selectorMax}`;
  }
  return undefined;
}

function requiredItemLabel(item: MissionRequiredItemEvidenceView, entryIndex?: number): string {
  const entry = entryIndex === undefined ? undefined : item.content.entries?.[entryIndex];
  const identity = entry?.identity;
  const resolvedEntryName = identity?.displayName
    ?? identity?.members?.map((member) => member.displayName ?? member.recordName).filter(Boolean).join(" or ");
  if (resolvedEntryName) return resolvedEntryName;
  const definition = item.content.conditions?.flatMap((condition) => condition.items ?? [])[0];
  return definition?.displayName
    ?? definition?.entityClass?.displayName
    ?? definition?.recordName
    ?? (item.requirementRole === "hauling_order" ? "Mission cargo (identity unresolved)" : "Runtime-selected mission item");
}

function requiredItemRowCount(variant?: MissionVariantView): number {
  return (variant?.requiredItems?.evidence ?? [])
    .filter((item) => item.roleStatus !== "bound_to_objective_order")
    .reduce((total, item) => total + Math.max(1, item.content.entries?.length ?? 0), 0);
}

function requiredItemIcon(itemLabel: string): string | undefined {
  const normalized = itemLabel.toLowerCase();
  if (normalized.includes("helmet")) return "/images/component-icons/heavy_helmet.webp";
  if (normalized.includes("armor") || normalized.includes("carrier")) return "/images/component-icons/heavy_torso.webp";
  return undefined;
}

function DossierRequiredItemsCard({ variant }: { variant: MissionVariantView }) {
  const requiredItems = variant.requiredItems;
  if (!requiredItems || requiredItems.status === "proven_absent") return null;
  const evidence = (requiredItems.evidence ?? []).filter(
    (item) => item.roleStatus !== "bound_to_objective_order",
  );
  const rows = evidence.reduce<Array<{
    item: MissionRequiredItemEvidenceView;
    entryIndex?: number;
  }>>((result, item) => {
    if (item.content.entries?.length) {
      item.content.entries.forEach((_, entryIndex) => result.push({ item, entryIndex }));
    } else {
      result.push({ item });
    }
    return result;
  }, []);
  return (
    <section className="mission-dossier-card mission-dossier-required-items">
      <div className="mission-dossier-card__heading">
        <h3>Items to Collect or Deliver</h3>
        <span>{rows.length} required item{rows.length === 1 ? "" : "s"}</span>
      </div>
      {rows.length ? (
        <div className="mission-required-item-list">
          {rows.map(({ item, entryIndex }) => {
            const quantity = requirementQuantityLabel(item, entryIndex);
            const isProvenOrder = item.requirementRole === "hauling_order" && item.requirementStatus.startsWith("source_backed");
            const itemDefinition = item.content.conditions?.flatMap((condition) => condition.items ?? [])[0];
            const itemLabel = requiredItemLabel(item, entryIndex);
            return (
              <div className="mission-required-item-row" key={`${item.evidenceId}-${entryIndex ?? "selector"}`}>
                <span className="mission-required-item-icon" aria-hidden="true">
                  {requiredItemIcon(itemLabel) ? (
                    <img src={requiredItemIcon(itemLabel)} alt="" />
                  ) : (
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="7" />
                      <path d="M9.5 12h5M12 9.5v5" />
                    </svg>
                  )}
                </span>
                <div>
                  <strong>{itemLabel}</strong>
                  <span>{quantity ? `${quantity} required` : "Quantity determined at runtime or unresolved"}</span>
                </div>
                <Badge tone={isProvenOrder ? "is-amber" : "is-muted"}>
                  {isProvenOrder ? "Collect / deliver" : "Runtime-selected"}
                </Badge>
                {itemDefinition?.resolution === "unresolved_item_definition" && (
                  <small>Item identity is present in source but its display name is unresolved.</small>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mb-empty-note">Required-item evidence is unresolved.</p>
      )}
    </section>
  );
}

function DossierBlueprintCard({
  groups,
  offeringVariantCount,
  variantCount,
}: {
  groups: BlueprintRewardGroupView[];
  offeringVariantCount: number;
  variantCount: number;
}) {
  return (
    <section className="mission-dossier-card mission-dossier-blueprint-panel">
      <div className="mission-dossier-card__heading">
        <h3>Blueprint Rewards</h3>
        <span>
          {groups.length
            ? `${groups.length} blueprint pool${groups.length === 1 ? "" : "s"}`
            : offeringVariantCount > 0
              ? `${offeringVariantCount} of ${variantCount} variants offer blueprints`
              : "None reported"}
        </span>
      </div>
      {groups.length
        ? <BlueprintRewardGroups groups={groups} compact dossier />
        : <p className="mb-empty-note">No blueprint reward for this selected variant.</p>}
    </section>
  );
}

function DossierVariantList({
  variants,
  selectedVariantKey,
  onSelect,
}: {
  variants: MissionVariantView[];
  selectedVariantKey: string;
  onSelect: (variantKey: string) => void;
}) {
  const groupedVariants = useMemo(() => Array.from(variants.reduce((groups, variant) => {
    const region = readableVariantRegion(variant);
    groups.set(region, [...(groups.get(region) ?? []), variant]);
    return groups;
  }, new Map<string, MissionVariantView[]>()).entries())
    .sort((a, b) => variantRegionSortOrder(a[0]) - variantRegionSortOrder(b[0]) || a[0].localeCompare(b[0])), [variants]);
  return (
    <section className="mission-dossier-card mission-dossier-variants-card">
      <div className="mission-dossier-card__heading">
        <h3>{`Variants (${variants.length})`}</h3>
      </div>
      <div className={`mission-dossier-variant-list${variants.length > 5 ? " is-scrollable" : ""}`}>
        {groupedVariants.map(([region, groupVariants]) => (
          <div className="mission-dossier-variant-region" key={region}>
            {groupedVariants.length > 1 && (
              <div className="mission-dossier-variant-region__header">
                <strong>{region}</strong>
              </div>
            )}
            {groupVariants.map((variant, index) => {
              const isSelected = variant.variantKey === selectedVariantKey;
              const rewardHint = dossierVariantRewardHint(variant);
              return (
                <button
                  type="button"
                  key={variant.variantKey}
                  className={`mission-dossier-variant-row${isSelected ? " is-selected" : ""}`}
                  aria-pressed={isSelected}
                  onClick={() => onSelect(variant.variantKey)}
                >
                  <span className="mission-dossier-variant-row__index">{index + 1}</span>
                  <span className="mission-dossier-variant-row__main">
                    <strong>{dossierVariantDetailLabel(variant, region)}</strong>
                  </span>
                  {rewardHint && <span className="mission-dossier-variant-row__status">{rewardHint}</span>}
                  <span className="mission-dossier-variant-row__chevron" aria-hidden="true">&gt;</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

type MissionDossierFooterState = {
  variant: MissionVariantView;
  blueprintGroups: BlueprintRewardGroupView[];
};

function DossierFooter({ variant, blueprintGroups }: MissionDossierFooterState) {
  const confidence = variant.confidence.hasUnresolvedLocation || variant.confidence.hasUnresolvedPrerequisites || variant.confidence.hasUnresolvedRewards
    ? "Partial"
    : variant.pickupLocation.confidence === "high"
      ? "High"
      : "Medium";
  const notes = [
    variant.confidence.hasUnresolvedRewards ? "Reward data may be partially unresolved." : undefined,
    variant.crimeStatRequirement === "required" ? "CrimeStat is required." : undefined,
    variant.crimeStatRequirement === "bounded" ? "CrimeStat access is limited." : undefined,
    blueprintGroups.some((group) => group.rewards.length === 0) ? "Blueprint pool item resolution incomplete." : undefined,
    blueprintGroups.length > 1 && !explicitVariantRegion(variant) ? "Blueprint pools vary by generated locality; exact region mapping is unresolved." : undefined,
    variant.locationRoles?.destination?.status === "unresolved" ? "Destination unresolved in current data." : undefined,
  ].filter((value): value is string => Boolean(value));
  return (
    <footer className="mission-dossier-footer">
      <span className={`mission-dossier-confidence is-${confidence.toLowerCase()}`}>Confidence: {confidence}</span>
      {notes.length > 0 && <span>{notes.join(" ")}</span>}
    </footer>
  );
}

function DossierBody({
  variants,
  selectedVariant,
  onSelectVariant,
  onFooterChange,
  onRequiredItemCountChange,
}: {
  variants: MissionVariantView[];
  selectedVariant: MissionVariantView;
  onSelectVariant: (variantKey: string) => void;
  onFooterChange: (state: MissionDossierFooterState) => void;
  onRequiredItemCountChange: (count: number) => void;
}) {
  const [exactVariants, setExactVariants] = useState<Record<string, MissionVariantView>>({});
  const [exactLoadingKey, setExactLoadingKey] = useState("");
  const [exactError, setExactError] = useState("");
  const detailedVariant = exactVariants[selectedVariant.variantKey] ?? selectedVariant;
  const blueprintGroups = useMemo(
    () => Array.from(new Map(detailedVariant.rewards.blueprintRewardGroups.map((group) => [group.poolGuid ?? group.poolName, group])).values()),
    [detailedVariant],
  );
  const blueprintOfferingVariantCount = useMemo(
    () => variants.filter((variant) => variant.rewards.blueprintRewardGroups.length > 0).length,
    [variants],
  );

  useEffect(() => {
    if (exactVariants[selectedVariant.variantKey]) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setExactLoadingKey(selectedVariant.variantKey);
      setExactError("");
    });
    loadMissionVariantDetail(selectedVariant.variantKey)
      .then((variant) => {
        if (!cancelled) setExactVariants((current) => ({ ...current, [variant.variantKey]: variant }));
      })
      .catch((reason: unknown) => {
        if (!cancelled) setExactError(reason instanceof Error ? reason.message : "Exact mission details unavailable");
      })
      .finally(() => {
        if (!cancelled) setExactLoadingKey((current) => current === selectedVariant.variantKey ? "" : current);
      });
    return () => {
      cancelled = true;
    };
  }, [exactVariants, selectedVariant.variantKey]);

  useEffect(() => {
    onFooterChange({ variant: detailedVariant, blueprintGroups });
    onRequiredItemCountChange(requiredItemRowCount(detailedVariant));
  }, [blueprintGroups, detailedVariant, onFooterChange, onRequiredItemCountChange]);

  return (
    <>
      {exactLoadingKey === selectedVariant.variantKey && <div className="mission-dossier-detail-state">Loading exact payout and item evidence...</div>}
      {exactError && <div className="mission-dossier-detail-state is-error">{exactError}</div>}
      <div className="mission-dossier-body-grid">
        <section className="mission-dossier-card mission-dossier-briefing-card">
          <div className="mission-dossier-card__heading">
            <h3>Mission Briefing</h3>
          </div>
          {detailedVariant.briefing ? (
            <p>{playerFacingBriefing(detailedVariant.briefing)}</p>
          ) : (
            <p className="mb-empty-note">Mission briefing not reported.</p>
          )}
        </section>
        <div className="mission-dossier-right-rail">
          <DossierRewardsCard variant={detailedVariant} />
          <DossierBlueprintCard
            groups={blueprintGroups}
            offeringVariantCount={blueprintOfferingVariantCount}
            variantCount={variants.length}
          />
          {variants.length > 1 && <DossierVariantList variants={variants} selectedVariantKey={selectedVariant.variantKey} onSelect={onSelectVariant} />}
        </div>
        <DossierRequiredItemsCard variant={detailedVariant} />
      </div>
    </>
  );
}

function TechnicalDetails({ variant }: { variant: MissionVariantView }) {
  return (
    <details className="mb-technical">
      <summary><span>Technical details</span><Badge tone="is-violet">Exact Details</Badge></summary>
      <dl>
        <div><dt>Variant Key</dt><dd title={variant.variantKey}>{variant.variantKey}</dd></div>
        <div><dt>Source Family Key</dt><dd title={variant.familyKey}>{variant.familyKey}</dd></div>
        <div><dt>Concept Key</dt><dd title={variant.conceptKey}>{variant.conceptKey ?? "Unavailable"}</dd></div>
        <div><dt>Contract ID</dt><dd title={variant.technical.contractId}>{variant.technical.contractId}</dd></div>
        <div><dt>Contract Type</dt><dd>{variant.contractType}</dd></div>
        <div><dt>Mission Type</dt><dd>{variant.missionType}</dd></div>
        <div><dt>Internal Name</dt><dd>{variant.internalName ?? "Unavailable"}</dd></div>
        <div><dt>Generator</dt><dd>{variant.technical.generatorName ?? "Unavailable"}</dd></div>
        <div><dt>Generator Path</dt><dd>{variant.technical.generatorPath ?? "Unavailable"}</dd></div>
        <div><dt>Title Token</dt><dd>{variant.technical.titleRaw ?? variant.rawName ?? "Unavailable"}</dd></div>
        <div><dt>Pickup Source</dt><dd>{variant.pickupLocation.sourceRole} / {variant.pickupLocation.confidence}</dd></div>
        <div><dt>Rep Scope</dt><dd>{variant.reputationScope.displayName} / {variant.reputationScope.confidence}</dd></div>
        <div><dt>Archetype</dt><dd>{variant.missionArchetype}</dd></div>
        <div><dt>Standing</dt><dd>{variant.standingRequirement}</dd></div>
        <div><dt>Legal Classification</dt><dd>{variant.lawfulClassification} / {variant.lawfulConfidence}</dd></div>
        <div><dt>Release Flags</dt><dd>{variant.releaseFlags.join(", ") || "None"}</dd></div>
        <div><dt>Behavior Flags</dt><dd>{variant.flags.join(", ") || "None"}</dd></div>
      </dl>
      <div className="mb-tech-tokens">
        <strong>Pickup resolver</strong>
        <p>{variant.pickupLocation.reason}</p>
      </div>
      {variant.pickupLocation.technicalRefs.length > 0 && (
        <div className="mb-tech-tokens">
          <strong>Location role classification</strong>
          {variant.pickupLocation.technicalRefs.map((ref) => (
            <p key={`${ref.role}-${ref.ref}`}>
              {ref.role}: {ref.resolvedName ?? ref.ref} ({ref.consideredPickup ? "pickup candidate" : "secondary"}) - {ref.reason}
            </p>
          ))}
        </div>
      )}
      {variant.unresolvedLocationTokens.length > 0 && (
        <div className="mb-tech-tokens">
          <strong>Secondary unresolved location tokens</strong>
          <p>{variant.unresolvedLocationTokens.join(", ")}</p>
        </div>
      )}
      {variant.pickupLocation.unresolvedRefs.length > 0 && (
        <div className="mb-tech-tokens">
          <strong>Pickup unresolved refs</strong>
          <p>{variant.pickupLocation.unresolvedRefs.join(", ")}</p>
        </div>
      )}
      {variant.locations.length > 0 && (
        <div className="mb-tech-tokens">
          <strong>All extracted locations</strong>
          <p>{variant.locations.join(", ")}</p>
        </div>
      )}
      {variant.prerequisites.length > 0 && (
        <div className="mb-tech-tokens">
          <strong>All extracted prerequisites</strong>
          {variant.prerequisites.map((prerequisite, index) => (
            <p key={`${prerequisite.type}-${prerequisite.label}-${index}`}>
              {prerequisite.type} / {prerequisite.confidence}: {prerequisite.label}{prerequisite.rawType ? ` / ${prerequisite.rawType}` : ""}
            </p>
          ))}
        </div>
      )}
      {variant.rewards.unresolvedRewardTokens.length > 0 && (
        <div className="mb-tech-tokens">
          <strong>Unresolved reward tokens</strong>
          <p>{variant.rewards.unresolvedRewardTokens.join(", ")}</p>
        </div>
      )}
      {variant.rewardedReputationPaths.length > 0 && (
        <div className="mb-tech-tokens">
          <strong>Rewarded reputation refs</strong>
          {variant.rewardedReputationPaths.map((path, index) => (
            <p key={`${path.scopeKey}-${index}`}>
              {path.factionDisplayName} / {path.scopeDisplayName} / {path.confidence}: {path.sourceRefs.join(", ") || "No source refs"}
              {path.unresolvedReason ? ` - ${path.unresolvedReason}` : ""}
            </p>
          ))}
        </div>
      )}
    </details>
  );
}

function VariantDrawer({ variant, dossier = false }: { variant: MissionVariantView; dossier?: boolean }) {
  const prerequisites = meaningfulPrerequisites(variant.prerequisites);
  const localityChips = pickupLocalityChips(variant.pickupLocation);
  const showCrimeStat = variant.crimeStatRequirement === "required" || variant.crimeStatRequirement === "bounded";
  const showLegalStatus = variant.lawfulClassification !== "unknown";
  const hasRequirements = !dossier
    || prerequisites.length > 0
    || showCrimeStat
    || showLegalStatus
    || !/^(no extracted|unresolved|unknown)/i.test(variant.standingRequirement);
  return (
    <div className={`mb-variant-drawer${dossier ? " is-dossier" : ""}`}>
      {variant.briefing && (
        <section className="mb-briefing is-variant">
          <h3>Mission Briefing</h3>
          <p>{dossier ? playerFacingBriefing(variant.briefing) : variant.briefing}</p>
        </section>
      )}
      <div className="mb-drawer-grid">
        <section className="mb-drawer-rewards">
          <h3>Rewards</h3>
          {variant.rewards.blueprintRewardGroups.length > 0 && <BlueprintRewardGroups groups={variant.rewards.blueprintRewardGroups} compact />}
          <div>
            <h4 className="mb-inline-heading">Rewarded Reputation</h4>
            <DossierReputationRewards paths={variant.rewardedReputationPaths} />
          </div>
          <Badge tone="is-muted">{playerFacingCreditReward(variant.rewards)}</Badge>
          {(variant.rewards.itemRewards ?? []).length > 0 && (
            <div>
              <h4 className="mb-inline-heading">Item Rewards</h4>
              <BadgeList values={(variant.rewards.itemRewards ?? []).map((reward) => [reward.amount, reward.displayName ?? reward.entityClass ?? "Item reward"].filter(Boolean).join(" x "))} fallback="No item rewards extracted" max={6} />
            </div>
          )}
        </section>
        {hasRequirements && (
          <section className="mb-drawer-requirements">
            <h3>Requirements</h3>
            {!/^(no extracted|unresolved|unknown)/i.test(variant.standingRequirement) && (
              <div className="mb-pickup-readout">
                <strong>{variant.standingRequirement}</strong>
                <small>Standing requirement</small>
              </div>
            )}
            {(showCrimeStat || showLegalStatus || prerequisites.length > 0) && (
              <div className="mb-badges">
                {showCrimeStat && <Badge tone={variant.crimeStatRequirement === "required" ? "is-red" : "is-amber"}>{crimeStatLabel(variant.crimeStatRequirement)}</Badge>}
                {showLegalStatus && <Badge tone={variant.lawfulClassification === "unlawful" ? "is-amber" : "is-neutral"}>{lawfulLabel(variant)}</Badge>}
                {prerequisites.map((prerequisite) => <Badge key={`${prerequisite.type}-${prerequisite.label}`} tone="is-neutral">{prerequisite.label}</Badge>)}
              </div>
            )}
          </section>
        )}
        {!dossier && (
          <section className="mb-drawer-pickup">
            <h3>Pickup / Availability</h3>
            <div className="mb-pickup-readout">
              <strong>{pickupLabel(variant.pickupLocation)}</strong>
              {variant.pickupLocation.status === "exact" && variant.pickupLocation.parentLocation && <small>{variant.pickupLocation.parentLocation}</small>}
            </div>
            {localityChips.length > 0 && <BadgeList values={localityChips} fallback="" max={6} />}
          </section>
        )}
      </div>
      {!dossier && <TechnicalDetails variant={variant} />}
    </div>
  );
}

function FamilyDetail({
  family,
  variants,
  openVariant,
  setOpenVariant,
  onClose,
}: {
  family: MissionFamilyView;
  variants: MissionVariantView[];
  openVariant: string;
  setOpenVariant: (variantKey: string) => void;
  onClose: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleVariants = showAll ? variants : variants.slice(0, MAX_VISIBLE_VARIANTS);
  const unresolvedSummary = groupUnresolvedSummary(family, variants);
  return (
    <section className={`mb-detail mission-group-expansion ${repScopeClass(primaryRepScope(family.rewardedReputationPaths, family.reputationScope.displayName))}`} aria-label={`${family.displayName} mission family details`}>
      <header>
        <div>
          <span>Mission Group Container</span>
          <h2>{family.displayName}</h2>
          <p>{family.provider} / {family.reputationScope.displayName} / {family.missionArchetype} / {family.variantCount} playable mission{family.variantCount === 1 ? "" : "s"}</p>
        </div>
        <div className="mb-detail-actions">
          <div className="mb-badges">
            <Badge tone={family.crimeStatRequirement === "required" ? "is-red" : family.crimeStatRequirement === "bounded" ? "is-amber" : "is-muted"}>{crimeStatLabel(family.crimeStatRequirement)}</Badge>
            <Badge tone={family.lawfulClassification === "unlawful" ? "is-amber" : "is-neutral"}>{lawfulLabel(family)}</Badge>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </header>

      <div className="mission-group-summary-strip">
        <span><strong>Type</strong>{family.missionArchetype}</span>
        <span><strong>Playable</strong>{family.variantCount} missions</span>
        <span><strong>Pickup</strong>{groupPickupSummary(family, variants)}</span>
        <span><strong>Rep</strong>{repPathSummary(family.rewardedReputationPaths)}</span>
        <span><strong>Standing</strong>{groupStandingSummary(variants)}</span>
        <span><strong>Credits</strong>{cardCreditSummary(variants)}</span>
        {family.blueprintRewardGroups.length > 0 && <span><strong>Blueprints</strong>{family.blueprintRewardGroups.length} pool{family.blueprintRewardGroups.length === 1 ? "" : "s"}</span>}
        {unresolvedSummary.length > 0 && <span><strong>Unresolved</strong>{unresolvedSummary.length} categories</span>}
      </div>

      <section className="mission-group-rep-summary">
        <div className="mb-section-heading"><strong>Reputation Rewards</strong><span>{family.rewardedReputationPaths.length || "unresolved"}</span></div>
        <ReputationRewardSummary variants={variants} />
      </section>

      {family.blueprintRewardGroups.length > 0 && (
        <details className="mission-technical-toggle">
          <summary>View blueprint pool</summary>
          <BlueprintRewardGroups groups={family.blueprintRewardGroups} />
        </details>
      )}

      <div className="mb-section-heading" id={`variants-${family.familyKey}`}><strong>Playable Missions</strong><span>{variants.length}</span></div>
      <div className="mb-variant-table mission-variant-list">
        {visibleVariants.map((variant) => {
          const isOpen = openVariant === variant.variantKey;
          return (
            <div className={`mb-variant-row-wrap mission-variant-row${isOpen ? " is-open mission-variant-row--expanded" : ""}`} key={variant.variantKey}>
              <button type="button" className="mb-variant-row" aria-expanded={isOpen} onClick={() => setOpenVariant(isOpen ? "" : variant.variantKey)}>
                <span className="mission-variant-row__title"><strong>{variant.displayName}</strong><small>{variantDifficulty(variant)} / {variant.missionType}</small></span>
                <span><strong>Pickup</strong><small title={pickupDetail(variant.pickupLocation)}>{pickupLabel(variant.pickupLocation)}</small></span>
                <span><strong>Standing</strong><small>{variant.standingRequirement}</small></span>
                <span className="mb-variant-rewards">
                  <strong>Rewards</strong>
                  <small>{playerFacingCreditReward(variant.rewards)}</small>
                  {variant.rewards.blueprintRewardGroups.length > 0 && <small>Blueprint: {variant.rewards.blueprintRewardGroups[0]?.poolName}</small>}
                  <RepPathBadgeList paths={variant.rewardedReputationPaths} max={2} />
                </span>
                <span className="mb-badges">
                  <Badge tone={isOpen ? "is-violet" : "is-neutral"}>{isOpen ? "Hide" : "Details"}</Badge>
                  {variant.confidence.hasUnresolvedRewards && <Badge tone="is-amber">Rewards unresolved</Badge>}
                  {(variant.pickupLocation.status === "unknown" || variant.pickupLocation.status === "unresolved") && <Badge tone="is-amber">Pickup unresolved</Badge>}
                </span>
              </button>
              {isOpen && <VariantDrawer variant={variant} />}
            </div>
          );
        })}
      </div>
      {variants.length > MAX_VISIBLE_VARIANTS && (
        <button className="mb-view-all" type="button" onClick={() => setShowAll((current) => !current)}>
          {showAll ? "Show fewer variants" : `Show all ${variants.length} variants`}
        </button>
      )}
      <details className="mb-family-technical" id={`technical-${family.familyKey}`}>
        <summary>Group technical details</summary>
        <dl>
          <div><dt>Group Key</dt><dd>{family.familyKey}</dd></div>
          <div><dt>Grouping Source</dt><dd>familyId + contract family</dd></div>
          <div><dt>Raw Name</dt><dd>{family.rawName ?? "Unavailable"}</dd></div>
          <div><dt>Internal Name</dt><dd>{family.internalName ?? "Unavailable"}</dd></div>
          <div><dt>Rep Scope</dt><dd>{family.reputationScope.displayName} / {family.reputationScope.confidence}</dd></div>
          <div><dt>Archetype</dt><dd>{family.missionArchetype}</dd></div>
          <div><dt>Title Source</dt><dd>{titleSourceLabel(family.titleSource)} / {family.titleConfidence}</dd></div>
          <div><dt>Pickup Summary</dt><dd>{family.pickupSummary}</dd></div>
          <div><dt>Unresolved Pickup</dt><dd>{family.pickupUnresolvedCount || "None"}</dd></div>
          <div><dt>Unresolved Rewards</dt><dd>{family.unresolvedRewardFields.join(", ") || "None"}</dd></div>
          <div><dt>Child Variant Keys</dt><dd title={family.variantKeys.join(", ")}>{family.variantKeys.join(", ") || "None"}</dd></div>
        </dl>
      </details>
    </section>
  );
}

function ConceptDetail({
  concept,
  offer,
  variants,
  initialVariantKey,
  facts,
  isBookmarked,
  onToggleBookmark,
  onSelectVariant,
  onClose,
  onFooterChange,
}: {
  concept: MissionConceptView;
  offer?: MissionOfferView;
  variants: MissionVariantView[];
  initialVariantKey?: string;
  facts: Array<{ label: string; value: string | number }>;
  isBookmarked: boolean;
  onToggleBookmark: (identityKey: string) => void;
  onSelectVariant?: (variantKey: string) => void;
  onClose: () => void;
  onFooterChange: (state: MissionDossierFooterState) => void;
}) {
  const tiers = useMemo(() => Array.from(variants.reduce((groups, variant) => {
    const key = variant.tierKey ?? "unclassified";
    groups.set(key, [...(groups.get(key) ?? []), variant]);
    return groups;
  }, new Map<string, MissionVariantView[]>()).entries())
    .sort((a, b) => tierDisplayOrder(a[0]) - tierDisplayOrder(b[0]) || a[0].localeCompare(b[0])), [variants]);
  const initialVariant = variants.find((variant) => variant.variantKey === initialVariantKey);
  const [selectedTierKey, setSelectedTierKey] = useState(() => initialVariant?.tierKey ?? tiers[0]?.[0] ?? "");
  const selectedTier = useMemo(() => tiers.find(([tierKey]) => tierKey === selectedTierKey) ?? tiers[0], [selectedTierKey, tiers]);
  const availabilityGroups = useMemo(() => Array.from((selectedTier?.[1] ?? []).reduce((groups, variant) => {
    const key = expansionGroupKey(variant);
    groups.set(key, [...(groups.get(key) ?? []), variant]);
    return groups;
  }, new Map<string, MissionVariantView[]>()).entries())
    .sort((a, b) => variantRegionSortOrder(a[0]) - variantRegionSortOrder(b[0]) || a[0].localeCompare(b[0])), [selectedTier]);
  const [selectedAvailabilityKey, setSelectedAvailabilityKey] = useState(() => initialVariant ? expansionGroupKey(initialVariant) : availabilityGroups[0]?.[0] ?? "");
  const selectedAvailability = useMemo(
    () => availabilityGroups.find(([groupKey]) => groupKey === selectedAvailabilityKey) ?? availabilityGroups[0],
    [availabilityGroups, selectedAvailabilityKey],
  );
  const selectedVariants = useMemo(
    () => selectedAvailability?.[1] ?? [],
    [selectedAvailability],
  );
  const [selectedDossierVariantKey, setSelectedDossierVariantKey] = useState(initialVariantKey ?? "");
  const [detailedRequiredItemCounts, setDetailedRequiredItemCounts] = useState<Record<string, number>>({});
  const resolvedDossierVariantKey = useMemo(() => (
    selectedVariants.some((variant) => variant.variantKey === selectedDossierVariantKey)
      ? selectedDossierVariantKey
      : (selectedVariants[0]?.variantKey ?? "")
  ), [selectedDossierVariantKey, selectedVariants]);
  const representative = selectedVariants.find((variant) => variant.variantKey === resolvedDossierVariantKey) ?? selectedVariants[0];
  const handleRequiredItemCountChange = useCallback((count: number) => {
    if (!representative) return;
    setDetailedRequiredItemCounts((current) => current[representative.variantKey] === count
      ? current
      : { ...current, [representative.variantKey]: count });
  }, [representative]);
  const meaningfulTiers = useMemo(() => tiers.filter(([tierKey, tierVariants]) => {
    const label = tierVariants[0]?.tierLabel ?? tierKey;
    return !/^(unclassified|unknown|unresolved)(\s+tier)?$/i.test(label);
  }), [tiers]);
  const showRiskTierSelector = meaningfulTiers.length > 1;
  const availabilityBadges = useMemo(() => new Map(availabilityGroups.map(([groupKey, groupVariants]) => [
    groupKey,
    dossierLocationBadge(groupVariants[0]!.pickupLocation),
  ])), [availabilityGroups]);
  const allBlueprintGroups = useMemo(
    () => Array.from(new Map(variants.flatMap((variant) => variant.rewards.blueprintRewardGroups).map((group) => [group.poolGuid ?? group.poolName, group])).values()),
    [variants],
  );
  const verificationTag = offer
    ? missionVerificationLabel(offer.verificationStatus)
    : explicitMissionVerificationTag(concept.specificityBadges);
  const requiresMissionItems = variants.some((variant) => variant.requiredItemSummary?.status === "present");
  const requiredItemCount = representative
    ? detailedRequiredItemCounts[representative.variantKey] ?? requiredItemRowCount(representative)
    : 0;
  const headerReputationScope = primaryRepScope(concept.rewardedReputationPaths, concept.reputationScope.displayName);
  const sourceBackedFaction = concept.rewardedReputationPaths.find((path) => (
    path.confidence !== "unresolved" && !/^unknown(?: faction)?$/i.test(path.factionDisplayName)
  ))?.factionDisplayName;
  const headerFaction = offer
    ? missionOfferProvider(offer)
    : /^unknown(?: faction)?$/i.test(concept.factionDisplayName) && sourceBackedFaction
    ? sourceBackedFaction
    : concept.factionDisplayName;
  const legalClassification = legalClassificationSummary(variants);
  const displayTitle = offer?.displayTitle ?? concept.displayName;
  const displayType = offer?.missionTypes.join(" / ") || concept.displayCategory.label;
  const bookmarkKey = offer?.offerKey ?? concept.conceptKey;
  return (
    <section className={`mb-detail mission-group-expansion mission-concept-dossier ${repScopeClass(concept.reputationScope.displayName)}`} aria-label={`${displayTitle} mission offer details`}>
      <header className="mission-dossier-header">
        <div className="mission-dossier-header__identity">
          <span className="mission-faction-initials" aria-hidden="true">{factionInitials(concept.factionDisplayName)}</span>
          <div>
            <h2>{displayTitle}</h2>
            <p>{headerFaction} / {displayType}</p>
            <div className="mb-badges">
              <span className={`mission-rep-scope-badge ${repScopeClass(headerReputationScope)}`}>{shortRepScope(headerReputationScope)}</span>
              {verificationTag && <Badge tone={offer?.verificationStatus === "verified" || verificationTag === "Verified Mission" ? "is-verified" : offer?.verificationStatus === "unknown" ? "is-muted" : "is-unverified"}>{verificationTag}</Badge>}
              <Badge tone="is-type">{displayType}</Badge>
              <Badge tone={allBlueprintGroups.length ? "is-blueprint" : "is-muted"}>{allBlueprintGroups.length ? `${allBlueprintGroups.length} blueprint pool${allBlueprintGroups.length === 1 ? "" : "s"}` : "No blueprint rewards reported"}</Badge>
              {requiresMissionItems && <Badge tone="is-amber">{requiredItemCount ? `${requiredItemCount} required item${requiredItemCount === 1 ? "" : "s"}` : "Mission items required"}</Badge>}
            </div>
            {(showRiskTierSelector || availabilityGroups.length > 1) && (
              <div className="mission-dossier-header__controls">
                {showRiskTierSelector && (
                  <div className="mission-dossier-inline-control">
                    <span>Risk Tier</span>
                    <div className="mission-dossier-tabs" role="tablist" aria-label="Mission risk or tier">
                      {meaningfulTiers.map(([tierKey, tierVariants]) => (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={selectedTier?.[0] === tierKey}
                          className={selectedTier?.[0] === tierKey ? "is-active" : ""}
                          key={tierKey}
                          onClick={() => {
                            setSelectedTierKey(tierKey);
                            setSelectedAvailabilityKey("");
                          }}
                        >
                          {tierVariants[0]?.tierLabel ?? tierKey}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {availabilityGroups.length > 1 && (
                  <div className="mission-dossier-inline-control">
                    <span>Systems</span>
                    <div
                      className="mission-dossier-location-badges is-inline"
                      role={availabilityGroups.length > 1 ? "tablist" : undefined}
                      aria-label="Mission pickup and availability"
                    >
                      {availabilityGroups.map(([groupKey, groupVariants]) => {
                        const locationBadge = availabilityBadges.get(groupKey)!;
                        if (availabilityGroups.length === 1) {
                          return <Badge key={groupKey} tone={locationBadge.unresolved ? "is-muted" : locationBadge.tone} title={pickupDetail(groupVariants[0]!.pickupLocation)}>{`${groupKey} / ${groupVariants.length} variant${groupVariants.length === 1 ? "" : "s"}`}</Badge>;
                        }
                        return (
                          <button
                            type="button"
                            role="tab"
                            aria-selected={selectedAvailability?.[0] === groupKey}
                            className={`${locationBadge.unresolved ? "is-unresolved" : locationBadge.tone}${selectedAvailability?.[0] === groupKey ? " is-active" : ""}`}
                            key={groupKey}
                            onClick={() => setSelectedAvailabilityKey(groupKey)}
                            title={pickupDetail(groupVariants[0]!.pickupLocation)}
                          >
                            {groupKey} / {groupVariants.length}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="mission-dossier-header__actions">
          {offer
            ? <span className="mission-dossier-legal">Verification: {missionVerificationLabel(offer.verificationStatus)}</span>
            : <span className="mission-dossier-legal">Legal classification: {legalClassification}</span>}
          <button
            type="button"
            className={`mission-dossier-bookmark${isBookmarked ? " is-active" : ""}`}
            aria-pressed={isBookmarked}
            aria-label={isBookmarked ? `Remove ${displayTitle} bookmark` : `Bookmark ${displayTitle}`}
            onClick={() => onToggleBookmark(bookmarkKey)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 4h10v16l-5-3.2L7 20V4Z" />
            </svg>
          </button>
          <button type="button" className="mission-dossier-close" aria-label="Close selected mission details" onClick={onClose}>×</button>
        </div>
      </header>
      <div className="mission-selected-hero__facts">
        {facts.map((fact) => (
          <span key={fact.label}>
            <MissionFactIcon label={fact.label} />
            <span><strong>{fact.value}</strong><small>{fact.label}</small></span>
          </span>
        ))}
      </div>
      {representative && (
        <section className="mission-dossier-panel">
          <DossierBody
            key={selectedAvailability?.[0]}
            variants={selectedVariants}
            selectedVariant={representative}
            onSelectVariant={(variantKey) => {
              setSelectedDossierVariantKey(variantKey);
              onSelectVariant?.(variantKey);
            }}
            onFooterChange={onFooterChange}
            onRequiredItemCountChange={handleRequiredItemCountChange}
          />
        </section>
      )}
    </section>
  );
}

type MissionComparisonSort = "mission" | "system" | "tier" | "payout" | "standing";

function MissionEligibilityWorkspace({
  variant,
  onBack,
}: {
  variant: MissionVariantView;
  onBack: () => void;
}) {
  const [crimeStat, setCrimeStat] = useState<"unknown" | "0" | "1" | "2" | "3" | "4" | "5">("unknown");
  const [contractKnowledge, setContractKnowledge] = useState<"complete" | "partial">("partial");
  const [tagKnowledge, setTagKnowledge] = useState<"complete" | "partial">("partial");
  const [activeSurface, setActiveSurface] = useState<"eligibility" | "path">("eligibility");
  const [evaluation, setEvaluation] = useState<MissionEligibilityPayload | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState("");
  const [pathEvaluation, setPathEvaluation] = useState<MissionPathPayload | null>(null);
  const [solvingPath, setSolvingPath] = useState(false);
  const [pathError, setPathError] = useState("");
  const [pathVariantNames, setPathVariantNames] = useState<Record<string, string>>({});
  const [selectedPathIndex, setSelectedPathIndex] = useState(0);

  function playerState(): PlayerMissionStateView {
    return {
      completedContracts: { knowledge: contractKnowledge, countsByContract: {} },
      completionTags: { knowledge: tagKnowledge, countsByTag: {} },
      reputation: [],
      crimeStat: crimeStat === "unknown" ? { status: "unknown" } : { status: "known", value: Number(crimeStat) },
      location: { status: "unknown" },
    };
  }

  async function evaluate() {
    setActiveSurface("eligibility");
    setEvaluating(true);
    setEvaluationError("");
    try {
      setEvaluation(await evaluateMissionVariantEligibility(variant.variantKey, playerState()));
    } catch (reason) {
      setEvaluationError(reason instanceof Error ? reason.message : "Eligibility evaluation unavailable");
    } finally {
      setEvaluating(false);
    }
  }

  async function findPath() {
    setActiveSurface("path");
    setSelectedPathIndex(0);
    setSolvingPath(true);
    setPathError("");
    try {
      setPathEvaluation(await solveMissionVariantPrerequisitePath(variant.variantKey, playerState()));
    } catch (reason) {
      setPathError(reason instanceof Error ? reason.message : "Prerequisite path unavailable");
    } finally {
      setSolvingPath(false);
    }
  }

  const resultExplanations = evaluation?.result.explanations ?? [];
  const pathResult = pathEvaluation?.result;
  const pathPlans = useMemo(
    () => pathResult?.primaryPlan ? [pathResult.primaryPlan, ...pathResult.alternatePlans] : [],
    [pathResult],
  );
  const selectedPathPlan = pathPlans[selectedPathIndex] ?? pathPlans[0] ?? null;
  const pathSteps = useMemo(() => selectedPathPlan?.steps ?? [], [selectedPathPlan]);

  useEffect(() => {
    const variantIds = Array.from(new Set(
      pathSteps.map((step) => step.variantId),
    ));
    if (!variantIds.length) {
      setPathVariantNames({});
      return;
    }
    let cancelled = false;
    Promise.all(variantIds.map(async (variantId) => {
      try {
        return [variantId, (await loadMissionVariantDetail(variantId)).displayName] as const;
      } catch {
        return [variantId, "Exact prerequisite mission"] as const;
      }
    })).then((entries) => {
      if (!cancelled) setPathVariantNames(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [pathSteps]);
  return (
    <section className="mission-eligibility-workspace" aria-label={`${variant.displayName} eligibility`}>
      <header>
        <div>
          <span className="mb-kicker">Exact variant eligibility</span>
          <h3>{variant.displayName}</h3>
          <p>Only facts entered here are treated as known.</p>
        </div>
        <button type="button" onClick={onBack}>Back to comparison</button>
      </header>
      <div className="mission-solver-tabs" role="tablist" aria-label="Mission solver workspace">
        <button type="button" role="tab" aria-selected={activeSurface === "eligibility"} className={activeSurface === "eligibility" ? "is-active" : ""} onClick={() => setActiveSurface("eligibility")}>Eligibility</button>
        <button type="button" role="tab" aria-selected={activeSurface === "path"} className={activeSurface === "path" ? "is-active" : ""} onClick={() => setActiveSurface("path")}>Unlock path</button>
      </div>
      <div className="mission-eligibility-layout">
        <form onSubmit={(event) => { event.preventDefault(); void evaluate(); }}>
          <label>
            <span>CrimeStat</span>
            <select value={crimeStat} onChange={(event) => setCrimeStat(event.target.value as typeof crimeStat)}>
              <option value="unknown">Unknown</option>
              {[0, 1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>Contract history</span>
            <select value={contractKnowledge} onChange={(event) => setContractKnowledge(event.target.value as "complete" | "partial")}>
              <option value="partial">Partial / not connected</option>
              <option value="complete">Complete, no prior contracts</option>
            </select>
          </label>
          <label>
            <span>Mission-tag history</span>
            <select value={tagKnowledge} onChange={(event) => setTagKnowledge(event.target.value as "complete" | "partial")}>
              <option value="partial">Partial / not connected</option>
              <option value="complete">Complete, no earned tags</option>
            </select>
          </label>
          <div className="mission-eligibility-actions">
            <button type="submit" className="is-primary" disabled={evaluating}>{evaluating ? "Evaluating..." : "Evaluate eligibility"}</button>
            <button type="button" disabled={solvingPath} onClick={() => void findPath()}>{solvingPath ? "Solving..." : "Find prerequisite path"}</button>
          </div>
        </form>
        <div className="mission-solver-results" aria-live="polite">
          {activeSurface === "eligibility" ? <div className="mission-eligibility-result" role="tabpanel">
            {!evaluation && !evaluationError && <p>Reputation and location remain unknown. The result will preserve those uncertainties.</p>}
            {evaluationError && <p className="is-error">{evaluationError}</p>}
            {evaluation && (
              <>
                <div className={`mission-eligibility-status is-${evaluation.result.status}`}>
                  <span>Eligibility</span>
                  <strong>{evaluation.result.status}</strong>
                </div>
                <ul>
                  {resultExplanations.map((explanation, index) => (
                    <li className={`is-${explanation.status}`} key={`${explanation.code}-${index}`}>
                      <strong>{explanation.status}</strong>
                      <span>{explanation.message}</span>
                    </li>
                  ))}
                </ul>
                <small>Evaluated against mission generation {evaluation.generationId}.</small>
              </>
            )}
          </div> : <section className="mission-path-result" aria-label="Prerequisite path" role="tabpanel">
            {!pathResult && !pathError && (
              <p>Find a mission-count path through proven completion-tag dependencies. Travel and time are not estimated.</p>
            )}
            {pathError && <p className="is-error">{pathError}</p>}
            {pathResult && (
              <>
                <div className={`mission-eligibility-status is-${pathResult.status}`}>
                  <span>Prerequisite path</span>
                  <strong>{pathResult.status.replace("_", " ")}</strong>
                </div>
                {pathResult.status === "satisfied" && (
                  <p>No prerequisite mission completions are required for the supplied state.</p>
                )}
                {pathResult.minimumMissionCount !== null && (
                  <p className="mission-path-summary">
                    <strong>{pathResult.minimumMissionCount}</strong> prerequisite mission{pathResult.minimumMissionCount === 1 ? "" : "s"}. Target mission is not included.
                  </p>
                )}
                {pathPlans.length > 1 && (
                  <div className="mission-path-alternates" role="group" aria-label="Equal mission-count paths">
                    {pathPlans.map((_, index) => (
                      <button type="button" className={selectedPathIndex === index ? "is-active" : ""} aria-pressed={selectedPathIndex === index} onClick={() => setSelectedPathIndex(index)} key={index}>
                        {index === 0 ? "Primary path" : `Alternate ${index}`}
                      </button>
                    ))}
                  </div>
                )}
                {pathSteps.length > 0 && (
                  <ol>
                    {pathSteps.map((step) => (
                      <li key={step.variantId}>
                        <span>Step {step.ordinal}</span>
                        <strong>{pathVariantNames[step.variantId] ?? "Loading prerequisite mission..."}</strong>
                        <small>{Object.keys(step.grantedCompletionTags).length} source-backed completion outcome{Object.keys(step.grantedCompletionTags).length === 1 ? "" : "s"}</small>
                      </li>
                    ))}
                  </ol>
                )}
                {pathResult.failures.length > 0 && (
                  <ul className="mission-path-failures">
                    {pathResult.failures.map((failure, index) => <li key={`${failure.code}-${index}`}>{failure.message}</li>)}
                  </ul>
                )}
                {pathResult.relevantCycles.length > 0 && <p className="mission-path-warning">A source-backed dependency cycle affects this result.</p>}
                {pathResult.alternatePlansTruncated && <p className="mission-path-warning">Additional equal mission-count paths exist but are not included in this response.</p>}
                {pathSteps[0]?.assumptions.length ? (
                  <details>
                    <summary>Path assumptions</summary>
                    {pathSteps[0].assumptions.map((assumption) => <p key={assumption}>{assumption}</p>)}
                  </details>
                ) : null}
                <small>
                  Cost: {pathResult.minimumMissionCount ?? "unresolved"} mission completion{pathResult.minimumMissionCount === 1 ? "" : "s"}.
                  {pathResult.alternatePlans.length > 0 ? ` ${pathResult.alternatePlans.length} equal-minimum alternate${pathResult.alternatePlans.length === 1 ? "" : "s"} retained.` : ""}
                  {" "}Generation {pathEvaluation.generationId}.
                </small>
              </>
            )}
          </section>}
        </div>
      </div>
    </section>
  );
}

function exactVariantIsActive(variant: MissionVariantView): boolean {
  return !variant.releaseFlags.includes("Not for release") && !variant.releaseFlags.includes("Work in progress");
}

function exactVariantPayout(variant: MissionVariantView): number | undefined {
  const calculated = variant.rewards.creditsDetail?.payout;
  if (
    calculated?.calculationStatus === "resolved"
    && typeof calculated.baseSoloAmount === "number"
    && Number.isFinite(calculated.baseSoloAmount)
  ) return calculated.baseSoloAmount;
  const fixed = variant.rewards.creditsDetail?.amount;
  return typeof fixed === "number" && Number.isFinite(fixed) ? fixed : undefined;
}

function exactVariantSystem(variant: MissionVariantView): string {
  const systems = variant.locationRoles?.pickup?.systems ?? [];
  return systems.length ? systems.join(", ") : variant.pickupLocation.system ?? "Unknown";
}

function exactVariantBlueprintBookmarkIds(variant: MissionVariantView): string[] {
  const contractId = variant.technical.contractId;
  if (!contractId) return [];
  return Array.from(new Set(
    variant.rewards.blueprintRewardGroups
      .map((group) => group.poolGuid)
      .filter((poolGuid): poolGuid is string => Boolean(poolGuid))
      .map((poolGuid) => missionRewardSourceBookmarkId(contractId, poolGuid)),
  ));
}

function compareOptionalNumbers(left: number | undefined, right: number | undefined): number {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return left - right;
}

function MissionSelectedWorkspace({
  concept,
  offer,
  variants,
  initialVariantKey,
  loading,
  error,
  isBookmarked,
  bookmarkedMissionIds,
  onToggleBookmark,
  onToggleRewardBookmarks,
  onSelectVariant,
  onClose,
}: {
  concept: MissionConceptView;
  offer?: MissionOfferView;
  variants?: MissionVariantView[];
  initialVariantKey?: string;
  loading: boolean;
  error?: string;
  isBookmarked: boolean;
  bookmarkedMissionIds: ReadonlySet<string>;
  onToggleBookmark: (identityKey: string) => void;
  onToggleRewardBookmarks: (bookmarkIds: string[]) => void;
  onSelectVariant?: (variantKey: string) => void;
  onClose: () => void;
}) {
  const [availability, setAvailability] = useState<"active" | "all">("active");
  const [sort, setSort] = useState<MissionComparisonSort>("mission");
  const [descending, setDescending] = useState(false);
  const [eligibilityVariant, setEligibilityVariant] = useState<MissionVariantView | null>(null);
  const [dossierFooter, setDossierFooter] = useState<MissionDossierFooterState | null>(null);
  const activeVariants = useMemo(() => (variants ?? []).filter(exactVariantIsActive), [variants]);
  const visibleVariants = useMemo(() => {
    const rows = availability === "active" ? activeVariants : (variants ?? []);
    return [...rows].sort((left, right) => {
      const direction = descending ? -1 : 1;
      const compared = sort === "payout"
        ? compareOptionalNumbers(exactVariantPayout(left), exactVariantPayout(right))
        : sort === "system"
          ? exactVariantSystem(left).localeCompare(exactVariantSystem(right))
          : sort === "tier"
            ? (left.tierLabel ?? "Unknown").localeCompare(right.tierLabel ?? "Unknown")
            : sort === "standing"
              ? left.standingRequirement.localeCompare(right.standingRequirement)
              : left.displayName.localeCompare(right.displayName);
      return direction * (compared || left.variantKey.localeCompare(right.variantKey));
    });
  }, [activeVariants, availability, descending, sort, variants]);
  const systems = useMemo(
    () => Array.from(new Set((variants ?? []).map(exactVariantSystem))).sort(),
    [variants],
  );
  const payouts = useMemo(
    () => (variants ?? []).map(exactVariantPayout).filter((value): value is number => value !== undefined),
    [variants],
  );
  const payoutSummary = payouts.length
    ? `${Math.min(...payouts).toLocaleString()}-${Math.max(...payouts).toLocaleString()} aUEC`
    : "Payout unresolved";

  function selectSort(nextSort: MissionComparisonSort) {
    if (sort === nextSort) setDescending((current) => !current);
    else {
      setSort(nextSort);
      setDescending(false);
    }
  }

  return (
    <section className={`mission-selected-workspace ops-primary-card${eligibilityVariant ? " is-solver-open" : ""}`} aria-label={`${offer?.displayTitle ?? concept.displayName} selected mission workspace`}>
      {variants && (
        <ConceptDetail
          concept={concept}
          offer={offer}
          variants={variants}
          initialVariantKey={initialVariantKey}
          facts={[
            { value: activeVariants.length, label: `Active variant${activeVariants.length === 1 ? "" : "s"}` },
            { value: variants.length, label: `Exact variant${variants.length === 1 ? "" : "s"}` },
            { value: systems.length === 1 ? systems[0]! : systems.length || "—", label: systems.length === 1 ? "Pickup" : "Pickup scopes" },
            { value: payoutSummary === "Payout unresolved" ? "Unresolved" : payoutSummary, label: "Payout" },
            { value: variants.filter((variant) => variant.requiredItemSummary?.status === "present").length, label: "Require mission items" },
          ]}
          isBookmarked={isBookmarked}
          onToggleBookmark={onToggleBookmark}
          onSelectVariant={onSelectVariant}
          onClose={onClose}
          onFooterChange={setDossierFooter}
        />
      )}
      {loading && <div className="mission-selected-state">Loading exact variants...</div>}
      {error && <div className="mission-selected-state is-error">{error}</div>}
      {variants && (
        eligibilityVariant ? (
          <MissionEligibilityWorkspace variant={eligibilityVariant} onBack={() => setEligibilityVariant(null)} />
        ) : <div className="mission-comparison">
          <div className="mission-comparison__toolbar">
            <div>
              <strong>Exact mission comparison</strong>
              <span>{visibleVariants.length} {availability === "active" ? "active" : "total"} variants</span>
            </div>
            <div className="mission-comparison__availability" role="group" aria-label="Mission availability">
              <button type="button" className={availability === "active" ? "is-active" : ""} aria-pressed={availability === "active"} onClick={() => setAvailability("active")}>Active variants</button>
              <button type="button" className={availability === "all" ? "is-active" : ""} aria-pressed={availability === "all"} onClick={() => setAvailability("all")}>All variants</button>
            </div>
          </div>
          <div className="mission-comparison__scroll">
            <table>
              <thead>
                <tr>
                  {([
                    ["mission", "Mission"],
                    ["system", "Pickup"],
                    ["tier", "Tier"],
                    ["standing", "Standing"],
                    ["payout", "Base / solo"],
                  ] as Array<[MissionComparisonSort, string]>).map(([key, label]) => (
                    <th key={key}>
                      <button type="button" onClick={() => selectSort(key)} aria-label={`Sort by ${label}`}>
                        {label}{sort === key ? (descending ? " ↓" : " ↑") : ""}
                      </button>
                    </th>
                  ))}
                  <th>Reputation</th>
                  <th>Items / Blueprints</th>
                  <th>Availability</th>
                  <th>Eligibility</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleVariants.map((variant) => {
                  const payout = exactVariantPayout(variant);
                  const requiredItems = variant.requiredItemSummary?.status === "present";
                  const rep = repPathSummary(variant.rewardedReputationPaths);
                  const blueprintBookmarkIds = exactVariantBlueprintBookmarkIds(variant);
                  const trackedBlueprints = blueprintBookmarkIds.filter((bookmarkId) => bookmarkedMissionIds.has(bookmarkId)).length;
                  const allBlueprintsTracked = blueprintBookmarkIds.length > 0 && trackedBlueprints === blueprintBookmarkIds.length;
                  return (
                    <tr data-variant-key={variant.variantKey} key={variant.variantKey}>
                      <td><strong>{variant.displayName}</strong><small>{variant.missionArchetype}</small></td>
                      <td>{exactVariantSystem(variant)}<small>{variant.pickupLocation.status.replaceAll("_", " ")}</small></td>
                      <td>{variant.tierLabel ?? "Unknown"}</td>
                      <td>{variant.standingRequirement || "Unknown"}</td>
                      <td className="is-numeric">{payout === undefined ? "Unresolved" : `${payout.toLocaleString()} aUEC`}</td>
                      <td>{rep}</td>
                      <td>
                        {requiredItems ? "Required" : variant.requiredItemSummary?.status === "proven_absent" ? "None" : "Unresolved"}
                        {blueprintBookmarkIds.length > 0 && (
                          <button
                            type="button"
                            className={`mission-blueprint-track${allBlueprintsTracked ? " is-active" : ""}`}
                            aria-pressed={allBlueprintsTracked}
                            onClick={() => onToggleRewardBookmarks(blueprintBookmarkIds)}
                          >
                            {allBlueprintsTracked ? "Rewards tracked" : trackedBlueprints > 0 ? "Track remaining rewards" : "Track blueprint rewards"}
                          </button>
                        )}
                      </td>
                      <td><Badge tone={exactVariantIsActive(variant) ? "is-green" : "is-muted"}>{exactVariantIsActive(variant) ? "Active" : variant.releaseFlags.join(" / ") || "Unavailable"}</Badge></td>
                      <td>{requiredItems ? "Requires mission items" : "Check prerequisites"}</td>
                      <td><button type="button" className="mission-eligibility-open" onClick={() => setEligibilityVariant(variant)}>Check</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!visibleVariants.length && <p className="mb-empty-note">No active variants are available for this concept. Choose All variants to inspect authored records.</p>}
        </div>
      )}
      {dossierFooter && <DossierFooter {...dossierFooter} />}
    </section>
  );
}

void FamilyDetail;
void VariantTabs;

export default function MissionBrowserPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { missionSlug } = useParams<{ missionSlug?: string }>();
  const [catalog, setCatalog] = useState<MissionBrowserCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conceptVariantsByKey, setConceptVariantsByKey] = useState<Record<string, MissionVariantView[]>>({});
  const [conceptLoadingKey, setConceptLoadingKey] = useState("");
  const [conceptErrors, setConceptErrors] = useState<Record<string, string>>({});
  const [offerVariantsByKey, setOfferVariantsByKey] = useState<Record<string, MissionVariantView[]>>({});
  const [offerLoadingKey, setOfferLoadingKey] = useState("");
  const [offerErrors, setOfferErrors] = useState<Record<string, string>>({});
  const [bookmarkedMissionIds, setBookmarkedMissionIds] = useState<Set<string>>(
    () => readStoredStringSet(MISSION_BOOKMARK_STORAGE_KEY),
  );

  const families = useMemo(() => catalog?.families ?? [], [catalog]);
  const familiesByKey = useMemo(() => new Map(families.map((family) => [family.familyKey, family])), [families]);
  const conceptsByKey = useMemo(() => new Map(Object.entries(catalog?.conceptsByKey ?? {})), [catalog]);
  const offersByKey = useMemo(() => new Map(Object.entries(catalog?.offersByKey ?? {})), [catalog]);
  const isOfferCatalog = catalog?.schemaVersion === 3;
  const query = searchParams.get("search") ?? "";
  const provider = searchParams.get("provider") ?? "";
  const missionType = searchParams.get("type") ?? "";
  const reward = searchParams.get("reward") ?? "";
  const repReward = searchParams.get("repReward") ?? "";
  const status = searchParams.get("status") ?? (isOfferCatalog ? "Release flag not set" : "");
  const confidence = searchParams.get("confidence") ?? "";
  const verification = searchParams.get("verification") ?? "";
  const requestedView = searchParams.get("view");
  const exactSearchedFaction = (catalog?.filtersMeta?.factions ?? []).find((item) => item.label.toLowerCase() === query.trim().toLowerCase())?.label;
  const activeView: BrowserView = requestedView === "faction" || requestedView === "reputation" || requestedView === "full"
    ? requestedView
    : provider || exactSearchedFaction ? "faction" : "full";
  const routeConceptKey = missionConceptKeyFromSlug(missionSlug);
  const legacyDossierConceptKey = searchParams.get("concept") ?? "";
  const legacySelectedValue = searchParams.get("selected") ?? "";
  const selectedExactVariantKey = searchParams.get("variant")
    ?? searchParams.get("contract")
    ?? (catalog?.variantOfferKeys?.[legacySelectedValue] ? legacySelectedValue : "");
  const legacySelectedConceptKey = catalog?.variantOfferKeys?.[legacySelectedValue] ? legacyDossierConceptKey : legacySelectedValue || legacyDossierConceptKey;
  const selectedConceptKey = routeConceptKey || legacySelectedConceptKey;
  const selectedConcept = isOfferCatalog ? undefined : conceptsByKey.get(selectedConceptKey);
  const selectedConceptVariants = conceptVariantsByKey[selectedConceptKey];
  const legacyResolution = isOfferCatalog && selectedConceptKey
    ? resolveLegacyMissionConcept(selectedConceptKey, catalog?.legacyConceptOfferKeys ?? {})
    : undefined;
  const selectedOfferKey = searchParams.get("offer")
    ?? (selectedExactVariantKey ? catalog?.variantOfferKeys?.[selectedExactVariantKey] : undefined)
    ?? (legacyResolution?.kind === "offer" ? legacyResolution.offerKey : "");
  const selectedOffer = offersByKey.get(selectedOfferKey);
  const selectedOfferVariants = offerVariantsByKey[selectedOfferKey];
  const selectedOfferConcept = selectedOffer?.legacyConceptKeys
    .map((conceptKey) => conceptsByKey.get(conceptKey))
    .find((concept): concept is MissionConceptView => Boolean(concept));
  const selectedConceptTriggerRef = useRef<HTMLButtonElement | null>(null);
  const modalShellRef = useRef<HTMLDivElement | null>(null);
  const requestedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const navigateWithParams = useCallback((pathname: string, params: URLSearchParams, replace = false) => {
    const search = params.toString();
    navigate({ pathname, search: search ? `?${search}` : "" }, { replace });
  }, [navigate]);
  const toggleMissionBookmark = useCallback((conceptKey: string) => {
    setBookmarkedMissionIds((current) => {
      const next = new Set(current);
      if (hasMissionConceptBookmark(next, conceptKey)) {
        next.delete(conceptKey);
        next.delete(missionConceptBookmarkId(conceptKey));
      } else {
        next.add(missionConceptBookmarkId(conceptKey));
      }
      writeStoredStringSet(MISSION_BOOKMARK_STORAGE_KEY, next);
      return next;
    });
  }, []);
  const toggleMissionOfferBookmark = useCallback((offerKey: string) => {
    setBookmarkedMissionIds((current) => {
      const next = new Set(current);
      const bookmarkId = missionOfferBookmarkId(offerKey);
      const oneToOneLegacyKeys = Object.entries(catalog?.legacyConceptOfferKeys ?? {})
        .filter(([, offerKeys]) => offerKeys.length === 1 && offerKeys[0] === offerKey)
        .map(([conceptKey]) => conceptKey)
        .filter((conceptKey) => hasMissionConceptBookmark(next, conceptKey));
      if (next.has(bookmarkId)) next.delete(bookmarkId);
      else if (oneToOneLegacyKeys.length) {
        for (const conceptKey of oneToOneLegacyKeys) {
          next.delete(conceptKey);
          next.delete(missionConceptBookmarkId(conceptKey));
        }
      } else next.add(bookmarkId);
      writeStoredStringSet(MISSION_BOOKMARK_STORAGE_KEY, next);
      return next;
    });
  }, [catalog?.legacyConceptOfferKeys]);
  const toggleMissionRewardBookmarks = useCallback((bookmarkIds: string[]) => {
    setBookmarkedMissionIds((current) => {
      const next = new Set(current);
      const allTracked = bookmarkIds.length > 0 && bookmarkIds.every((bookmarkId) => next.has(bookmarkId));
      for (const bookmarkId of bookmarkIds) {
        if (allTracked) next.delete(bookmarkId);
        else next.add(bookmarkId);
      }
      writeStoredStringSet(MISSION_BOOKMARK_STORAGE_KEY, next);
      return next;
    });
  }, []);
  const missionFilters = useMemo(() => ({
    search: query,
    provider,
    type: missionType,
    reward,
    repReward,
    status,
    confidence,
    verification,
  }), [confidence, missionType, provider, query, repReward, reward, status, verification]);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });
    loadMissionData(missionFilters)
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Mission browser catalog unavailable");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [missionFilters]);

  useEffect(() => {
    if (!selectedConcept) return;
    const canonicalSlug = missionConceptSlug(selectedConcept);
    const isLegacyMissionLink = !missionSlug && Boolean(legacySelectedConceptKey);
    const hasStaleSlug = Boolean(missionSlug) && missionSlug !== canonicalSlug;
    if (!isLegacyMissionLink && !hasStaleSlug) return;

    const next = new URLSearchParams(searchParams);
    next.delete("selected");
    next.delete("concept");
    next.delete("dossier");
    navigateWithParams(missionConceptPath(selectedConcept), next, true);
  }, [
    legacySelectedConceptKey,
    missionSlug,
    navigateWithParams,
    searchParams,
    selectedConcept,
  ]);

  useEffect(() => {
    if (!isOfferCatalog || legacyResolution?.kind !== "offer" || searchParams.get("offer") === legacyResolution.offerKey) return;
    const next = new URLSearchParams(searchParams);
    next.set("offer", legacyResolution.offerKey);
    if (selectedExactVariantKey) next.set("variant", selectedExactVariantKey);
    next.delete("selected");
    next.delete("concept");
    next.delete("dossier");
    navigateWithParams(MISSION_BROWSER_PATH, next, true);
  }, [isOfferCatalog, legacyResolution, navigateWithParams, searchParams, selectedExactVariantKey]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === MISSION_BOOKMARK_STORAGE_KEY) {
        setBookmarkedMissionIds(readStoredStringSet(MISSION_BOOKMARK_STORAGE_KEY));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const concept = conceptsByKey.get(selectedConceptKey);
    if (isOfferCatalog || !concept || conceptVariantsByKey[selectedConceptKey]) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setConceptLoadingKey(selectedConceptKey);
      setConceptErrors((current) => {
        const next = { ...current };
        delete next[selectedConceptKey];
        return next;
      });
    });
    loadMissionConceptVariants(concept)
      .then((variants) => {
        if (cancelled) return;
        setConceptVariantsByKey((current) => ({ ...current, [selectedConceptKey]: variants }));
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setConceptErrors((current) => ({
          ...current,
          [selectedConceptKey]: reason instanceof Error ? reason.message : "Mission concept variants unavailable",
        }));
      })
      .finally(() => {
        if (!cancelled) setConceptLoadingKey((current) => current === selectedConceptKey ? "" : current);
      });
    return () => {
      cancelled = true;
    };
  }, [conceptVariantsByKey, conceptsByKey, isOfferCatalog, selectedConceptKey]);

  useEffect(() => {
    if (!isOfferCatalog || !selectedOffer || offerVariantsByKey[selectedOfferKey]) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setOfferLoadingKey(selectedOfferKey);
      setOfferErrors((current) => {
        const next = { ...current };
        delete next[selectedOfferKey];
        return next;
      });
    });
    loadMissionOfferVariants(selectedOfferKey)
      .then((variants) => {
        if (!cancelled) setOfferVariantsByKey((current) => ({ ...current, [selectedOfferKey]: variants }));
      })
      .catch((reason: unknown) => {
        if (!cancelled) setOfferErrors((current) => ({
          ...current,
          [selectedOfferKey]: reason instanceof Error ? reason.message : "Mission offer variants unavailable",
        }));
      })
      .finally(() => {
        if (!cancelled) setOfferLoadingKey((current) => current === selectedOfferKey ? "" : current);
      });
    return () => { cancelled = true; };
  }, [isOfferCatalog, offerVariantsByKey, selectedOffer, selectedOfferKey]);

  const providers = useMemo(
    () => isOfferCatalog
      ? Array.from(new Map(Array.from(offersByKey.values()).map((offer) => [offer.providerKey, {
        key: offer.providerKey,
        label: missionOfferProvider(offer),
        count: 0,
      }])).values()).sort((left, right) => left.label.localeCompare(right.label))
      : catalog?.filtersMeta?.factions ?? Array.from(new Set(families.map((family) => family.provider))).sort().map((value) => ({ key: value, label: value, count: 0 })),
    [catalog, families, isOfferCatalog, offersByKey],
  );
  const missionTypes = useMemo(
    () => isOfferCatalog
      ? Array.from(new Set(Array.from(offersByKey.values()).flatMap((offer) => offer.missionTypes))).sort().map((value) => ({ key: value, label: value, count: 0 }))
      : catalog?.filtersMeta?.missionTypes ?? Array.from(new Set(families.map((family) => family.missionType))).sort().map((value) => ({ key: value, label: value, count: 0 })),
    [catalog, families, isOfferCatalog, offersByKey],
  );
  const rewardedRepPaths = useMemo(
    () => isOfferCatalog
      ? Array.from(Array.from(offersByKey.values()).reduce((options, offer) => {
        for (const facet of offer.reputationRewardFacets ?? []) {
          const existing = options.get(facet.stableKey);
          options.set(facet.stableKey, {
            key: facet.stableKey,
            label: existing?.label ?? offerReputationFilterLabel(facet),
            count: (existing?.count ?? 0) + 1,
          });
        }
        return options;
      }, new Map<string, { key: string; label: string; count: number }>()).values())
        .sort((left, right) => left.label.localeCompare(right.label) || left.key.localeCompare(right.key))
      : catalog?.filtersMeta?.reputationScopes ?? Array.from(new Set(families.flatMap((family) => family.rewardedReputationPaths.map((path) => path.scopeDisplayName)))).sort().map((value) => ({ key: value, label: value, count: 0 })),
    [catalog, families, isOfferCatalog, offersByKey],
  );
  const rewardOptions = catalog?.filtersMeta?.rewardTypes ?? [
    { key: "blueprints", label: "Blueprint rewards", count: 0 },
    { key: "reputation", label: "Reputation rewards", count: 0 },
    { key: "credits-fixed", label: "Credits fixed", count: 0 },
    { key: "credits-calculated", label: AUEC_REWARD_NOT_REPORTED, count: 0 },
    { key: "credits-variable", label: "Variable payout", count: 0 },
    { key: "credits-formula-unresolved", label: "Credits formula unresolved", count: 0 },
    { key: "credits-unresolved", label: "Credits unresolved", count: 0 },
    { key: "credits-none", label: "No credit reward extracted", count: 0 },
    { key: "items", label: "Item reward", count: 0 },
    { key: "items-unresolved", label: "Item reward unresolved", count: 0 },
  ];
  const statuses = catalog?.filtersMeta?.releaseStates ?? ["Release flag not set", "Not for release", "Work in progress"].map((value) => ({ key: value, label: value, count: 0 }));
  const confidenceOptions = isOfferCatalog ? [
    { key: "unresolved", label: "Any unresolved", count: 0 },
    { key: "locations", label: "Locations unresolved", count: 0 },
    { key: "rewards", label: "Rewards unresolved", count: 0 },
    { key: "prerequisites", label: "Prerequisites unresolved", count: 0 },
  ] : catalog?.filtersMeta?.confidenceStates ?? [
    { key: "unresolved", label: "Any unresolved", count: 0 },
    { key: "locations", label: "Locations unresolved", count: 0 },
    { key: "rewards", label: "Rewards unresolved", count: 0 },
    { key: "crime-bounded", label: "CrimeStat limited", count: 0 },
    { key: "unlawful", label: "Possible unlawful", count: 0 },
  ];

  const offerProjection = useMemo(() => {
    if (!isOfferCatalog) return {
      visibleOfferCount: 0,
      offerTotalPages: 1,
      offerCurrentPage: 1,
      pagedOffers: [] as MissionOfferView[],
    };
    const visibleOffers = Array.from(offersByKey.values()).filter((offer) => missionOfferMatchesClientFilters(offer, {
      search: query,
      provider,
      type: missionType,
      reward,
      repReward,
      status,
      confidence,
      verification,
    })).sort((left, right) => left.displayTitle.localeCompare(right.displayTitle) || left.offerKey.localeCompare(right.offerKey));
    const offerTotalPages = Math.max(1, Math.ceil(visibleOffers.length / OFFERS_PER_PAGE));
    const selectedOfferIndex = selectedOfferKey ? visibleOffers.findIndex((offer) => offer.offerKey === selectedOfferKey) : -1;
    const requestedCurrentPage = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), offerTotalPages) : 1;
    const offerCurrentPage = selectedOfferIndex >= 0
      ? Math.floor(selectedOfferIndex / OFFERS_PER_PAGE) + 1
      : requestedCurrentPage;
    return {
      visibleOfferCount: visibleOffers.length,
      offerTotalPages,
      offerCurrentPage,
      pagedOffers: visibleOffers.slice((offerCurrentPage - 1) * OFFERS_PER_PAGE, offerCurrentPage * OFFERS_PER_PAGE),
    };
  }, [confidence, isOfferCatalog, missionType, offersByKey, provider, query, repReward, requestedPage, reward, selectedOfferKey, status, verification]);

  const {
    visibleConceptCount,
    totalPages,
    currentPage,
    pagedFullCategories,
    pagedFactionViews,
    pagedReputationGroups,
  } = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const visibleFamilies = families.filter((family) => {
      if (normalizedQuery && !family.searchText.includes(normalizedQuery)) return false;
      if (provider && family.provider !== provider) return false;
      if (missionType && family.missionType !== missionType) return false;
      if (repReward && !family.rewardedReputationPaths.some((path) => path.scopeDisplayName === repReward)) return false;
      if (status && !family.releaseFlags.includes(status)) return false;
      if (!rewardMatches(family, reward)) return false;
      if (!confidenceMatches(family, confidence)) return false;
      return true;
    });
    const visibleFamilyKeys = new Set(visibleFamilies.map((family) => family.familyKey));
    const visibleConceptKeys = new Set(Array.from(conceptsByKey.values())
      .filter((concept) => concept.familyKeys.some((familyKey) => visibleFamilyKeys.has(familyKey)))
      .map((concept) => concept.conceptKey));
    const nextVisibleReputationGroups = (catalog?.browseViews?.reputation ?? catalog?.missionBrowseGroups ?? [])
      .map((group) => ({
        ...group,
        reputationScopes: group.reputationScopes
          .map((scope) => ({
            ...scope,
            conceptKeys: (scope.conceptKeys ?? []).filter((conceptKey) => visibleConceptKeys.has(conceptKey)),
          }))
          .filter((scope) => (scope.conceptKeys?.length ?? 0) > 0),
      }))
      .filter((group) => group.reputationScopes.length > 0);
    const nextVisibleFullCategories = (catalog?.browseViews?.full.categories ?? [])
      .map((category) => ({ ...category, conceptKeys: category.conceptKeys.filter((conceptKey) => visibleConceptKeys.has(conceptKey)) }))
      .filter((category) => category.conceptKeys.length > 0);
    const nextVisibleFactionViews = (catalog?.browseViews?.factions ?? [])
      .map((faction) => ({
        ...faction,
        categories: faction.categories
          .map((category) => ({ ...category, conceptKeys: category.conceptKeys.filter((conceptKey) => visibleConceptKeys.has(conceptKey)) }))
          .filter((category) => category.conceptKeys.length > 0),
      }))
      .filter((faction) => faction.categories.length > 0);
    const projectionConceptKeys = new Set(
      activeView === "full"
        ? nextVisibleFullCategories.flatMap((category) => category.conceptKeys)
        : activeView === "faction"
          ? nextVisibleFactionViews.flatMap((faction) => faction.categories.flatMap((category) => category.conceptKeys))
          : nextVisibleReputationGroups.flatMap((group) => group.reputationScopes.flatMap((scope) => scope.conceptKeys ?? [])),
    );
    const nextVisibleConceptCount = projectionConceptKeys.size;
    const nextTotalPages = Math.max(1, Math.ceil(nextVisibleConceptCount / CONCEPTS_PER_PAGE));
    const selectedConceptIndex = selectedConceptKey ? Array.from(projectionConceptKeys).indexOf(selectedConceptKey) : -1;
    const requestedCurrentPage = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), nextTotalPages) : 1;
    const nextCurrentPage = selectedConceptIndex >= 0
      ? Math.floor(selectedConceptIndex / CONCEPTS_PER_PAGE) + 1
      : requestedCurrentPage;
    const pageConceptKeys = new Set(Array.from(projectionConceptKeys).slice((nextCurrentPage - 1) * CONCEPTS_PER_PAGE, nextCurrentPage * CONCEPTS_PER_PAGE));

    return {
      visibleConceptCount: nextVisibleConceptCount,
      totalPages: nextTotalPages,
      currentPage: nextCurrentPage,
      pagedFullCategories: nextVisibleFullCategories
        .map((category) => ({ ...category, conceptKeys: category.conceptKeys.filter((conceptKey) => pageConceptKeys.has(conceptKey)) }))
        .filter((category) => category.conceptKeys.length > 0),
      pagedFactionViews: nextVisibleFactionViews
        .map((faction) => ({
          ...faction,
          categories: faction.categories
            .map((category) => ({ ...category, conceptKeys: category.conceptKeys.filter((conceptKey) => pageConceptKeys.has(conceptKey)) }))
            .filter((category) => category.conceptKeys.length > 0),
        }))
        .filter((faction) => faction.categories.length > 0),
      pagedReputationGroups: nextVisibleReputationGroups
        .map((group) => ({
          ...group,
          reputationScopes: group.reputationScopes
            .map((scope) => ({ ...scope, conceptKeys: (scope.conceptKeys ?? []).filter((conceptKey) => pageConceptKeys.has(conceptKey)) }))
            .filter((scope) => (scope.conceptKeys?.length ?? 0) > 0),
        }))
        .filter((group) => group.reputationScopes.length > 0),
    };
  }, [activeView, catalog, confidence, conceptsByKey, families, missionType, provider, query, repReward, requestedPage, reward, selectedConceptKey, status]);

  const selectConceptWorkspace = useCallback((conceptKey: string, trigger: HTMLButtonElement) => {
    selectedConceptTriggerRef.current = trigger;
    const concept = conceptsByKey.get(conceptKey);
    if (!concept) return;
    const next = new URLSearchParams(searchParams);
    next.delete("selected");
    next.delete("concept");
    next.delete("dossier");
    navigateWithParams(missionConceptPath(concept), next);
  }, [conceptsByKey, navigateWithParams, searchParams]);

  const selectOfferWorkspace = useCallback((offerKey: string, trigger: HTMLButtonElement) => {
    selectedConceptTriggerRef.current = trigger;
    if (!offersByKey.has(offerKey)) return;
    const next = new URLSearchParams(searchParams);
    next.set("offer", offerKey);
    next.delete("variant");
    next.delete("contract");
    next.delete("selected");
    next.delete("concept");
    next.delete("dossier");
    navigateWithParams(MISSION_BROWSER_PATH, next);
  }, [navigateWithParams, offersByKey, searchParams]);

  const closeConceptWorkspace = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("selected");
    next.delete("concept");
    next.delete("dossier");
    next.delete("offer");
    next.delete("variant");
    next.delete("contract");
    navigateWithParams(MISSION_BROWSER_PATH, next);
    window.requestAnimationFrame(() => selectedConceptTriggerRef.current?.focus());
  }, [navigateWithParams, searchParams]);

  useEffect(() => {
    if (!selectedConcept && !selectedOffer && legacyResolution?.kind !== "series") return;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    const focusFrame = window.requestAnimationFrame(() => modalShellRef.current?.focus());

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeConceptWorkspace();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [closeConceptWorkspace, legacyResolution, selectedConcept, selectedOffer]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "concept") {
      next.delete("concept");
      next.delete("selected");
      next.delete("dossier");
      next.delete("offer");
      next.delete("variant");
      next.delete("contract");
    }
    if (key !== "page" && key !== "concept") next.delete("page");
    navigateWithParams(MISSION_BROWSER_PATH, next);
  }

  function selectProvider(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set("provider", value);
      next.set("view", "faction");
    } else {
      next.delete("provider");
    }
    next.delete("concept");
    next.delete("selected");
    next.delete("dossier");
    next.delete("offer");
    next.delete("variant");
    next.delete("contract");
    next.delete("page");
    navigateWithParams(MISSION_BROWSER_PATH, next);
  }

  function setSearch(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("search", value);
    else next.delete("search");
    const matchesFaction = providers.some((item) => item.label.toLowerCase() === value.trim().toLowerCase());
    if (matchesFaction) next.set("view", "faction");
    next.delete("concept");
    next.delete("selected");
    next.delete("dossier");
    next.delete("offer");
    next.delete("variant");
    next.delete("contract");
    next.delete("page");
    navigateWithParams(MISSION_BROWSER_PATH, next);
  }

  function setPage(page: number) {
    const next = new URLSearchParams(searchParams);
    if (page > 1) next.set("page", String(page));
    else next.delete("page");
    next.delete("concept");
    next.delete("selected");
    next.delete("dossier");
    next.delete("offer");
    next.delete("variant");
    next.delete("contract");
    navigateWithParams(MISSION_BROWSER_PATH, next);
  }

  function renderMissionCards(concepts: MissionConceptView[]) {
    return concepts.map((concept) => (
      <MissionConceptCard
        key={concept.conceptKey}
        concept={concept}
        familiesByKey={familiesByKey}
        isSelected={selectedConceptKey === concept.conceptKey}
        onSelect={selectConceptWorkspace}
      />
    ));
  }

  function renderMissionOfferCards(offers: MissionOfferView[]) {
    return offers.map((offer) => (
      <MissionOfferCard
        key={offer.offerKey}
        offer={offer}
        isSelected={selectedOfferKey === offer.offerKey}
        onSelect={selectOfferWorkspace}
      />
    ));
  }

  return (
    <div className="mb-page">
      <div className="mb-shell">
        <header className="mb-page-heading">
          <div>
            <span>Contract Registry</span>
            <h1>Mission Browser</h1>
          </div>
          <div className="mb-page-heading__summary">
            <strong>{activeView === "full" ? "Full Registry" : activeView === "faction" ? "Faction View" : "Reputation View"}</strong>
            <span>{loading ? "Loading missions" : error ? "Registry unavailable" : isOfferCatalog
              ? `${offerProjection.visibleOfferCount} offer${offerProjection.visibleOfferCount === 1 ? "" : "s"}`
              : `${visibleConceptCount} concept${visibleConceptCount === 1 ? "" : "s"}`}</span>
          </div>
        </header>

        <div className="mb-filter-toolbar">
          <div className="mb-filter-shell scintel-filter-shell ops-primary-card">
            <div className="scintel-filter-header crb-row--search mb-filter-header">
              <div className="scintel-filter-search">
                <label className="component-browser-search mb-browser-search">
                  <span className="craft-search-icon" aria-hidden="true">/</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search missions, providers, rewards, internal IDs..."
                    aria-label="Search missions"
                  />
                </label>
              </div>
            </div>
            <div className="scintel-filter-body">
              <div className="crb-row mb-filter-row" aria-label="Mission browser filters">
                <select value={provider} onChange={(event) => selectProvider(event.target.value)} aria-label="Filter by provider"><option value="">All providers</option>{providers.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
                <select value={missionType} onChange={(event) => setParam("type", event.target.value)} aria-label="Filter by mission type"><option value="">All mission types</option>{missionTypes.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
                <select value={reward} onChange={(event) => setParam("reward", event.target.value)} aria-label="Filter by reward">
                  <option value="">All rewards</option>
                  {rewardOptions.map((item) => <option key={item.key} value={item.key}>{item.key === "credits-calculated" ? AUEC_REWARD_NOT_REPORTED : item.label}</option>)}
                </select>
                <select value={repReward} onChange={(event) => setParam("repReward", event.target.value)} aria-label="Filter by reputation reward path"><option value="">All rep reward paths</option>{rewardedRepPaths.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
                <select value={status} onChange={(event) => setParam("status", event.target.value)} aria-label="Filter by status"><option value="">All statuses</option>{statuses.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
                <select value={confidence} onChange={(event) => setParam("confidence", event.target.value)} aria-label="Filter by confidence">
                  <option value="">All confidence</option>
                  {confidenceOptions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                </select>
                {isOfferCatalog && (
                  <select value={verification} onChange={(event) => setParam("verification", event.target.value)} aria-label="Filter by verification">
                    <option value="">All verification states</option>
                    <option value="verified">Verified</option>
                    <option value="unverified">Unverified</option>
                    <option value="unknown">Unknown</option>
                  </select>
                )}
              </div>
              <div className="mb-filter-meta">
                <nav className="mb-view-selector crb-chip-group" aria-label="Mission browser view">
                  {([
                    ["full", "Full"],
                    ["faction", "Faction"],
                    ["reputation", "Reputation"],
                  ] as Array<[BrowserView, string]>).map(([view, label]) => (
                    <button
                      type="button"
                      key={view}
                      className={`craft-frl-chip craft-frl-chip--sm${activeView === view ? " craft-frl-chip--active" : ""}`}
                      aria-pressed={activeView === view}
                      onClick={() => setParam("view", view)}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
                <div className="mb-rep-legend" aria-label="Reputation path color legend">
                  <span className="mb-filter-meta__label">Reputation paths</span>
                  {["Hauling", "Ship Combat", "Salvage", "Standing", "Bounty", "Courier", "Refuel"].map((item) => (
                    <span key={item} className={`mb-rep-badge ${repScopeClass(item)}`}>{item}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading && <div className="mb-state">Loading shaped mission registry...</div>}
        {error && <div className="mb-state is-error">{error}</div>}
        {!loading && !error && catalog && (
          <div className="mb-results-shell">
            <main className="mb-family-list">
            {(isOfferCatalog ? offerProjection.visibleOfferCount : visibleConceptCount) === 0 && (
              <section className="mb-zero-results ops-primary-card" aria-live="polite">
                <strong>No missions match these filters</strong>
                <span>Clear the search or filters to restore the mission registry.</span>
                <button
                  type="button"
                  onClick={() => navigateWithParams(MISSION_BROWSER_PATH, new URLSearchParams())}
                >
                  Clear filters
                </button>
              </section>
            )}

            {isOfferCatalog && offerProjection.pagedOffers.length > 0 && (
              <section className="mb-browse-group mission-category-block ops-primary-card">
                <header className="mb-group-header mission-category-block__header">
                  <div>
                    <span>{activeView === "faction" ? "Faction offers" : activeView === "reputation" ? "Reputation offers" : "Mission offers"}</span>
                    <h2>Player-facing contracts</h2>
                    <small>Each card is a title players can search for and see in game.</small>
                  </div>
                  <strong>{offerProjection.visibleOfferCount} offers / {Array.from(offersByKey.values()).reduce((sum, offer) => sum + offer.variantKeys.length, 0)} exact variants</strong>
                </header>
                <div className="mission-group-grid">
                  {renderMissionOfferCards(offerProjection.pagedOffers)}
                </div>
              </section>
            )}

            {!isOfferCatalog && activeView === "full" && pagedFullCategories.map((category) => {
              const categoryConcepts = category.conceptKeys.map((conceptKey) => conceptsByKey.get(conceptKey)).filter((concept): concept is MissionConceptView => Boolean(concept));
              return (
                <section className="mb-browse-group mission-category-block ops-primary-card" key={category.categoryKey}>
                  <header className="mb-group-header mission-category-block__header">
                    <div>
                      <span>Category</span>
                      <h2>{category.displayName}</h2>
                      <small>Mission offers from all factions</small>
                    </div>
                    <strong>{categoryConcepts.length} concepts / {categoryConcepts.reduce((sum, concept) => sum + concept.variantCount, 0)} playable missions</strong>
                  </header>
                  <div className="mission-group-grid">
                    {renderMissionCards(categoryConcepts)}
                  </div>
                </section>
              );
            })}

            {!isOfferCatalog && activeView === "faction" && pagedFactionViews.map((faction) => {
              const factionConceptKeys = new Set(faction.categories.flatMap((category) => category.conceptKeys));
              return (
                <section className="mb-browse-group mission-faction-block ops-primary-card" key={faction.factionKey}>
                  <header className="mb-group-header mission-faction-block__header">
                    <div>
                      <span>Faction</span>
                      <h2>{faction.factionDisplayName}</h2>
                      <small>{faction.categories.map((category) => category.displayName).slice(0, 5).join(" / ")}{faction.categories.length > 5 ? ` / +${faction.categories.length - 5}` : ""}</small>
                    </div>
                    <strong>{factionConceptKeys.size} concepts / {Array.from(factionConceptKeys).reduce((sum, conceptKey) => sum + (conceptsByKey.get(conceptKey)?.variantCount ?? 0), 0)} playable missions</strong>
                  </header>
                  {faction.categories.map((category) => {
                    const categoryConcepts = category.conceptKeys.map((conceptKey) => conceptsByKey.get(conceptKey)).filter((concept): concept is MissionConceptView => Boolean(concept));
                    return (
                      <section className="mb-scope-group mission-category-lane" key={category.categoryKey}>
                        <header className="mb-archetype-header mission-category-lane__header">
                          <div><h3>{category.displayName}</h3><small>{categoryConcepts.length} concepts / {categoryConcepts.reduce((sum, concept) => sum + concept.variantCount, 0)} playable missions</small></div>
                        </header>
                        <div className="mission-group-grid">
                          {renderMissionCards(categoryConcepts)}
                        </div>
                      </section>
                    );
                  })}
                </section>
              );
            })}

            {!isOfferCatalog && activeView === "reputation" && pagedReputationGroups.map((group) => {
              const groupCount = group.reputationScopes.reduce((sum, scope) => sum + (scope.conceptKeys?.length ?? 0), 0);
              const variantCount = group.reputationScopes.reduce((sum, scope) => sum + (scope.conceptKeys ?? []).reduce((scopeSum, conceptKey) => scopeSum + (conceptsByKey.get(conceptKey)?.variantCount ?? 0), 0), 0);
              const pathNames = group.reputationScopes.map((scope) => shortRepScope(scope.displayName));
              return (
              <section className="mb-browse-group mission-faction-block ops-primary-card" key={group.factionKey}>
                <header className="mb-group-header mission-faction-block__header">
                  <div>
                    <span>Faction</span>
                    <h2>{group.factionDisplayName}</h2>
                    <small>{pathNames.slice(0, 4).join(" / ")}{pathNames.length > 4 ? ` / +${pathNames.length - 4}` : ""}</small>
                  </div>
                  <strong>{groupCount} concepts / {variantCount} playable missions</strong>
                </header>
                {group.reputationScopes.map((scope) => {
                  const scopeConcepts = (scope.conceptKeys ?? []).map((conceptKey) => conceptsByKey.get(conceptKey)).filter((concept): concept is MissionConceptView => Boolean(concept));
                  return (
                  <section className={`mb-scope-group mission-path-lane ${repScopeClass(scope.displayName)}`} key={scope.scopeKey}>
                    <header className={`mb-scope-header mission-path-lane__header ${repScopeClass(scope.displayName)}`}>
                      <div className="mission-path-lane__identity">
                        <span className="mission-path-lane__icon"><ReputationPathIcon scope={scope.displayName} /></span>
                        <div>
                          <h3>{shortRepScope(scope.displayName)}</h3>
                          <p>{group.factionDisplayName} reputation path</p>
                          <small>{scopeConcepts.length} concepts / {scopeConcepts.reduce((sum, concept) => sum + concept.variantCount, 0)} playable missions</small>
                        </div>
                      </div>
                      <div className="mission-path-lane__reward-note">
                        <strong>Rewards {shortRepScope(scope.displayName)} Rep</strong>
                        <span>{repScopeDescription(scope.displayName)}</span>
                        <div className="mb-badges">
                          {scope.confidence !== "resolved" && <Badge tone={scope.confidence === "partial" ? "is-amber" : "is-red"}>{scope.confidence}</Badge>}
                          <Badge tone="is-neutral">{scope.trackType}</Badge>
                        </div>
                      </div>
                    </header>
                    <div className="mission-path-lane__body">
                      <div className="mission-group-grid">
                        {renderMissionCards(scopeConcepts)}
                      </div>
                    </div>
                  </section>
                  );
                })}
              </section>
              );
            })}
            </main>
            {(isOfferCatalog ? offerProjection.visibleOfferCount > OFFERS_PER_PAGE : visibleConceptCount > CONCEPTS_PER_PAGE) && (
              <footer className="mb-pagination mb-results-footer" aria-label={isOfferCatalog ? "Mission offer pages" : "Mission concept pages"}>
                <span>
                  {isOfferCatalog
                    ? `Showing ${(offerProjection.offerCurrentPage - 1) * OFFERS_PER_PAGE + 1}-${Math.min(offerProjection.offerCurrentPage * OFFERS_PER_PAGE, offerProjection.visibleOfferCount)} of ${offerProjection.visibleOfferCount} offers`
                    : `Showing ${(currentPage - 1) * CONCEPTS_PER_PAGE + 1}-${Math.min(currentPage * CONCEPTS_PER_PAGE, visibleConceptCount)} of ${visibleConceptCount} concepts`}
                </span>
                <nav aria-label="Pagination">
                  <button type="button" disabled={(isOfferCatalog ? offerProjection.offerCurrentPage : currentPage) === 1} onClick={() => setPage((isOfferCatalog ? offerProjection.offerCurrentPage : currentPage) - 1)}>Previous</button>
                  <span>Page {isOfferCatalog ? offerProjection.offerCurrentPage : currentPage} of {isOfferCatalog ? offerProjection.offerTotalPages : totalPages}</span>
                  <button type="button" disabled={(isOfferCatalog ? offerProjection.offerCurrentPage === offerProjection.offerTotalPages : currentPage === totalPages)} onClick={() => setPage((isOfferCatalog ? offerProjection.offerCurrentPage : currentPage) + 1)}>Next</button>
                </nav>
              </footer>
            )}
          </div>
        )}
      </div>
      {selectedConcept && createPortal(
        <div
          className="mission-dossier-modal-backdrop mission-workspace-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeConceptWorkspace();
          }}
        >
          <div
            ref={modalShellRef}
            className="mission-dossier-modal-shell mission-workspace-modal-shell ops-primary-card"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedConcept.displayName} mission details`}
            tabIndex={-1}
          >
            <MissionSelectedWorkspace
              key={selectedConcept.conceptKey}
              concept={selectedConcept}
              variants={selectedConceptVariants}
              loading={conceptLoadingKey === selectedConcept.conceptKey && !selectedConceptVariants}
              error={conceptErrors[selectedConcept.conceptKey]}
              isBookmarked={hasMissionConceptBookmark(bookmarkedMissionIds, selectedConcept.conceptKey)}
              bookmarkedMissionIds={bookmarkedMissionIds}
              onToggleBookmark={toggleMissionBookmark}
              onToggleRewardBookmarks={toggleMissionRewardBookmarks}
              onClose={closeConceptWorkspace}
            />
          </div>
        </div>,
        document.body,
      )}
      {selectedOffer && createPortal(
        <div
          className="mission-dossier-modal-backdrop mission-workspace-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeConceptWorkspace();
          }}
        >
          <div
            ref={modalShellRef}
            className="mission-dossier-modal-shell mission-workspace-modal-shell ops-primary-card"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedOffer.displayTitle} mission offer details`}
            tabIndex={-1}
          >
            {selectedOfferConcept ? (
              <MissionSelectedWorkspace
                key={selectedOffer.offerKey}
                concept={selectedOfferConcept}
                offer={selectedOffer}
                variants={selectedOfferVariants}
                initialVariantKey={selectedExactVariantKey}
                loading={offerLoadingKey === selectedOffer.offerKey && !selectedOfferVariants}
                error={offerErrors[selectedOffer.offerKey]}
                isBookmarked={hasMissionOfferBookmark(bookmarkedMissionIds, selectedOffer.offerKey, catalog?.legacyConceptOfferKeys)}
                bookmarkedMissionIds={bookmarkedMissionIds}
                onToggleBookmark={toggleMissionOfferBookmark}
                onToggleRewardBookmarks={toggleMissionRewardBookmarks}
                onSelectVariant={(variantKey) => {
                  const next = new URLSearchParams(searchParams);
                  next.set("offer", selectedOffer.offerKey);
                  next.set("variant", variantKey);
                  next.delete("selected");
                  next.delete("concept");
                  next.delete("contract");
                  next.delete("dossier");
                  navigateWithParams(MISSION_BROWSER_PATH, next, true);
                }}
                onClose={closeConceptWorkspace}
              />
            ) : (
              <section className="mission-selected-workspace ops-primary-card">
                <div className="mission-selected-state is-error">This offer has no readable legacy series metadata. Exact variants were not selected.</div>
                <button type="button" className="mission-dossier-close" aria-label="Close selected mission details" onClick={closeConceptWorkspace}>×</button>
              </section>
            )}
          </div>
        </div>,
        document.body,
      )}
      {legacyResolution?.kind === "series" && !selectedOffer && createPortal(
        <div
          className="mission-dossier-modal-backdrop mission-workspace-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeConceptWorkspace();
          }}
        >
          <div
            ref={modalShellRef}
            className="mission-dossier-modal-shell mission-workspace-modal-shell ops-primary-card"
            role="dialog"
            aria-modal="true"
            aria-label="Choose a mission offer from this legacy series"
            tabIndex={-1}
          >
            <section className="mission-selected-workspace ops-primary-card">
              <header className="mission-dossier-header">
                <div className="mission-dossier-header__identity">
                  <div>
                    <span className="mb-kicker">Legacy mission series</span>
                    <h2>Choose a player-facing mission title</h2>
                    <p>This older link represents multiple player-facing offers. Choose the title you intended.</p>
                  </div>
                </div>
                <button type="button" className="mission-dossier-close" aria-label="Close mission series chooser" onClick={closeConceptWorkspace}>×</button>
              </header>
              <div className="mission-group-grid">
                {renderMissionOfferCards(legacyResolution.offerKeys.map((offerKey) => offersByKey.get(offerKey)).filter((offer): offer is MissionOfferView => Boolean(offer)))}
              </div>
            </section>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
