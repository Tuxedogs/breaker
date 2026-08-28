import {
  DEFAULT_MATERIAL_IDENTITY_RESOLVER,
  createMaterialIdentityResolver,
  isMaterialIdentityGuid,
  normalizeMaterialIdentityToken,
  type MaterialIdentityRecord,
  type MaterialIdentityResolver,
} from "../../lib/materialIdentity";

let materialIdentityResolver: MaterialIdentityResolver = DEFAULT_MATERIAL_IDENTITY_RESOLVER;

export function configureMiningMaterialIdentities(identities: readonly MaterialIdentityRecord[]): void {
  materialIdentityResolver = createMaterialIdentityResolver(identities);
}

export function isUuidMaterialKey(value: string | null | undefined): boolean {
  return isMaterialIdentityGuid(value);
}

export function canonicalMiningMaterialKey(value: string | null | undefined): string {
  return materialIdentityResolver.canonicalKey(value);
}

export function canonicalMiningMaterialName(value: string | null | undefined): string {
  return materialIdentityResolver.canonicalDisplayName(value);
}

export function canonicalMiningMaterial(input: {
  id?: string | null;
  materialKey?: string | null;
  materialId?: string | null;
  label?: string | null;
  displayName?: string | null;
  materialName?: string | null;
}): { key: string; label: string; unresolvedUuid: boolean } {
  const candidates = [
    input.materialKey,
    input.id,
    input.materialId,
    input.displayName,
    input.materialName,
    input.label,
  ];
  const first = candidates.find((candidate) => {
    const value = candidate?.trim();
    if (!value) return false;
    return !isUuidMaterialKey(value) || materialIdentityResolver.isKnown(value);
  }) ?? candidates.find((candidate) => Boolean(candidate?.trim())) ?? "";
  const resolved = materialIdentityResolver.resolve(first);
  const key = resolved?.materialKey ?? normalizeMaterialIdentityToken(first);
  const nameCandidate = [input.displayName, input.materialName, input.label]
    .find((candidate) => Boolean(candidate?.trim()));
  const label = resolved?.displayName ?? nameCandidate?.trim() ?? key;
  return {
    key,
    label,
    unresolvedUuid: isUuidMaterialKey(first) && !resolved,
  };
}
