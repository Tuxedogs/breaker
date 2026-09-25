export function normalizeBlueprintGuid(value: string): string {
  return value.trim().toLowerCase();
}

export function isEligibleCraftingBlueprint(blueprintGuid: string, eligibleBlueprintGuids: ReadonlySet<string>): boolean {
  return eligibleBlueprintGuids.has(normalizeBlueprintGuid(blueprintGuid));
}

export function isWikeloMissionProvider(providerKey: string | undefined): boolean {
  return providerKey?.trim().toLowerCase() === "wikelo";
}

export function isEligibleCraftingMission(
  mission: { offerKey: string; providerKey?: string },
  eligibleMissionOfferKeys: ReadonlySet<string>,
): boolean {
  return isWikeloMissionProvider(mission.providerKey) || eligibleMissionOfferKeys.has(mission.offerKey);
}
