export type MissionOfferFilterable = {
  searchText: string;
  providerKey: string;
  missionTypes: string[];
  rewardTypes: string[];
  reputationRewardKeys: string[];
  releaseFlags: string[];
  confidenceFlags: string[];
  verificationStatuses: string[];
};

export type MissionOfferClientFilters = {
  search?: string;
  provider?: string;
  type?: string;
  reward?: string;
  repReward?: string;
  status?: string;
  confidence?: string;
  verification?: string;
};

export function missionOfferMatchesClientFilters(
  offer: MissionOfferFilterable,
  filters: MissionOfferClientFilters,
): boolean {
  const query = filters.search?.trim().toLowerCase() ?? "";
  if (query && !offer.searchText.toLowerCase().includes(query)) return false;
  if (filters.provider && offer.providerKey !== filters.provider) return false;
  if (filters.type && !offer.missionTypes.includes(filters.type)) return false;
  if (filters.reward && !offer.rewardTypes.includes(filters.reward)) return false;
  if (filters.repReward && !offer.reputationRewardKeys.includes(filters.repReward)) return false;
  if (filters.status && !offer.releaseFlags.includes(filters.status)) return false;
  if (filters.confidence && !offer.confidenceFlags.includes(filters.confidence)) return false;
  if (filters.verification && !offer.verificationStatuses.includes(filters.verification)) return false;
  return true;
}

function hasLegacyConceptBookmark(values: ReadonlySet<string>, conceptKey: string): boolean {
  return values.has(conceptKey) || values.has(`concept:${conceptKey}`);
}

export function missionOfferBookmarkMatches(
  values: ReadonlySet<string>,
  offerKey: string,
  legacyConceptOfferKeys: Readonly<Record<string, string[]>> = {},
): boolean {
  if (values.has(`offer:${offerKey}`)) return true;
  return Object.entries(legacyConceptOfferKeys).some(([conceptKey, offerKeys]) => (
    offerKeys.length === 1
    && offerKeys[0] === offerKey
    && hasLegacyConceptBookmark(values, conceptKey)
  ));
}
