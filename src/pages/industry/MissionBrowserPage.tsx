import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
  loadMissionConceptVariants,
  loadMissionData,
  type BlueprintRewardGroupView,
  type MissionBrowserCatalog,
  type MissionFamilyView,
  type MissionConceptView,
  type MissionPrerequisiteView,
  type MissionRewardedReputationPathView,
  type MissionVariantView,
} from "@/lib/missionData";
import "./mission-browser.css";

const MAX_VISIBLE_VARIANTS = 8;
const CONCEPTS_PER_PAGE = 12;

type RewardFilter = "blueprints" | "reputation" | "credits-fixed" | "credits-calculated" | "credits-variable" | "credits-formula-unresolved" | "credits-unresolved" | "credits-none" | "items" | "items-unresolved";
type ConfidenceFilter = "unresolved" | "locations" | "rewards" | "crime-bounded" | "unlawful";
type BrowserView = "full" | "faction" | "reputation";

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
  if (text.includes("standing")) return "mission-rep-scope--standing";
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

const MissionCardRowIcon = memo(function MissionCardRowIcon({ type }: { type: "pickup" | "missions" | "blueprints" | "credits" }) {
  const paths: Record<typeof type, ReactNode> = {
    pickup: (
      <>
        <path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    missions: (
      <>
        <circle cx="8" cy="8" r="2.5" />
        <circle cx="16" cy="8" r="2.5" />
        <path d="M4.5 18c.6-2.5 2.4-4 3.5-4s2.9 1.5 3.5 4M12.5 18c.6-2.5 2.4-4 3.5-4s2.9 1.5 3.5 4" />
      </>
    ),
    blueprints: (
      <>
        <path d="M7 4h10l3 3v13H7V4Z" />
        <path d="M17 4v4h3M10 11h7M10 15h7" />
      </>
    ),
    credits: (
      <>
        <circle cx="12" cy="12" r="7" />
        <path d="M14.5 8.8c-.8-.5-1.7-.8-2.8-.8-1.5 0-2.7.7-2.7 1.9 0 2.8 6 1.2 6 4.2 0 1.2-1.2 1.9-2.8 1.9-1.2 0-2.3-.3-3.1-.9M12 6.5v11" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[type]}
    </svg>
  );
});

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

function groupCreditSummary(variants: MissionVariantView[]): string {
  const unresolvedCount = variants.filter((variant) => variant.rewards.creditStatus === "unresolved").length;
  if (unresolvedCount === variants.length && unresolvedCount > 0) return `Credits unresolved across ${unresolvedCount} variants`;
  if (unresolvedCount > 0) return `Credits unresolved for ${unresolvedCount} variant${unresolvedCount === 1 ? "" : "s"}`;
  const fixed = Array.from(new Set(variants.filter((variant) => variant.rewards.creditStatus === "fixed").map((variant) => variant.rewards.credits)));
  if (fixed.length > 1) return "Credits vary by variant";
  if (fixed.length === 1 && variants.every((variant) => variant.rewards.creditStatus === "fixed")) return fixed[0]!;
  if (variants.every((variant) => variant.rewards.creditStatus === "calculated")) return "Calculated payout";
  if (variants.every((variant) => variant.rewards.creditStatus === "variable")) return "Variable payout";
  if (variants.every((variant) => variant.rewards.creditStatus === "formula_unresolved")) return "Credits formula unresolved";
  if (variants.every((variant) => variant.rewards.creditStatus === "provenAbsent")) return "No credit reward extracted";
  return "Credits vary by variant";
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
  return groupCreditSummary(variants).replace(/^Credits /, "").replace(/^No credit reward extracted$/, "none extracted");
}

function unloadedFamilyCreditSummary(family: MissionFamilyView): string {
  return family.creditRewardSummary.replace(/^Credits /, "").replace(/^No credit reward extracted$/, "none extracted");
}

function conceptFamilies(concept: MissionConceptView, familiesByKey: Map<string, MissionFamilyView>): MissionFamilyView[] {
  return concept.familyKeys.map((familyKey) => familiesByKey.get(familyKey)).filter((family): family is MissionFamilyView => Boolean(family));
}

function conceptCreditSummary(concept: MissionConceptView, familiesByKey: Map<string, MissionFamilyView>): string {
  const summaries = Array.from(new Set(conceptFamilies(concept, familiesByKey).map(unloadedFamilyCreditSummary)));
  return summaries.length === 1 ? summaries[0]! : summaries.length ? "varies by tier or variant" : "unresolved";
}

function conceptBlueprintCount(concept: MissionConceptView, familiesByKey: Map<string, MissionFamilyView>): number {
  return new Set(conceptFamilies(concept, familiesByKey).flatMap((family) => family.blueprintRewardGroups.map((group) => group.poolGuid ?? group.poolName))).size;
}

function conceptPickupBadges(concept: MissionConceptView): string[] {
  return Array.from(new Set(concept.pickupCoverage.map((pickup) => pickup.system ?? pickup.localityPool ?? pickup.displayName)));
}

function userFacingConceptBadges(concept: MissionConceptView): string[] {
  return [...concept.archetypes, ...concept.specificityBadges]
    .filter((badge) => !/contract|\+\d+$/i.test(badge))
    .filter((badge, index, values) => values.indexOf(badge) === index);
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
  const pickup = variant.pickupLocation;
  return [
    pickup.system ?? "system-unresolved",
    pickup.localityPool ?? (pickup.status === "exact" ? pickup.displayName : "shared-generated-availability"),
    pickup.status,
  ].join("|");
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
  const selectedGroup = equivalentGroups.find((group) => group[0]?.variantKey === selectedKey) ?? equivalentGroups[0];
  const selectedVariant = selectedGroup?.[0];
  const differenceLabels = playerFacingDifferenceLabels(equivalentGroups);
  const duplicateLabels = equivalentGroups.reduce((counts, group) => {
    const label = variantTabBaseLabel(group);
    counts.set(label, (counts.get(label) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
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
  if (value === "notRequired") return "CrimeStat not required";
  return "CrimeStat unknown";
}

function lawfulLabel(item: Pick<MissionFamilyView, "lawfulClassification" | "lawfulConfidence">): string {
  if (item.lawfulClassification === "unlawful") return "Unlawful context, requirement unconfirmed";
  if (item.lawfulClassification === "lawful") return item.lawfulConfidence === "explicit" ? "Lawful" : "Likely lawful";
  return "Lawful status unknown";
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
  const pickupBadges = conceptPickupBadges(concept);
  const blueprintCount = conceptBlueprintCount(concept, familiesByKey);
  const compactBadges = Array.from(new Set([
    concept.displayCategory.label,
    shortRepScope(concept.reputationScope.displayName),
    ...concept.displaySubcategories,
    ...userFacingConceptBadges(concept),
    concept.groupingConfidence !== "strong" ? `${concept.groupingConfidence} grouping` : undefined,
  ].filter((badge): badge is string => Boolean(badge))));
  const visibleBadges = compactBadges.slice(0, 5);

  return (
    <div className={`mb-family-block ${repScopeClass(concept.reputationScope.displayName)}${isSelected ? " is-selected" : ""}`}>
      <button
        type="button"
        className="mb-family-row mission-group-card"
        aria-expanded={isSelected}
        aria-haspopup="dialog"
        onClick={(event) => onSelect(concept.conceptKey, event.currentTarget)}
      >
        <span className="mission-group-card__rail" aria-hidden="true" />
        <span className="mission-group-card__body">
          <span className="mission-group-card__header">
            <span className="mission-faction-initials" aria-hidden="true">{factionInitials(concept.factionDisplayName)}</span>
            <span className="mb-family-copy mission-group-card__title-block">
              <strong className="mission-group-card__title">{concept.displayName}</strong>
              <small>{concept.factionDisplayName} / {shortRepScope(concept.reputationScope.displayName)}</small>
            </span>
          </span>
          <span className="mission-group-card__primary">
            <span className={`mission-rep-reward-pill ${repScopeClass(primaryRepScope(concept.rewardedReputationPaths, concept.reputationScope.displayName))}`}>{repPathSummary(concept.rewardedReputationPaths)}</span>
            {concept.mixedRewardPaths && <span className="mb-rep-badge mission-rep-scope--mixed">Mixed rep paths</span>}
          </span>
          <span className="mb-badges">
            {visibleBadges.map((badge, index) => <Badge key={badge} tone={index < 2 ? "is-neutral" : "is-muted"}>{badge}</Badge>)}
            {compactBadges.length > visibleBadges.length && <Badge tone="is-muted">{`+${compactBadges.length - visibleBadges.length} more`}</Badge>}
          </span>
          <span className="mission-group-card__meta">
            <span className="mission-card-row mission-card-row--pickup" title={pickupBadges.join(", ")}>
              <span className="mission-card-row__icon"><MissionCardRowIcon type="pickup" /></span>
              <span>Pickup: {pickupBadges.slice(0, 2).join(" / ") || "unresolved"}{pickupBadges.length > 2 ? ` +${pickupBadges.length - 2}` : ""}</span>
            </span>
            <span className="mission-card-row">
              <span className="mission-card-row__icon"><MissionCardRowIcon type="missions" /></span>
              <span>{concept.variantCount} playable mission{concept.variantCount === 1 ? "" : "s"}</span>
            </span>
            {blueprintCount > 0 && <span className="mission-card-row mission-card-row--blueprint has-blueprints">
              <span className="mission-card-row__icon"><MissionCardRowIcon type="blueprints" /></span>
              <span>{blueprintCount} blueprint pool{blueprintCount === 1 ? "" : "s"}</span>
            </span>}
            <span className="mission-card-row">
              <span className="mission-card-row__icon"><MissionCardRowIcon type="credits" /></span>
              <span>Credits: {conceptCreditSummary(concept, familiesByKey)}</span>
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

function BlueprintRewardGroups({ groups, compact = false }: { groups: BlueprintRewardGroupView[]; compact?: boolean }) {
  if (!groups.length) return <p className="mb-empty-note">No blueprint rewards extracted.</p>;
  return (
    <div className={`mb-blueprint-groups${compact ? " is-compact" : ""}`}>
      {groups.map((group) => (
        <section className="mb-blueprint-group" key={group.poolGuid ?? group.poolName}>
          <header>
            <strong>{group.poolName}</strong>
            <span>{group.chanceLabel ?? `${group.rewardCount} possible rewards`}</span>
          </header>
          <div className="mb-blueprint-list">
            {group.rewards.slice(0, compact ? 4 : 12).map((reward) => (
              <div className="mb-blueprint-item" key={reward.blueprintGuid ?? reward.displayName}>
                <span>{reward.displayName}</span>
                <small>{[reward.componentType, reward.size ? `S${reward.size}` : undefined, reward.grade ? `Grade ${reward.grade}` : undefined, reward.chanceLabel].filter(Boolean).join(" / ") || "Blueprint"}</small>
              </div>
            ))}
            {group.rewards.length > (compact ? 4 : 12) && <div className="mb-blueprint-more">+{group.rewards.length - (compact ? 4 : 12)} more</div>}
          </div>
        </section>
      ))}
    </div>
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
          <p>{variant.briefing}</p>
        </section>
      )}
      <div className="mb-drawer-grid">
        <section className="mb-drawer-rewards">
          <h3>Rewards</h3>
          {variant.rewards.blueprintRewardGroups.length > 0 && <BlueprintRewardGroups groups={variant.rewards.blueprintRewardGroups} compact />}
          <div>
            <h4 className="mb-inline-heading">Rewarded Reputation</h4>
            <RepPathBadgeList paths={variant.rewardedReputationPaths} includeFaction max={5} />
          </div>
          <Badge tone={["unresolved", "calculated", "formula_unresolved", "variable"].includes(variant.rewards.creditStatus) ? "is-amber" : "is-muted"}>{variant.rewards.credits}</Badge>
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
        <section className="mb-drawer-pickup">
          <h3>Pickup / Availability</h3>
          <div className="mb-pickup-readout">
            <strong>{pickupLabel(variant.pickupLocation)}</strong>
            {variant.pickupLocation.status === "exact" && variant.pickupLocation.parentLocation && <small>{variant.pickupLocation.parentLocation}</small>}
          </div>
          {localityChips.length > 0 && <BadgeList values={localityChips} fallback="" max={6} />}
        </section>
      </div>
      <TechnicalDetails variant={variant} />
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
                  <small>{variant.rewards.credits}</small>
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
  variants,
  onClose,
}: {
  concept: MissionConceptView;
  variants: MissionVariantView[];
  onClose: () => void;
}) {
  const tiers = useMemo(() => Array.from(variants.reduce((groups, variant) => {
    const key = variant.tierKey ?? "unclassified";
    groups.set(key, [...(groups.get(key) ?? []), variant]);
    return groups;
  }, new Map<string, MissionVariantView[]>()).entries())
    .sort((a, b) => tierDisplayOrder(a[0]) - tierDisplayOrder(b[0]) || a[0].localeCompare(b[0])), [variants]);
  const [selectedTierKey, setSelectedTierKey] = useState(() => tiers[0]?.[0] ?? "");
  const selectedTier = tiers.find(([tierKey]) => tierKey === selectedTierKey) ?? tiers[0];
  const availabilityGroups = useMemo(() => Array.from((selectedTier?.[1] ?? []).reduce((groups, variant) => {
    const key = expansionGroupKey(variant);
    groups.set(key, [...(groups.get(key) ?? []), variant]);
    return groups;
  }, new Map<string, MissionVariantView[]>()).entries()), [selectedTier]);
  const [selectedAvailabilityKey, setSelectedAvailabilityKey] = useState(() => availabilityGroups[0]?.[0] ?? "");
  const selectedAvailability = availabilityGroups.find(([groupKey]) => groupKey === selectedAvailabilityKey) ?? availabilityGroups[0];
  const selectedVariants = selectedAvailability?.[1] ?? [];
  const representative = selectedVariants[0];
  const blueprintGroups = Array.from(new Map(selectedVariants.flatMap((variant) => variant.rewards.blueprintRewardGroups).map((group) => [group.poolGuid ?? group.poolName, group])).values());
  const poolVariesWithoutRegion = blueprintGroups.length > 1 && !selectedVariants.some(explicitVariantRegion);

  const availabilityLabel = (groupVariants: MissionVariantView[]): string => {
    const variant = groupVariants[0]!;
    const location = variant.pickupLocation;
    return [
      location.system ?? location.displayName,
      location.localityPool,
      explicitVariantRegion(variant),
    ].filter(Boolean).join(" / ") || "Availability unresolved";
  };

  return (
    <section className={`mb-detail mission-group-expansion mission-concept-dossier ${repScopeClass(concept.reputationScope.displayName)}`} aria-label={`${concept.displayName} concept details`}>
      <header className="mission-dossier-header">
        <div className="mission-dossier-header__identity">
          <span className="mission-faction-initials" aria-hidden="true">{factionInitials(concept.factionDisplayName)}</span>
          <div>
            <h2>{concept.displayName}</h2>
            <p>{concept.factionDisplayName} / {shortRepScope(concept.reputationScope.displayName)}</p>
            <div className="mb-badges">
              <Badge tone="is-neutral">{concept.displayCategory.label}</Badge>
              {concept.displaySubcategories.slice(0, 3).map((label) => <Badge key={label} tone="is-muted">{label}</Badge>)}
            </div>
          </div>
        </div>
        <div className="mission-dossier-header__actions">
          <span className={`mission-rep-reward-pill ${repScopeClass(primaryRepScope(concept.rewardedReputationPaths, concept.reputationScope.displayName))}`}>{repPathSummary(concept.rewardedReputationPaths)}</span>
          <button type="button" aria-label="Close mission dossier" autoFocus onClick={onClose}>Close</button>
        </div>
      </header>
      {tiers.length > 0 && (
        <div className="mission-dossier-selector">
          <span>Risk Tier</span>
          <div className="mission-dossier-tabs" role="tablist" aria-label="Mission risk or tier">
            {tiers.map(([tierKey, tierVariants]) => (
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
      {availabilityGroups.length > 0 && (
        <div className="mission-dossier-selector">
          <span>Location Group</span>
          <div className="mission-dossier-chips" role="tablist" aria-label="Mission pickup or location group">
            {availabilityGroups.map(([groupKey, groupVariants]) => (
              <button
                type="button"
                role="tab"
                aria-selected={selectedAvailability?.[0] === groupKey}
                className={selectedAvailability?.[0] === groupKey ? "is-active" : ""}
                key={groupKey}
                onClick={() => setSelectedAvailabilityKey(groupKey)}
              >
                {availabilityLabel(groupVariants)}
              </button>
            ))}
          </div>
        </div>
      )}
      {representative && (
        <section className="mission-dossier-panel">
          {poolVariesWithoutRegion && <p className="mb-empty-note">Blueprint pool varies by generated locality; exact region mapping unresolved.</p>}
          <VariantTabs variants={selectedVariants} />
        </section>
      )}
    </section>
  );
}

void FamilyDetail;

export default function MissionBrowserPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState<MissionBrowserCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conceptVariantsByKey, setConceptVariantsByKey] = useState<Record<string, MissionVariantView[]>>({});
  const [conceptLoadingKey, setConceptLoadingKey] = useState("");
  const [conceptErrors, setConceptErrors] = useState<Record<string, string>>({});

  const families = useMemo(() => catalog?.families ?? [], [catalog]);
  const familiesByKey = useMemo(() => new Map(families.map((family) => [family.familyKey, family])), [families]);
  const conceptsByKey = useMemo(() => new Map(Object.entries(catalog?.conceptsByKey ?? {})), [catalog]);
  const query = searchParams.get("search") ?? "";
  const provider = searchParams.get("provider") ?? "";
  const missionType = searchParams.get("type") ?? "";
  const reward = searchParams.get("reward") ?? "";
  const repReward = searchParams.get("repReward") ?? "";
  const status = searchParams.get("status") ?? "";
  const confidence = searchParams.get("confidence") ?? "";
  const requestedView = searchParams.get("view");
  const exactSearchedFaction = (catalog?.filtersMeta?.factions ?? []).find((item) => item.label.toLowerCase() === query.trim().toLowerCase())?.label;
  const activeView: BrowserView = requestedView === "faction" || requestedView === "reputation" || requestedView === "full"
    ? requestedView
    : provider || exactSearchedFaction ? "faction" : "full";
  const selectedConceptKey = searchParams.get("concept") ?? "";
  const selectedConcept = conceptsByKey.get(selectedConceptKey);
  const selectedConceptVariants = conceptVariantsByKey[selectedConceptKey];
  const selectedConceptTriggerRef = useRef<HTMLButtonElement | null>(null);
  const modalShellRef = useRef<HTMLDivElement | null>(null);
  const requestedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const closeConceptDossier = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("concept");
    setSearchParams(next);
    selectedConceptTriggerRef.current?.focus();
  }, [searchParams, setSearchParams]);
  const missionFilters = useMemo(() => ({
    search: query,
    provider,
    type: missionType,
    reward,
    repReward,
    status,
    confidence,
  }), [confidence, missionType, provider, query, repReward, reward, status]);

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
    const concept = conceptsByKey.get(selectedConceptKey);
    if (!concept || conceptVariantsByKey[selectedConceptKey]) return;
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
  }, [conceptVariantsByKey, conceptsByKey, selectedConceptKey]);

  useEffect(() => {
    if (!selectedConceptKey) return;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    const focusFrame = window.requestAnimationFrame(() => modalShellRef.current?.focus());

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeConceptDossier();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [closeConceptDossier, selectedConceptKey]);

  const providers = useMemo(
    () => catalog?.filtersMeta?.factions ?? Array.from(new Set(families.map((family) => family.provider))).sort().map((value) => ({ key: value, label: value, count: 0 })),
    [catalog, families],
  );
  const missionTypes = useMemo(
    () => catalog?.filtersMeta?.missionTypes ?? Array.from(new Set(families.map((family) => family.missionType))).sort().map((value) => ({ key: value, label: value, count: 0 })),
    [catalog, families],
  );
  const rewardedRepPaths = useMemo(
    () => catalog?.filtersMeta?.reputationScopes ?? Array.from(new Set(families.flatMap((family) => family.rewardedReputationPaths.map((path) => path.scopeDisplayName)))).sort().map((value) => ({ key: value, label: value, count: 0 })),
    [catalog, families],
  );
  const rewardOptions = catalog?.filtersMeta?.rewardTypes ?? [
    { key: "blueprints", label: "Blueprint rewards", count: 0 },
    { key: "reputation", label: "Reputation rewards", count: 0 },
    { key: "credits-fixed", label: "Credits fixed", count: 0 },
    { key: "credits-calculated", label: "Calculated payout", count: 0 },
    { key: "credits-variable", label: "Variable payout", count: 0 },
    { key: "credits-formula-unresolved", label: "Credits formula unresolved", count: 0 },
    { key: "credits-unresolved", label: "Credits unresolved", count: 0 },
    { key: "credits-none", label: "No credit reward extracted", count: 0 },
    { key: "items", label: "Item reward", count: 0 },
    { key: "items-unresolved", label: "Item reward unresolved", count: 0 },
  ];
  const statuses = catalog?.filtersMeta?.releaseStates ?? ["Release flag not set", "Not for release", "Work in progress"].map((value) => ({ key: value, label: value, count: 0 }));
  const confidenceOptions = catalog?.filtersMeta?.confidenceStates ?? [
    { key: "unresolved", label: "Any unresolved", count: 0 },
    { key: "locations", label: "Locations unresolved", count: 0 },
    { key: "rewards", label: "Rewards unresolved", count: 0 },
    { key: "crime-bounded", label: "CrimeStat limited", count: 0 },
    { key: "unlawful", label: "Possible unlawful", count: 0 },
  ];

  const {
    visibleFullCategories,
    visibleFactionViews,
    visibleReputationGroups,
    visibleConceptCount,
    groupedVariantCount,
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
    const nextCurrentPage = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), nextTotalPages) : 1;
    const pageConceptKeys = new Set(Array.from(projectionConceptKeys).slice((nextCurrentPage - 1) * CONCEPTS_PER_PAGE, nextCurrentPage * CONCEPTS_PER_PAGE));

    return {
      visibleFullCategories: nextVisibleFullCategories,
      visibleFactionViews: nextVisibleFactionViews,
      visibleReputationGroups: nextVisibleReputationGroups,
      visibleConceptCount: nextVisibleConceptCount,
      groupedVariantCount: Array.from(projectionConceptKeys).reduce((sum, conceptKey) => sum + (conceptsByKey.get(conceptKey)?.variantCount ?? 0), 0),
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
  }, [activeView, catalog, confidence, conceptsByKey, families, missionType, provider, query, repReward, requestedPage, reward, status]);

  const openConceptDossier = useCallback((conceptKey: string, trigger: HTMLButtonElement) => {
    selectedConceptTriggerRef.current = trigger;
    const next = new URLSearchParams(searchParams);
    next.set("concept", conceptKey);
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "concept") {
      next.delete("concept");
    }
    if (key !== "page" && key !== "concept") next.delete("page");
    setSearchParams(next);
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
    next.delete("page");
    setSearchParams(next);
  }

  function setSearch(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("search", value);
    else next.delete("search");
    const matchesFaction = providers.some((item) => item.label.toLowerCase() === value.trim().toLowerCase());
    if (matchesFaction) next.set("view", "faction");
    next.delete("concept");
    next.delete("page");
    setSearchParams(next);
  }

  function setPage(page: number) {
    const next = new URLSearchParams(searchParams);
    if (page > 1) next.set("page", String(page));
    else next.delete("page");
    next.delete("concept");
    setSearchParams(next);
  }

  return (
    <div className="mb-page">
      <div className="mb-shell">
        <header className="mb-header">
          <div>
            <span className="mb-kicker">Industry Intelligence</span>
            <h1>Mission Browser</h1>
            <p>Shaped mission registry from Foundry contract data. Raw identifiers stay in technical details.</p>
          </div>
          <div className="mb-summary">
            <strong>{catalog?.summary.variantCount.toLocaleString() ?? "..."}</strong><span>variants</span>
            <strong>{catalog?.summary.factionGroupCount.toLocaleString() ?? "..."}</strong><span>factions</span>
            <strong>{catalog?.summary.reputationScopeGroupCount.toLocaleString() ?? "..."}</strong><span>scopes</span>
            <strong>{catalog?.summary.archetypeGroupCount.toLocaleString() ?? "..."}</strong><span>archetypes</span>
          </div>
        </header>

        <section className="mb-controls" aria-label="Mission browser filters">
          <input type="search" value={query} onChange={(event) => setSearch(event.target.value)} placeholder="Search missions, providers, rewards, internal IDs..." />
          <select value={provider} onChange={(event) => selectProvider(event.target.value)}><option value="">All providers</option>{providers.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
          <select value={missionType} onChange={(event) => setParam("type", event.target.value)}><option value="">All mission types</option>{missionTypes.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
          <select value={reward} onChange={(event) => setParam("reward", event.target.value)}>
            <option value="">All rewards</option>
            {rewardOptions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
          <select value={repReward} onChange={(event) => setParam("repReward", event.target.value)}><option value="">All rep reward paths</option>{rewardedRepPaths.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
          <select value={status} onChange={(event) => setParam("status", event.target.value)}><option value="">All statuses</option>{statuses.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
          <select value={confidence} onChange={(event) => setParam("confidence", event.target.value)}>
            <option value="">All confidence</option>
            {confidenceOptions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </section>
        <nav className="mb-view-selector" aria-label="Mission browser view">
          {([
            ["full", "Full"],
            ["faction", "Faction"],
            ["reputation", "Reputation"],
          ] as Array<[BrowserView, string]>).map(([view, label]) => (
            <button
              type="button"
              key={view}
              className={activeView === view ? "is-active" : ""}
              aria-pressed={activeView === view}
              onClick={() => setParam("view", view)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="mb-rep-legend" aria-label="Reputation path color legend">
          {["Hauling", "Ship Combat", "Salvage", "Standing", "Bounty", "Courier", "Refuel"].map((item) => (
            <span key={item} className={`mb-rep-badge ${repScopeClass(item)}`}>{item}</span>
          ))}
        </div>

        {loading && <div className="mb-state">Loading shaped mission registry...</div>}
        {error && <div className="mb-state is-error">{error}</div>}
        {!loading && !error && catalog && (
          <main className="mb-family-list">
            <div className="mb-result-count">
              <span>{activeView === "full" ? `${visibleFullCategories.length} categories` : activeView === "faction" ? `${visibleFactionViews.length} factions` : `${visibleReputationGroups.length} factions`} / {visibleConceptCount} concepts / {groupedVariantCount} variants</span>
              <span>{catalog.summary.reputationScopeResolvedCount} resolved scopes / {catalog.summary.reputationScopePartialCount} partial / {catalog.summary.reputationScopeUnresolvedCount} unresolved</span>
            </div>

            {activeView === "full" && pagedFullCategories.map((category) => {
              const categoryConcepts = category.conceptKeys.map((conceptKey) => conceptsByKey.get(conceptKey)).filter((concept): concept is MissionConceptView => Boolean(concept));
              return (
                <section className="mb-browse-group mission-category-block" key={category.categoryKey}>
                  <header className="mb-group-header mission-category-block__header">
                    <div>
                      <span>Category</span>
                      <h2>{category.displayName}</h2>
                      <small>Mission offers from all factions</small>
                    </div>
                    <strong>{categoryConcepts.length} concepts / {categoryConcepts.reduce((sum, concept) => sum + concept.variantCount, 0)} playable missions</strong>
                  </header>
                  <div className="mission-group-grid">
                    {categoryConcepts.map((concept) => (
                      <MissionConceptCard key={concept.conceptKey} concept={concept} familiesByKey={familiesByKey} isSelected={selectedConceptKey === concept.conceptKey} onSelect={openConceptDossier} />
                    ))}
                  </div>
                </section>
              );
            })}

            {activeView === "faction" && pagedFactionViews.map((faction) => {
              const factionConceptKeys = new Set(faction.categories.flatMap((category) => category.conceptKeys));
              return (
                <section className="mb-browse-group mission-faction-block" key={faction.factionKey}>
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
                          {categoryConcepts.map((concept) => (
                            <MissionConceptCard key={concept.conceptKey} concept={concept} familiesByKey={familiesByKey} isSelected={selectedConceptKey === concept.conceptKey} onSelect={openConceptDossier} />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </section>
              );
            })}

            {activeView === "reputation" && pagedReputationGroups.map((group) => {
              const groupCount = group.reputationScopes.reduce((sum, scope) => sum + (scope.conceptKeys?.length ?? 0), 0);
              const variantCount = group.reputationScopes.reduce((sum, scope) => sum + (scope.conceptKeys ?? []).reduce((scopeSum, conceptKey) => scopeSum + (conceptsByKey.get(conceptKey)?.variantCount ?? 0), 0), 0);
              const pathNames = group.reputationScopes.map((scope) => shortRepScope(scope.displayName));
              return (
              <section className="mb-browse-group mission-faction-block" key={group.factionKey}>
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
                        {scopeConcepts.map((concept) => (
                          <MissionConceptCard key={concept.conceptKey} concept={concept} familiesByKey={familiesByKey} isSelected={selectedConceptKey === concept.conceptKey} onSelect={openConceptDossier} />
                        ))}
                      </div>
                    </div>
                  </section>
                  );
                })}
              </section>
              );
            })}
            {visibleConceptCount > CONCEPTS_PER_PAGE && (
              <div className="mb-pagination" aria-label="Mission concept pages">
                <span>
                  Showing {(currentPage - 1) * CONCEPTS_PER_PAGE + 1}-{Math.min(currentPage * CONCEPTS_PER_PAGE, visibleConceptCount)} of {visibleConceptCount} concepts
                </span>
                <nav aria-label="Pagination">
                  <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next</button>
                </nav>
              </div>
            )}
          </main>
        )}
      </div>
      {selectedConcept && createPortal(
        <div
          className="mission-dossier-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeConceptDossier();
          }}
        >
          <div
            ref={modalShellRef}
            className="mission-dossier-modal-shell"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedConcept.displayName} mission dossier`}
            tabIndex={-1}
          >
            {conceptLoadingKey === selectedConcept.conceptKey && !selectedConceptVariants && <div className="mb-state">Loading referenced family variants...</div>}
            {conceptErrors[selectedConcept.conceptKey] && <div className="mb-state is-error">{conceptErrors[selectedConcept.conceptKey]}</div>}
            {selectedConceptVariants && (
              <ConceptDetail
                key={selectedConcept.conceptKey}
                concept={selectedConcept}
                variants={selectedConceptVariants}
                onClose={closeConceptDossier}
              />
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
