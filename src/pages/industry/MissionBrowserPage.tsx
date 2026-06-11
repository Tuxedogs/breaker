import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  loadMissionFamilyVariants,
  loadMissionData,
  type BlueprintRewardGroupView,
  type MissionBrowserCatalog,
  type MissionFamilyView,
  type MissionPrerequisiteView,
  type MissionRewardedReputationPathView,
  type MissionVariantView,
} from "@/lib/missionData";
import "./mission-browser.css";

const MAX_VISIBLE_VARIANTS = 8;

type RewardFilter = "blueprints" | "reputation" | "credits-fixed" | "credits-calculated" | "credits-variable" | "credits-formula-unresolved" | "credits-unresolved" | "credits-none" | "items" | "items-unresolved";
type ConfidenceFilter = "unresolved" | "locations" | "rewards" | "crime-bounded" | "unlawful";

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

function MissionCardRowIcon({ type }: { type: "pickup" | "missions" | "blueprints" | "credits" }) {
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

function rewardsDifferentFromScope(family: MissionFamilyView): boolean {
  const rewardScopes = new Set(family.rewardedReputationPaths.filter((path) => path.confidence !== "unresolved").map((path) => path.scopeKey));
  return rewardScopes.size > 0 && !rewardScopes.has(family.reputationScope.scopeKey);
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

function unloadedFamilyPickupSummary(family: MissionFamilyView): string {
  return stripSummaryPrefix(family.pickupSummary, "Pickup:");
}

function cardBlueprintSummary(family: MissionFamilyView): string {
  if (!family.blueprintRewardGroups.length) return "No blueprint rewards";
  return "Blueprint rewards";
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

function statusTone(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes("not for release")) return "is-red";
  if (normalized.includes("work") || normalized.includes("unresolved")) return "is-amber";
  if (normalized.includes("release flag not set")) return "is-green";
  return "is-neutral";
}

function pickupLabel(pickup: MissionVariantView["pickupLocation"]): string {
  if (pickup.status === "generated_from_pool") return `Generated from ${pickup.displayName} locality pool`;
  return pickup.displayName;
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

function legalBadge(family: MissionFamilyView): { label: string; tone: string } {
  if (family.crimeStatRequirement === "required") return { label: "CrimeStat required", tone: "is-red" };
  if (family.lawfulClassification === "unlawful") return { label: "Possible unlawful", tone: "is-amber" };
  if (family.lawfulClassification === "lawful") return { label: "Likely lawful", tone: "is-green" };
  return { label: "Legal unknown", tone: "is-muted" };
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
      <summary>Technical details</summary>
      <dl>
        <div><dt>Contract ID</dt><dd title={variant.technical.contractId}>{variant.technical.contractId}</dd></div>
        <div><dt>Internal Name</dt><dd>{variant.internalName ?? "Unavailable"}</dd></div>
        <div><dt>Generator</dt><dd>{variant.technical.generatorName ?? "Unavailable"}</dd></div>
        <div><dt>Generator Path</dt><dd>{variant.technical.generatorPath ?? "Unavailable"}</dd></div>
        <div><dt>Title Token</dt><dd>{variant.technical.titleRaw ?? variant.rawName ?? "Unavailable"}</dd></div>
        <div><dt>Pickup Source</dt><dd>{variant.pickupLocation.sourceRole} / {variant.pickupLocation.confidence}</dd></div>
        <div><dt>Rep Scope</dt><dd>{variant.reputationScope.displayName} / {variant.reputationScope.confidence}</dd></div>
        <div><dt>Archetype</dt><dd>{variant.missionArchetype}</dd></div>
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

function PrerequisitePanel({ prerequisites }: { prerequisites: MissionPrerequisiteView[] }) {
  if (!prerequisites.length) return <p className="mb-empty-note">No extracted prerequisites.</p>;
  const grouped = new Map<MissionPrerequisiteView["type"], MissionPrerequisiteView[]>();
  for (const prerequisite of prerequisites) {
    grouped.set(prerequisite.type, [...(grouped.get(prerequisite.type) ?? []), prerequisite]);
  }
  return (
    <div className="mb-requirement-grid">
      {Array.from(grouped.entries()).map(([type, items]) => (
        <section key={type}>
          <h4>{type === "crimeStat" ? "CrimeStat" : type}</h4>
          <BadgeList
            values={items.map((item) => item.label)}
            fallback="Unresolved prerequisite"
            tone={items.some((item) => item.confidence === "unresolved") ? "is-amber" : "is-neutral"}
            max={6}
          />
        </section>
      ))}
    </div>
  );
}

function VariantDrawer({ variant }: { variant: MissionVariantView }) {
  return (
    <div className="mb-variant-drawer">
      {variant.briefing && (
        <section className="mb-briefing is-variant">
          <h3>Mission Briefing</h3>
          <p>{variant.briefing}</p>
        </section>
      )}
      <div className="mb-drawer-grid">
        <section>
          <h3>Rewards</h3>
          {variant.rewards.blueprintRewardGroups.length > 0 && <BlueprintRewardGroups groups={variant.rewards.blueprintRewardGroups} compact />}
          <div>
            <h4 className="mb-inline-heading">Rewarded Reputation</h4>
            <RepPathBadgeList paths={variant.rewardedReputationPaths} includeFaction max={5} />
          </div>
          <Badge tone={["unresolved", "calculated", "formula_unresolved", "variable"].includes(variant.rewards.creditStatus) ? "is-amber" : "is-muted"}>{variant.rewards.credits}</Badge>
        </section>
        <section>
          <h3>Requirements</h3>
          <PrerequisitePanel prerequisites={variant.prerequisites} />
        </section>
        <section>
          <h3>Pickup / Availability</h3>
          <div className="mb-pickup-readout">
            <strong>{pickupLabel(variant.pickupLocation)}</strong>
            <small>{pickupDetail(variant.pickupLocation)}</small>
          </div>
        </section>
        <section>
          <h3>Secondary Locations</h3>
          <BadgeList values={variant.locations.filter((item) => item !== variant.pickupLocation.displayName)} fallback={variant.unresolvedLocationTokens.length ? "Secondary location unresolved" : "No secondary location requirement extracted"} tone={variant.unresolvedLocationTokens.length ? "is-amber" : "is-neutral"} />
        </section>
        <section>
          <h3>Status</h3>
          <div className="mb-badges">
            <Badge tone={variant.crimeStatRequirement === "required" ? "is-red" : variant.crimeStatRequirement === "bounded" ? "is-amber" : "is-muted"}>{crimeStatLabel(variant.crimeStatRequirement)}</Badge>
            <Badge tone={variant.lawfulClassification === "unlawful" ? "is-amber" : "is-neutral"}>{lawfulLabel(variant)}</Badge>
            {variant.releaseFlags.map((flag) => <Badge key={flag} tone={statusTone(flag)}>{flag}</Badge>)}
          </div>
        </section>
        <section>
          <h3>Operational Details</h3>
          <BadgeList
            values={[
              `Required Standing: ${variant.standingRequirement}`,
              `Reputation Scope: ${variant.reputationScope.displayName}`,
              `Rewarded Reputation: ${variant.rewardedReputationPaths.map((path) => repPathLabel(path, true)).join(", ") || "Unresolved"}`,
              `Archetype: ${variant.missionArchetype}`,
              `Behavior: ${variant.releaseFlags.join(", ")}`,
            ]}
            fallback="No operational details extracted"
            max={8}
          />
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

export default function MissionBrowserPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState<MissionBrowserCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openVariant, setOpenVariant] = useState("");
  const [familyVariantsByKey, setFamilyVariantsByKey] = useState<Record<string, MissionVariantView[]>>({});
  const [familyVariantLoadingKey, setFamilyVariantLoadingKey] = useState("");
  const [familyVariantErrors, setFamilyVariantErrors] = useState<Record<string, string>>({});

  const families = useMemo(() => catalog?.families ?? [], [catalog]);
  const familiesByKey = useMemo(() => new Map(families.map((family) => [family.familyKey, family])), [families]);
  const query = searchParams.get("search") ?? "";
  const provider = searchParams.get("provider") ?? "";
  const missionType = searchParams.get("type") ?? "";
  const reward = searchParams.get("reward") ?? "";
  const repReward = searchParams.get("repReward") ?? "";
  const status = searchParams.get("status") ?? "";
  const confidence = searchParams.get("confidence") ?? "";
  const selectedFamilyKey = searchParams.get("family") ?? "";
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
    setLoading(true);
    setError(null);
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
    if (!selectedFamilyKey || familyVariantsByKey[selectedFamilyKey]) return;
    let cancelled = false;
    setFamilyVariantLoadingKey(selectedFamilyKey);
    setFamilyVariantErrors((current) => {
      const next = { ...current };
      delete next[selectedFamilyKey];
      return next;
    });
    loadMissionFamilyVariants(selectedFamilyKey)
      .then((variants) => {
        if (cancelled) return;
        setFamilyVariantsByKey((current) => ({ ...current, [selectedFamilyKey]: variants }));
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setFamilyVariantErrors((current) => ({
          ...current,
          [selectedFamilyKey]: reason instanceof Error ? reason.message : "Mission family variants unavailable",
        }));
      })
      .finally(() => {
        if (!cancelled) setFamilyVariantLoadingKey((current) => current === selectedFamilyKey ? "" : current);
      });
    return () => {
      cancelled = true;
    };
  }, [familyVariantsByKey, selectedFamilyKey]);

  useEffect(() => {
    const initialVariants = catalog?.variants ?? [];
    if (!initialVariants.length) return;
    setFamilyVariantsByKey((current) => {
      const next = { ...current };
      for (const variant of initialVariants) {
        if (next[variant.familyKey]) continue;
        next[variant.familyKey] = initialVariants.filter((item) => item.familyKey === variant.familyKey);
      }
      return next;
    });
  }, [catalog]);

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

  const visibleFamilies = families.filter((family) => {
    if (query.trim() && !family.searchText.includes(query.trim().toLowerCase())) return false;
    if (provider && family.provider !== provider) return false;
    if (missionType && family.missionType !== missionType) return false;
    if (repReward && !family.rewardedReputationPaths.some((path) => path.scopeDisplayName === repReward)) return false;
    if (status && !family.releaseFlags.includes(status)) return false;
    if (!rewardMatches(family, reward)) return false;
    if (!confidenceMatches(family, confidence)) return false;
    return true;
  });
  const visibleFamilyKeys = new Set(visibleFamilies.map((family) => family.familyKey));
  const visibleGroups = (catalog?.missionBrowseGroups ?? [])
    .map((group) => ({
      ...group,
      reputationScopes: group.reputationScopes
        .map((scope) => ({
          ...scope,
          missionArchetypes: scope.missionArchetypes
            .map((archetype) => ({
              ...archetype,
              familyKeys: archetype.familyKeys.filter((familyKey) => visibleFamilyKeys.has(familyKey)),
            }))
            .filter((archetype) => archetype.familyKeys.length > 0),
        }))
        .filter((scope) => scope.missionArchetypes.length > 0),
    }))
    .filter((group) => group.reputationScopes.length > 0);

  const groupedVariantCount = visibleGroups.reduce((sum, group) => sum + group.reputationScopes.reduce((scopeSum, scope) => scopeSum + scope.missionArchetypes.reduce((archSum, archetype) => archSum + archetype.familyKeys.reduce((familySum, familyKey) => familySum + (familiesByKey.get(familyKey)?.variantCount ?? 0), 0), 0), 0), 0);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "family") {
      next.delete("family");
      setOpenVariant("");
    }
    if (key !== "page" && key !== "family") next.delete("page");
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
          <input type="search" value={query} onChange={(event) => setParam("search", event.target.value)} placeholder="Search missions, providers, rewards, internal IDs..." />
          <select value={provider} onChange={(event) => setParam("provider", event.target.value)}><option value="">All providers</option>{providers.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
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
              <span>{visibleGroups.length} factions / {visibleFamilies.length} mission groups / {groupedVariantCount} variants</span>
              <span>{catalog.summary.reputationScopeResolvedCount} resolved scopes / {catalog.summary.reputationScopePartialCount} partial / {catalog.summary.reputationScopeUnresolvedCount} unresolved</span>
            </div>

            {visibleGroups.map((group) => {
              const groupCount = group.reputationScopes.reduce((sum, scope) => sum + scope.missionArchetypes.reduce((archSum, archetype) => archSum + archetype.familyKeys.length, 0), 0);
              const variantCount = group.reputationScopes.reduce((sum, scope) => sum + scope.missionArchetypes.reduce((archSum, archetype) => archSum + archetype.variantCount, 0), 0);
              const pathNames = group.reputationScopes.map((scope) => shortRepScope(scope.displayName));
              return (
              <section className="mb-browse-group mission-faction-block" key={group.factionKey}>
                <header className="mb-group-header mission-faction-block__header">
                  <div>
                    <span>Faction</span>
                    <h2>{group.factionDisplayName}</h2>
                    <small>{pathNames.slice(0, 4).join(" / ")}{pathNames.length > 4 ? ` / +${pathNames.length - 4}` : ""}</small>
                  </div>
                  <strong>{groupCount} groups / {variantCount} playable missions</strong>
                </header>
                {group.reputationScopes.map((scope) => (
                  <section className={`mb-scope-group mission-path-lane ${repScopeClass(scope.displayName)}`} key={scope.scopeKey}>
                    <header className={`mb-scope-header mission-path-lane__header ${repScopeClass(scope.displayName)}`}>
                      <div className="mission-path-lane__identity">
                        <span className="mission-path-lane__icon"><ReputationPathIcon scope={scope.displayName} /></span>
                        <div>
                          <h3>{shortRepScope(scope.displayName)}</h3>
                          <p>{group.factionDisplayName} reputation path</p>
                          <small>{scope.missionArchetypes.reduce((sum, archetype) => sum + archetype.familyKeys.length, 0)} groups / {scope.missionArchetypes.reduce((sum, archetype) => sum + archetype.variantCount, 0)} playable missions</small>
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
                    {scope.missionArchetypes.map((archetype) => (
                      <section className="mb-archetype-group" key={`${scope.scopeKey}-${archetype.archetypeKey}`}>
                        <div className="mb-archetype-header mission-archetype-band">
                          <strong>{archetype.displayName}</strong>
                          <span>{archetype.familyKeys.length} groups / {archetype.familyKeys.reduce((sum, familyKey) => sum + (familiesByKey.get(familyKey)?.variantCount ?? 0), 0)} variants</span>
                          {archetype.unresolvedCount > 0 && <small>{archetype.unresolvedCount} with unresolved fields</small>}
                        </div>
                        <div className="mission-group-grid">
                        {archetype.familyKeys.map((familyKey) => {
                          const family = familiesByKey.get(familyKey);
                          if (!family) return null;
                          const isSelected = selectedFamilyKey === family.familyKey;
                          const loadedVariants = familyVariantsByKey[family.familyKey];
                          const variants = loadedVariants ?? [];
                          const pickupSummary = loadedVariants ? groupPickupSummary(family, variants) : unloadedFamilyPickupSummary(family);
                          const creditSummary = loadedVariants ? cardCreditSummary(variants) : unloadedFamilyCreditSummary(family);
                          const unresolvedCategoryCount = groupUnresolvedSummary(family, variants).length;
              return (
                <div className={`mb-family-block ${repScopeClass(primaryRepScope(family.rewardedReputationPaths, family.reputationScope.displayName))}${isSelected ? " is-selected" : ""}`} key={family.familyKey}>
                  <button
                    type="button"
                    className="mb-family-row mission-group-card"
                    aria-expanded={isSelected}
                    onClick={() => {
                      setOpenVariant("");
                      setParam("family", isSelected ? "" : family.familyKey);
                    }}
                  >
                      <span className="mission-group-card__rail" aria-hidden="true" />
                      <span className="mission-group-card__body">
                        <span className="mission-group-card__header">
                          <span className="mission-faction-initials" aria-hidden="true">{factionInitials(family.provider)}</span>
                          <span className="mb-family-copy mission-group-card__title-block">
                            <strong className="mission-group-card__title">{family.displayName}</strong>
                            <small>{family.provider}</small>
                          </span>
                        </span>
                      <span className="mission-group-card__primary">
                        <span className={`mission-rep-reward-pill ${repScopeClass(primaryRepScope(family.rewardedReputationPaths, family.reputationScope.displayName))}`}>{repPathSummary(family.rewardedReputationPaths)}</span>
                        {rewardsDifferentFromScope(family) && <span className={`mb-rep-badge ${repScopeClass(primaryRepScope(family.rewardedReputationPaths, "Mixed"))}`}>Grouped under {shortRepScope(family.reputationScope.displayName)}</span>}
                      </span>
                      <span className="mission-group-card__meta">
                        <span className="mission-card-row mission-card-row--pickup" title={pickupSummary}>
                          <span className="mission-card-row__icon"><MissionCardRowIcon type="pickup" /></span>
                          <span>Pickup: {pickupSummary}</span>
                        </span>
                        <span className="mission-card-row">
                          <span className="mission-card-row__icon"><MissionCardRowIcon type="missions" /></span>
                          <span>{family.variantCount} playable mission{family.variantCount === 1 ? "" : "s"}</span>
                        </span>
                        <span className={`mission-card-row mission-card-row--blueprint${family.blueprintRewardGroups.length > 0 ? " has-blueprints" : ""}`}>
                          <span className="mission-card-row__icon"><MissionCardRowIcon type="blueprints" /></span>
                          <span>{cardBlueprintSummary(family)}</span>
                        </span>
                        <span className="mission-card-row">
                          <span className="mission-card-row__icon"><MissionCardRowIcon type="credits" /></span>
                          <span>Credits: {creditSummary}</span>
                        </span>
                        {unresolvedCategoryCount > 0 && <span>{unresolvedCategoryCount} unresolved categor{unresolvedCategoryCount === 1 ? "y" : "ies"}</span>}
                      </span>
                      {(family.crimeStatRequirement === "required" || family.lawfulClassification === "unlawful") && (
                        <span className="mission-warning-summary">
                          {family.crimeStatRequirement === "required" || family.lawfulClassification === "unlawful" ? <span>{legalBadge(family).label}</span> : null}
                        </span>
                      )}
                    </span>
                  </button>
                  {isSelected && familyVariantLoadingKey === family.familyKey && !loadedVariants && (
                    <div className="mb-state">Loading family variants...</div>
                  )}
                  {isSelected && familyVariantErrors[family.familyKey] && (
                    <div className="mb-state is-error">{familyVariantErrors[family.familyKey]}</div>
                  )}
                  {isSelected && loadedVariants && (
                    <FamilyDetail
                      family={family}
                      variants={variants}
                      openVariant={openVariant}
                      setOpenVariant={setOpenVariant}
                      onClose={() => setParam("family", "")}
                    />
                  )}
                </div>
              );
                        })}
                        </div>
                      </section>
                    ))}
                    </div>
                  </section>
                ))}
              </section>
              );
            })}
          </main>
        )}
      </div>
    </div>
  );
}
