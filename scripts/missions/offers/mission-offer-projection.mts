import { createHash } from "node:crypto";

import { missionPayloadFileName } from "../project/browser-projection.mts";
import type {
  MissionOfferProviderEvidenceV1,
  MissionOfferTitleEvidenceV1,
  MissionOfferVerificationEvidenceV1,
  MissionSourceRecordV4,
} from "../schema/source-v4.mts";

export const MISSION_OFFER_SCHEMA_VERSION = 1 as const;
export const MISSION_OFFER_IDENTITY_VERSION = "scintel-evidence-to-moonbreaker-offer-v1" as const;

export type MissionOfferAuditFlagV1 =
  | "provider_identity_unresolved"
  | "title_identity_unresolved"
  | "exact_variant_identity_fallback"
  | "runtime_title_template"
  | "verification_unknown"
  | "verification_mixed"
  | "offer_key_collision_disambiguated";

export type MissionOfferVariantProjectionV1 = {
  variantKey: string;
  familyKey: string;
  legacyConceptKey: string;
  missionType: string;
  rewardTypes: string[];
  reputationRewardFacets: MissionOfferReputationRewardMemberV1[];
  releaseFlags: string[];
  confidenceFlags: string[];
  objectiveTemplateKeys: string[];
};

export type MissionOfferReputationRewardMemberV1 = {
  stableKey: string;
  factionKey: string;
  factionDisplayName: string;
  scopeKey: string;
  scopeDisplayName: string;
  amount?: number;
  confidence: "resolved" | "partial" | "unresolved";
};

export type MissionOfferReputationRewardFacetV1 = {
  stableKey: string;
  factionKey: string;
  factionDisplayName: string;
  scopeKey: string;
  scopeDisplayName: string;
  confidence: "resolved" | "partial" | "unresolved";
  variantCount: number;
  rewardPathCount: number;
  amountSummary: {
    status: "exact" | "range" | "partial" | "unresolved";
    resolvedPathCount: number;
    unresolvedPathCount: number;
    minAmount?: number;
    maxAmount?: number;
  };
};

export type MissionOfferIdentityV1 = {
  version: typeof MISSION_OFFER_IDENTITY_VERSION;
  strategy: "provider_and_raw_title" | "exact_variant_fallback";
  providerIdentity: string;
  titleIdentity: string;
  sourceTuple: [providerIdentity: string, titleIdentity: string];
};

export type MissionOfferV1 = {
  offerSchemaVersion: typeof MISSION_OFFER_SCHEMA_VERSION;
  offerKey: string;
  identity: MissionOfferIdentityV1;
  displayTitle: string;
  displayTitleTemplate: string;
  titleEvidence: MissionOfferTitleEvidenceV1;
  provider: MissionOfferProviderEvidenceV1;
  providerKey: string;
  verificationStatus: MissionOfferVerificationEvidenceV1["status"];
  verificationStatuses: MissionOfferVerificationEvidenceV1["status"][];
  variantKeys: string[];
  familyKeys: string[];
  legacyConceptKeys: string[];
  objectiveTemplateKeys: string[];
  missionTypes: string[];
  rewardTypes: string[];
  reputationRewardKeys: string[];
  reputationRewardFacets: MissionOfferReputationRewardFacetV1[];
  releaseFlags: string[];
  confidenceFlags: string[];
  auditFlags: MissionOfferAuditFlagV1[];
  searchText: string;
};

export type MissionOfferProjectionV1 = {
  offers: MissionOfferV1[];
  offersByKey: Record<string, MissionOfferV1>;
  variantOfferKeys: Record<string, string>;
  legacyConceptOfferKeys: Record<string, string[]>;
  identityReport: {
    schemaVersion: 1;
    identityVersion: typeof MISSION_OFFER_IDENTITY_VERSION;
    variantCount: number;
    offerCount: number;
    resolvedIdentityOfferCount: number;
    fallbackOfferCount: number;
    runtimeTemplateOfferCount: number;
    unknownVerificationOfferCount: number;
    mixedVerificationOfferCount: number;
    collisionDisambiguatedOfferCount: number;
    auditFlagCounts: Record<string, number>;
  };
};

export type MissionOfferGoldenSpecV1 = {
  offerKey: string;
  providerKey: string;
  titleRaw: string;
  displayTitle: string;
  exactVariantIds: string[];
};

