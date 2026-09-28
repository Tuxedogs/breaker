import { DEFAULT_MATERIAL_IDENTITY_RESOLVER, normalizeMaterialIdentityToken } from "./materialIdentity";

const MATERIAL_ASSET_ROOT = "/assets/materials";
export const FALLBACK_MATERIAL_COLOR = "#71818A";

export type MaterialPresentation = {
  canonicalKey: string;
  displayName: string;
  color: string;
  iconSrc: string | null;
  isCanonical: boolean;
};

type CanonicalMaterialPresentation = Omit<MaterialPresentation, "isCanonical"> & {
  aliases?: readonly string[];
};

const CANONICAL_MATERIAL_PRESENTATIONS: readonly CanonicalMaterialPresentation[] = [
  { canonicalKey: "pressurizedice", displayName: "Pressurized Ice", color: "#DDF4FF", iconSrc: `${MATERIAL_ASSET_ROOT}/pressurized-ice.webp` },
  { canonicalKey: "borase", displayName: "Borase", color: "#E8DDD1", iconSrc: `${MATERIAL_ASSET_ROOT}/borase.webp` },
  { canonicalKey: "gold", displayName: "Gold", color: "#CFA22E", iconSrc: `${MATERIAL_ASSET_ROOT}/gold.webp` },
  { canonicalKey: "taranite", displayName: "Taranite", color: "#9C412F", iconSrc: `${MATERIAL_ASSET_ROOT}/taranite.webp` },
  { canonicalKey: "stileron", displayName: "Stileron", color: "#49525D", iconSrc: `${MATERIAL_ASSET_ROOT}/stileron.webp` },
  { canonicalKey: "iron", displayName: "Iron", color: "#A89A8D", iconSrc: `${MATERIAL_ASSET_ROOT}/iron.webp` },
  { canonicalKey: "titanium", displayName: "Titanium", color: "#5B5A58", iconSrc: `${MATERIAL_ASSET_ROOT}/titanium.webp` },
  { canonicalKey: "riccite", displayName: "Riccite", color: "#767C80", iconSrc: `${MATERIAL_ASSET_ROOT}/riccite.webp` },
  { canonicalKey: "savrilium", displayName: "Savrilium", color: "#4FA89C", iconSrc: `${MATERIAL_ASSET_ROOT}/savrilium.webp` },
  { canonicalKey: "copper", displayName: "Copper", color: "#A56A49", iconSrc: `${MATERIAL_ASSET_ROOT}/copper.webp` },
  { canonicalKey: "ouratite", displayName: "Ouratite", color: "#8D7A56", iconSrc: `${MATERIAL_ASSET_ROOT}/ouratite.webp` },
  { canonicalKey: "hadanite", displayName: "Hadanite", color: "#D68AB8", iconSrc: `${MATERIAL_ASSET_ROOT}/hadanite.webp` },
  { canonicalKey: "dolivine", displayName: "Dolivine", color: "#1EDB68", iconSrc: `${MATERIAL_ASSET_ROOT}/dolivine.webp` },
  { canonicalKey: "sadaryx", displayName: "Sadaryx", color: "#E7E7E2", iconSrc: `${MATERIAL_ASSET_ROOT}/sadaryx.webp` },
  { canonicalKey: "feynmaline", displayName: "Feynmaline", color: "#3C7CE6", iconSrc: `${MATERIAL_ASSET_ROOT}/feynmaline.webp` },
  { canonicalKey: "saldynium", displayName: "Saldynium", color: "#B8BDC3", iconSrc: `${MATERIAL_ASSET_ROOT}/saldynium.webp` },
  { canonicalKey: "carinite", displayName: "Carinite", color: "#C45A7A", iconSrc: `${MATERIAL_ASSET_ROOT}/carinite.webp` },
  { canonicalKey: "carinite-pure", displayName: "Pure Carinite", color: "#7A1626", iconSrc: null, aliases: ["Carinite Pure", "carinitepure", "purecarinite"] },
  { canonicalKey: "janalite", displayName: "Janalite", color: "#CDB24E", iconSrc: `${MATERIAL_ASSET_ROOT}/janalite.webp` },
  { canonicalKey: "jaclium", displayName: "Jaclium", color: "#556457", iconSrc: `${MATERIAL_ASSET_ROOT}/jaclium.webp` },
  { canonicalKey: "aluminum", displayName: "Aluminum", color: "#8A5A44", iconSrc: `${MATERIAL_ASSET_ROOT}/aluminum.webp`, aliases: ["Aluminium"] },
  { canonicalKey: "hephaestanite", displayName: "Hephaestanite", color: "#B66A32", iconSrc: `${MATERIAL_ASSET_ROOT}/hephaestanite.webp` },
  { canonicalKey: "aphorite", displayName: "Aphorite", color: "#2A62FF", iconSrc: `${MATERIAL_ASSET_ROOT}/aphorite.webp` },
  { canonicalKey: "corundum", displayName: "Corundum", color: "#A54857", iconSrc: `${MATERIAL_ASSET_ROOT}/corundum.webp` },
  { canonicalKey: "tungsten", displayName: "Tungsten", color: "#5D564C", iconSrc: `${MATERIAL_ASSET_ROOT}/tungsten.webp` },
  { canonicalKey: "laranite", displayName: "Laranite", color: "#E7F0C7", iconSrc: `${MATERIAL_ASSET_ROOT}/laranite.webp` },
  { canonicalKey: "aslarite", displayName: "Aslarite", color: "#9C755F", iconSrc: `${MATERIAL_ASSET_ROOT}/aslarite.webp` },
] as const;

const presentationByIdentity = new Map<string, CanonicalMaterialPresentation>();
for (const presentation of CANONICAL_MATERIAL_PRESENTATIONS) {
  for (const identity of [presentation.canonicalKey, presentation.displayName, ...(presentation.aliases ?? [])]) {
    presentationByIdentity.set(normalizeMaterialIdentityToken(identity), presentation);
  }
}

export const canonicalMaterialPresentations = CANONICAL_MATERIAL_PRESENTATIONS.map(({ aliases: _aliases, ...presentation }) => presentation);

export function resolveMaterialPresentation(materialIdentity: string | null | undefined): MaterialPresentation {
  const rawIdentity = (materialIdentity ?? "").trim();
  const identityKey = DEFAULT_MATERIAL_IDENTITY_RESOLVER.canonicalKey(rawIdentity);
  const presentation = presentationByIdentity.get(normalizeMaterialIdentityToken(identityKey))
    ?? presentationByIdentity.get(normalizeMaterialIdentityToken(rawIdentity));

  if (presentation) {
    return {
      canonicalKey: presentation.canonicalKey,
      displayName: presentation.displayName,
      color: presentation.color,
      iconSrc: presentation.iconSrc,
      isCanonical: true,
    };
  }

  return {
    canonicalKey: identityKey,
    displayName: rawIdentity,
    color: FALLBACK_MATERIAL_COLOR,
    iconSrc: null,
    isCanonical: false,
  };
}