type OfferMember = {
  record: MissionSourceRecordV4;
  variant: MissionOfferVariantProjectionV1;
  identity: MissionOfferIdentityV1;
  baseOfferKey: string;
  displayTitle: string;
  displayTitleTemplate: string;
  providerKey: string;
  auditFlags: MissionOfferAuditFlagV1[];
};

function clean(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

function unique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function missionOfferSlugV1(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function readableRuntimeSegment(value: string): string {
  const words = value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\bTitle\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = words
    .replace(/^Black Box Recover\b/, "Black Box Recovery")
    .replace(/^Recover Space\b/, "Space Recovery")
    .replace(/^Recover Item\b/, "Item Recovery")
    .replace(/^Search Body Space\b/, "Body Search")
    .replace(/^Salvage Contractor\b/, "Salvage Contract");
  return normalized.replace(/\s+(Very Easy|Very Hard|Easy|Medium|Hard|Super|Intro)$/i, " — $1");
}

function runtimePlaceholder(token: { expression: string; segments: string[] }): string {
  const segments = token.segments.map((segment) => clean(segment)).filter((segment): segment is string => Boolean(segment));
  const contractorTitleSegment = segments[0]?.toLowerCase() === "contractor" && segments.length > 1
    ? segments[1]
    : undefined;
  const label = contractorTitleSegment
    ? readableRuntimeSegment(contractorTitleSegment)
    : segments[0] ?? clean(token.expression) ?? "RuntimeValue";
  return `[${label}]`;
}

export function safeMissionOfferTitleV1(title: MissionOfferTitleEvidenceV1): string {
  const template = clean(title.template) ?? clean(title.displayText);
  if (!template) return "Unknown mission offer";
  let rendered = template;
  for (const token of title.runtimeTokens) {
    rendered = rendered.replaceAll(token.raw, runtimePlaceholder(token));
  }
  return rendered.replace(/~mission\(([^)]+)\)/g, (_match, expression: string) => {
    const segments = expression.split("|").map((value) => value.trim()).filter(Boolean);
    return runtimePlaceholder({ expression, segments });
  });
}

function providerIdentity(provider: MissionOfferProviderEvidenceV1): string | undefined {
  if (provider.provenance !== "source_backed") return undefined;
  return clean(provider.displayRaw) ?? clean(provider.organizationGuid);
}

function titleIdentity(title: MissionOfferTitleEvidenceV1): string | undefined {
  return title.provenance === "source_backed" ? clean(title.raw) : undefined;
}

function providerKey(provider: MissionOfferProviderEvidenceV1): string {
  return missionOfferSlugV1(
    clean(provider.displayText)
      ?? clean(provider.displayRaw)?.replace(/^@/, "")
      ?? clean(provider.organizationGuid)
      ?? "unresolved-provider",
  );
}

function offerMember(
  record: MissionSourceRecordV4,
  variant: MissionOfferVariantProjectionV1,
): OfferMember {
  const evidence = record.offerEvidence;
  const providerId = providerIdentity(evidence.provider);
  const titleId = titleIdentity(evidence.title);
  const displayTitle = safeMissionOfferTitleV1(evidence.title);
  const resolvedProviderKey = providerKey(evidence.provider);
  const auditFlags: MissionOfferAuditFlagV1[] = [];
  if (!providerId) auditFlags.push("provider_identity_unresolved");
  if (!titleId) auditFlags.push("title_identity_unresolved");
  if (evidence.title.runtimeTokens.length > 0 || evidence.title.rendering === "runtime_templated") {
    auditFlags.push("runtime_title_template");
  }
  if (evidence.verification.status === "unknown") auditFlags.push("verification_unknown");

  if (!providerId || !titleId) {
    auditFlags.push("exact_variant_identity_fallback");
    const fallbackIdentity = `exact:${record.contractId.toLowerCase()}`;
    return {
      record,
      variant,
      identity: {
        version: MISSION_OFFER_IDENTITY_VERSION,
        strategy: "exact_variant_fallback",
        providerIdentity: providerId ?? fallbackIdentity,
        titleIdentity: titleId ?? fallbackIdentity,
        sourceTuple: [providerId ?? fallbackIdentity, titleId ?? fallbackIdentity],
      },
      baseOfferKey: `${resolvedProviderKey}:exact-${record.contractId.toLowerCase()}`,
      displayTitle,
      displayTitleTemplate: displayTitle,
      providerKey: resolvedProviderKey,
      auditFlags,
    };
  }

  return {
    record,
    variant,
    identity: {
      version: MISSION_OFFER_IDENTITY_VERSION,
      strategy: "provider_and_raw_title",
      providerIdentity: providerId,
      titleIdentity: titleId,
      sourceTuple: [providerId, titleId],
    },
    baseOfferKey: `${resolvedProviderKey}:${missionOfferSlugV1(displayTitle)}`,
    displayTitle,
    displayTitleTemplate: displayTitle,
    providerKey: resolvedProviderKey,
    auditFlags,
  };
}

function identityGroupKey(identity: MissionOfferIdentityV1): string {
  return JSON.stringify(identity.sourceTuple);
}

function stableCollisionSuffix(identity: MissionOfferIdentityV1): string {
  return createHash("sha256").update(identityGroupKey(identity)).digest("hex").slice(0, 10);
}

function buildReputationRewardFacets(members: OfferMember[]): MissionOfferReputationRewardFacetV1[] {
  const grouped = new Map<string, Array<{
    variantKey: string;
    facet: MissionOfferReputationRewardMemberV1;
  }>>();
  for (const member of members) {
    for (const facet of member.variant.reputationRewardFacets) {
      grouped.set(facet.stableKey, [
        ...(grouped.get(facet.stableKey) ?? []),
        { variantKey: member.variant.variantKey, facet },
      ]);
    }
  }

  return Array.from(grouped.entries()).map(([stableKey, rows]) => {
    const ordered = [...rows].sort((left, right) => (
      left.variantKey.localeCompare(right.variantKey)
      || left.facet.scopeDisplayName.localeCompare(right.facet.scopeDisplayName)
    ));
    const first = ordered[0]!.facet;
    const identityTuples = new Set(ordered.map(({ facet }) => JSON.stringify([
      facet.factionKey,
      facet.scopeKey,
    ])));
    if (identityTuples.size !== 1) {
      throw new Error(`Mission offer reputation facet ${stableKey} contains conflicting source identities.`);
    }
    const factionDisplayName = ordered
      .map(({ facet }) => facet.factionDisplayName)
      .find((label) => !/^unknown(?: faction)?$/i.test(label.trim()))
      ?? first.factionDisplayName;
    const scopeDisplayName = ordered
      .map(({ facet }) => facet.scopeDisplayName)
      .find((label) => !/^unknown(?: scope)?$/i.test(label.trim()))
      ?? first.scopeDisplayName;
    const amounts = ordered
      .map(({ facet }) => facet.amount)
      .filter((amount): amount is number => typeof amount === "number" && Number.isFinite(amount));
    const unresolvedPathCount = ordered.length - amounts.length;
    const minAmount = amounts.length ? Math.min(...amounts) : undefined;
    const maxAmount = amounts.length ? Math.max(...amounts) : undefined;
    const confidences = new Set(ordered.map(({ facet }) => facet.confidence));
    const confidence = confidences.size === 1
      ? ordered[0]!.facet.confidence
      : "partial";
    const status = amounts.length === 0
      ? "unresolved"
      : unresolvedPathCount > 0
        ? "partial"
        : minAmount === maxAmount
          ? "exact"
          : "range";
    return {
      stableKey,
      factionKey: first.factionKey,
      factionDisplayName,
      scopeKey: first.scopeKey,
      scopeDisplayName,
      confidence,
      variantCount: new Set(ordered.map(({ variantKey }) => variantKey)).size,
      rewardPathCount: ordered.length,
      amountSummary: {
        status,
        resolvedPathCount: amounts.length,
        unresolvedPathCount,
        ...(minAmount === undefined ? {} : { minAmount }),
        ...(maxAmount === undefined ? {} : { maxAmount }),
      },
    } satisfies MissionOfferReputationRewardFacetV1;
  }).sort((left, right) => (
    left.factionDisplayName.localeCompare(right.factionDisplayName)
    || left.scopeDisplayName.localeCompare(right.scopeDisplayName)
    || left.stableKey.localeCompare(right.stableKey)
  ));
}

function buildOffer(offerKey: string, members: OfferMember[], collision: boolean): MissionOfferV1 {
  const first = members[0]!;
  const verificationStatuses = unique(
    members.map(({ record }) => record.offerEvidence.verification.status),
  ) as MissionOfferVerificationEvidenceV1["status"][];
  const verificationStatus = verificationStatuses.length === 1
    ? verificationStatuses[0]!
    : "unknown";
  const auditFlags = unique([
    ...members.flatMap((member) => member.auditFlags),
    verificationStatuses.length > 1 ? "verification_mixed" : undefined,
    collision ? "offer_key_collision_disambiguated" : undefined,
  ]) as MissionOfferAuditFlagV1[];
  const variantKeys = unique(members.map(({ variant }) => variant.variantKey)).sort();
  const familyKeys = unique(members.map(({ variant }) => variant.familyKey)).sort();
  const legacyConceptKeys = unique(members.map(({ variant }) => variant.legacyConceptKey)).sort();
  const objectiveTemplateKeys = unique(members.flatMap(({ variant }) => variant.objectiveTemplateKeys)).sort();
  const missionTypes = unique(members.map(({ variant }) => variant.missionType)).sort();
  const rewardTypes = unique(members.flatMap(({ variant }) => variant.rewardTypes)).sort();
  const reputationRewardFacets = buildReputationRewardFacets(members);
  const reputationRewardKeys = reputationRewardFacets.map((facet) => facet.stableKey);
  const releaseFlags = unique(members.flatMap(({ variant }) => variant.releaseFlags)).sort();
  const confidenceFlags = unique(members.flatMap(({ variant }) => variant.confidenceFlags)).sort();
  const searchText = unique([
    offerKey,
    first.displayTitle,
    first.displayTitleTemplate,
    first.providerKey,
    clean(first.record.offerEvidence.provider.displayRaw),
    clean(first.record.offerEvidence.provider.displayText),
    clean(first.record.offerEvidence.provider.organizationGuid),
    clean(first.record.offerEvidence.title.raw),
    clean(first.record.offerEvidence.title.localizationKey),
    ...reputationRewardFacets.flatMap((facet) => [facet.factionDisplayName, facet.scopeDisplayName]),
    ...variantKeys,
  ]).join(" ").toLowerCase();

  return {
    offerSchemaVersion: MISSION_OFFER_SCHEMA_VERSION,
    offerKey,
    identity: first.identity,
    displayTitle: first.displayTitle,
    displayTitleTemplate: first.displayTitleTemplate,
    titleEvidence: first.record.offerEvidence.title,
    provider: first.record.offerEvidence.provider,
    providerKey: first.providerKey,
    verificationStatus,
    verificationStatuses,
    variantKeys,
    familyKeys,
    legacyConceptKeys,
    objectiveTemplateKeys,
    missionTypes,
    rewardTypes,
    reputationRewardKeys,
    reputationRewardFacets,
    releaseFlags,
    confidenceFlags,
    auditFlags,
    searchText,
  };
}

export function buildMissionOffersV1(
  records: MissionSourceRecordV4[],
  variants: MissionOfferVariantProjectionV1[],
): MissionOfferProjectionV1 {
  if (records.length !== variants.length) {
    throw new Error(`Mission offer input count mismatch: ${records.length} records, ${variants.length} variants.`);
  }
  const variantsByKey = new Map(variants.map((variant) => [variant.variantKey, variant]));
  if (variantsByKey.size !== variants.length) throw new Error("Mission offer variant keys must be unique.");

  const groups = new Map<string, OfferMember[]>();
  for (const record of records) {
    const variant = variantsByKey.get(record.contractId);
    if (!variant) throw new Error(`Mission offer projection is missing exact variant ${record.contractId}.`);
    const member = offerMember(record, variant);
    const groupKey = identityGroupKey(member.identity);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), member]);
  }

  const baseKeyGroups = new Map<string, string[]>();
  for (const [groupKey, members] of groups) {
    const baseKey = members[0]!.baseOfferKey;
    baseKeyGroups.set(baseKey, [...(baseKeyGroups.get(baseKey) ?? []), groupKey]);
  }

  const offers: MissionOfferV1[] = [];
  for (const [groupKey, members] of groups) {
    const baseKey = members[0]!.baseOfferKey;
    const collision = (baseKeyGroups.get(baseKey)?.length ?? 0) > 1;
    const offerKey = collision
      ? `${baseKey}--${stableCollisionSuffix(members[0]!.identity)}`
      : baseKey;
    offers.push(buildOffer(offerKey, members, collision));
  }
  offers.sort((left, right) => left.offerKey.localeCompare(right.offerKey));

  const offersByKey = Object.fromEntries(offers.map((offer) => [offer.offerKey, offer]));
  if (Object.keys(offersByKey).length !== offers.length) throw new Error("Mission offer keys must be unique.");
  const variantOfferKeys: Record<string, string> = {};
  const legacyConceptOfferKeySets = new Map<string, Set<string>>();
  for (const offer of offers) {
    for (const variantKey of offer.variantKeys) {
      if (variantOfferKeys[variantKey]) {
        throw new Error(`Exact variant ${variantKey} is assigned to more than one mission offer.`);
      }
      variantOfferKeys[variantKey] = offer.offerKey;
    }
    for (const conceptKey of offer.legacyConceptKeys) {
      const keys = legacyConceptOfferKeySets.get(conceptKey) ?? new Set<string>();
      keys.add(offer.offerKey);
      legacyConceptOfferKeySets.set(conceptKey, keys);
    }
  }
  if (Object.keys(variantOfferKeys).length !== records.length) {
    throw new Error(`Mission offer assignment is incomplete: ${Object.keys(variantOfferKeys).length}/${records.length}.`);
  }
  const legacyConceptOfferKeys = Object.fromEntries(
    Array.from(legacyConceptOfferKeySets, ([conceptKey, keys]) => [conceptKey, Array.from(keys).sort()]),
  );
  const auditFlagCounts: Record<string, number> = {};
  for (const flag of offers.flatMap((offer) => offer.auditFlags)) {
    auditFlagCounts[flag] = (auditFlagCounts[flag] ?? 0) + 1;
  }

  return {
    offers,
    offersByKey,
    variantOfferKeys,
    legacyConceptOfferKeys,
    identityReport: {
      schemaVersion: 1,
      identityVersion: MISSION_OFFER_IDENTITY_VERSION,
      variantCount: records.length,
      offerCount: offers.length,
      resolvedIdentityOfferCount: offers.filter((offer) => offer.identity.strategy === "provider_and_raw_title").length,
      fallbackOfferCount: offers.filter((offer) => offer.identity.strategy === "exact_variant_fallback").length,
      runtimeTemplateOfferCount: offers.filter((offer) => offer.auditFlags.includes("runtime_title_template")).length,
      unknownVerificationOfferCount: offers.filter((offer) => offer.verificationStatus === "unknown").length,
      mixedVerificationOfferCount: offers.filter((offer) => offer.auditFlags.includes("verification_mixed")).length,
      collisionDisambiguatedOfferCount: offers.filter((offer) => offer.auditFlags.includes("offer_key_collision_disambiguated")).length,
      auditFlagCounts,
    },
  };
}

export function missionOfferMatchesSearchV1(offer: MissionOfferV1, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  return normalized.length === 0 || offer.searchText.includes(normalized);
}

export function assertMissionOfferGoldensV1(
  projection: MissionOfferProjectionV1,
  goldens: MissionOfferGoldenSpecV1[],
): { goldenOfferCount: number; goldenVariantCount: number; exactTitleSearchChecks: number } {
  const seenVariants = new Set<string>();
  for (const golden of goldens) {
    const offer = projection.offersByKey[golden.offerKey];
    if (!offer) throw new Error(`Golden mission offer ${golden.offerKey} was not emitted.`);
    if (offer.providerKey !== golden.providerKey) {
      throw new Error(`${golden.offerKey} provider mismatch: ${offer.providerKey} != ${golden.providerKey}.`);
    }
    if (offer.identity.titleIdentity !== golden.titleRaw) {
      throw new Error(`${golden.offerKey} raw title mismatch: ${offer.identity.titleIdentity} != ${golden.titleRaw}.`);
    }
    if (offer.displayTitle !== golden.displayTitle) {
      throw new Error(`${golden.offerKey} display title mismatch: ${offer.displayTitle} != ${golden.displayTitle}.`);
    }
    const expectedVariantIds = [...golden.exactVariantIds].sort();
    if (JSON.stringify(offer.variantKeys) !== JSON.stringify(expectedVariantIds)) {
      throw new Error(`${golden.offerKey} exact variant membership changed.`);
    }
    for (const variantId of expectedVariantIds) {
      if (seenVariants.has(variantId)) throw new Error(`Golden exact variant ${variantId} is duplicated.`);
      seenVariants.add(variantId);
      if (projection.variantOfferKeys[variantId] !== golden.offerKey) {
        throw new Error(`Golden exact variant ${variantId} is not assigned to ${golden.offerKey}.`);
      }
    }
    const searchMatches = projection.offers.filter((candidate) =>
      missionOfferMatchesSearchV1(candidate, golden.displayTitle)
    );
    if (searchMatches.length !== 1 || searchMatches[0]!.offerKey !== golden.offerKey) {
      throw new Error(`Exact offer-title search for ${golden.displayTitle} leaked sibling offer evidence.`);
    }
  }

  const ghost = projection.offersByKey["headhunters:ghost-target-name"];
  if (ghost && (
    ghost.displayTitle !== "Ghost [TargetName]"
    || /phantom|stewart/i.test(`${ghost.displayTitle} ${ghost.searchText}`)
  )) {
    throw new Error("Runtime Ghost title must preserve [TargetName] and exclude observed runtime values.");
  }

  return {
    goldenOfferCount: goldens.length,
    goldenVariantCount: seenVariants.size,
    exactTitleSearchChecks: goldens.length,
  };
}

export function buildMissionOfferShardPathsV1(offerKeys: string[]): {
  offerDetailFiles: Record<string, string>;
  offerVariantFiles: Record<string, string>;
} {
  const offerDetailFiles: Record<string, string> = {};
  const offerVariantFiles: Record<string, string> = {};
  const seen = new Set<string>();
  for (const offerKey of offerKeys) {
    const fileName = missionPayloadFileName(offerKey);
    if (seen.has(fileName)) throw new Error(`Mission offer shard filename collision for ${offerKey}.`);
    seen.add(fileName);
    offerDetailFiles[offerKey] = `offers/${fileName}`;
    offerVariantFiles[offerKey] = `offer-variants/${fileName}`;
  }
  return { offerDetailFiles, offerVariantFiles };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function protectedSubcontractEdges(
  value: MissionSourceRecordV4["subContractPrerequisiteEdges"],
  predicate: (type: string) => boolean,
): Record<string, unknown[]> {
  return Object.fromEntries(Object.entries(value ?? {}).flatMap(([owner, edges]) => {
    const matches = edges.filter((edge) => predicate(edge.type));
    return matches.length > 0 ? [[owner, matches]] : [];
  }));
}

function protectedHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function computeMissionOfferInvariantHashesV1(
  records: MissionSourceRecordV4[],
  auditedVariantIds: string[],
): Record<string, string> {
  const auditedIds = new Set(auditedVariantIds);
  const audited = records
    .filter((record) => auditedIds.has(record.contractId))
    .sort((left, right) => left.contractId < right.contractId ? -1 : left.contractId > right.contractId ? 1 : 0);
  if (audited.length !== auditedIds.size) {
    throw new Error(`Invariant audit set is incomplete: ${audited.length}/${auditedIds.size}.`);
  }
  return {
    blueprint_pool_rewards: protectedHash(audited.map((record) => ({
      variantId: record.contractId,
      blueprintRewards: record.blueprintRewards ?? [],
      outcomeEdges: record.outcomeEdges.filter((edge) => edge.type === "blueprint_reward"),
    }))),
    reputation_eligibility_and_rewards: protectedHash(audited.map((record) => ({
      variantId: record.contractId,
      minStanding: record.minStanding ?? null,
      maxStanding: record.maxStanding ?? null,
      prerequisiteEdges: record.prerequisiteEdges.filter((edge) => edge.type === "reputation"),
      subContractPrerequisiteEdges: protectedSubcontractEdges(
        record.subContractPrerequisiteEdges,
        (type) => type === "reputation",
      ),
      fixedReputationRewards: record.fixedReputationRewards ?? [],
      calculatedReputationRewards: record.calculatedReputationRewards ?? [],
      outcomeEdges: record.outcomeEdges.filter((edge) => edge.type.includes("reputation")),
    }))),
    release_and_availability_branches: protectedHash(audited.map((record) => ({
      variantId: record.contractId,
      notForRelease: record.notForRelease ?? null,
      workInProgress: record.workInProgress ?? null,
      prerequisiteEdges: record.prerequisiteEdges.filter((edge) =>
        edge.type === "location" || edge.type === "locality"
      ),
      subContractPrerequisiteEdges: protectedSubcontractEdges(
        record.subContractPrerequisiteEdges,
        (type) => type === "location" || type === "locality",
      ),
    }))),
  };
}
