const COMPONENT_IMAGE_ROOT = "/images/component-thumbnails";

export type ComponentImageIdentity = {
  entityClass?: string | null;
  componentId?: string | null;
  blueprintId?: string | null;
  canonicalKey?: string | null;
  componentName?: string | null;
  componentType?: string | null;
  size?: number | string | null;
  className?: string | null;
};

type ComponentImageEntry = {
  filename: string;
  identifiers: readonly string[];
  heroSafe?: boolean;
};

export const COMPONENT_IMAGE_ENTRIES: readonly ComponentImageEntry[] = [
  { filename: "behr-ballistic-gatling-s5.webp", identifiers: ["ba842720-ad32-4d53-8f56-992bacb1fc45", "ad5b", "BP_CRAFT_BEHR_BallisticGatling_S5"], heroSafe: true },
  { filename: "behr-ballistic-gatling-s4.webp", identifiers: ["e4afc8b4-da61-4efb-af7e-f003d9900d96", "1727fc8f-e31c-4d66-9670-084aadb15955", "BP_CRAFT_BEHR_BallisticGatling_S4"], heroSafe: true },
  { filename: "behr-ballistic-gatling-s6.webp", identifiers: ["6c46b8e3-81c8-4018-bce2-740b81174a00", "ac3dc178-0b5d-4a73-9ad6-6ce05e9c2620", "BP_CRAFT_BEHR_BallisticGatling_S6"], heroSafe: true },
  { filename: "behr-ballistic-cannon-s4.webp", identifiers: ["6635dc5f-dfcd-4b72-9d9d-8d3620820352", "6713db41-8231-4e71-b7a2-74073ddd4b50", "BP_CRAFT_BEHR_BallisticCannon_S4"], heroSafe: true },
  { filename: "kbar-ballistic-cannon-s1.webp", identifiers: ["85fd75f8-6c6c-4d3f-839f-988ae7660617", "ad0494d5-ca83-4f6a-a4c0-f29b7b221a20", "BP_CRAFT_KBAR_BallisticCannon_S1"], heroSafe: true },
  { filename: "kbar-ballistic-cannon-s2.webp", identifiers: ["02a7f68a-5bdd-4887-a256-20c985a65bda", "b04aff42-d892-4ca9-991e-101c869a7caa", "BP_CRAFT_KBAR_BallisticCannon_S2"], heroSafe: true },
  { filename: "kbar-ballistic-cannon-s3.webp", identifiers: ["f03daac4-28e2-405c-b226-c258151cb9f1", "a8c6afe2-0920-43ca-a62f-01bf6908c93e", "BP_CRAFT_KBAR_BallisticCannon_S3"], heroSafe: true },
  { filename: "hrst-laser-repeater-s1.webp", identifiers: ["ed951ee5-0873-45e8-92b2-586a277f4ba6", "4c5a8d37-1eb2-4395-8c3e-54b8f738639d", "BP_CRAFT_HRST_LaserRepeater_S1"], heroSafe: true },
  { filename: "hrst-laser-repeater-s2.webp", identifiers: ["ea6b4297-83a4-476f-aee0-9d4f87168cf7", "8f166b36-2bb7-4d38-9e3a-464801b40f83", "BP_CRAFT_HRST_LaserRepeater_S2"], heroSafe: true },
  { filename: "hrst-laser-repeater-s3.webp", identifiers: ["c526f686-a3da-48fa-b9c3-d58fb8e31dc5", "626da3a0-dc9c-49bd-ad97-497239675894", "BP_CRAFT_HRST_LaserRepeater_S3"], heroSafe: true },
  { filename: "hrst-laser-repeater-s4.webp", identifiers: ["8d868b78-eccd-4ba5-a4a5-57e2f20bdc35", "44fc600c-7523-4ce7-85a5-d02cd586cb4a", "BP_CRAFT_HRST_LaserRepeater_S4"], heroSafe: true },
  { filename: "hrst-laser-repeater-s5.webp", identifiers: ["2c9b3880-a108-4746-a6cd-7e2b04feee36", "f6cc35f9-96b6-4e58-90d0-9b50d4dc92ee", "BP_CRAFT_HRST_LaserRepeater_S5"], heroSafe: true },
  { filename: "hrst-laser-repeater-s6.webp", identifiers: ["f02c1934-9ebb-413c-9f3e-cbcb262f25de", "668c64ba-05cf-47fb-88af-e815d176c7d5", "BP_CRAFT_HRST_LaserRepeater_S6"], heroSafe: true },
  { filename: "cit2cool.png", identifiers: ["59a37716-f4d3-4dcb-a41e-0f2c3064e169", "80f82e57-67d7-464e-a3f1-10770d31440e", "BP_CRAFT_COOL_JSPN_S02_FrostStarEX_SCItem"] },
  { filename: "comp2power.png", identifiers: ["78e0c040-6668-4b43-a29c-4c47051bba8d", "63a75fe7-dd41-41c8-8854-b5ba3b5acf46", "BP_CRAFT_POWR_ACOM_S02_LuxCore_SCItem"] },
  { filename: "cool2comp.png", identifiers: ["67b6c401-1017-4c39-93f6-8305c4c67f69", "479a96c4-0b36-48f3-9ff6-5f4d7645dec3", "BP_CRAFT_COOL_ACOM_S02_AbsoluteZero_SCItem"] },
  { filename: "deadbolt4.png", identifiers: ["45a6750e-f453-4444-8a4d-67023187ac3f", "a0802d45-54d4-4e9b-8fa8-6b45ac193463", "BP_CRAFT_ESPR_BallisticCannon_S4"] },
  { filename: "deadbolt5.png", identifiers: ["76775574-fcf2-493d-859e-337f1267a7ef", "08edebc6-4c64-49e6-ba3a-c62140ead490", "BP_CRAFT_ESPR_BallisticCannon_S5"] },
  { filename: "disto5scatter.png", identifiers: ["2e0a3446-23e2-447b-8f1c-2b01516ca396"] },
  { filename: "gt220.png", identifiers: ["b837397c-47b6-45e7-b409-db290a068b47", "1b6eb647-f144-4643-9d8d-ec76bf5c985f", "BP_CRAFT_GATS_BallisticGatling_S3"] },
  { filename: "hofsteade2.png", identifiers: ["b422bcf8-b553-4b09-b2be-e92ab2f80e9a", "0b6cf9a1-ef55-47ee-ab8d-c734d4f3b073", "BP_CRAFT_Mining_Laser_SHIN_Hofstede_S2"] },
  { filename: "m5a.png", identifiers: ["f72ca643-b48c-4f6e-abb7-d5bc8eb261aa", "9fe902be-8b39-4d71-9017-e2fed7b0604c", "BP_CRAFT_BEHR_LaserCannon_S3"] },
  { filename: "mil0power.png", identifiers: ["b1c89d89-d408-4998-9b17-76986d78a9dd", "9585b0dc-b660-4e2a-9136-0092af1e72c1", "BP_CRAFT_POWR_AMRS_S01_JS300_SCItem"] },
  { filename: "mil0poewr.png", identifiers: ["d89b535f-8187-4840-b5f4-3230c789dfd1", "8de23a42-7652-4de0-bb2c-c51edf8a6c23", "BP_CRAFT_POWR_AEGS_S01_Quadracell_SCItem"] },
  { filename: "mil1shield.png", identifiers: ["0baaf20a-460e-4668-84f2-d09f9d31b492", "db3f4c97-8d40-4b36-b397-452dea1594fc", "BP_CRAFT_SHLD_GODI_S01_FR66_SCItem"] },
  { filename: "mil2cool.png", identifiers: ["a52245d7-a95e-46d5-a933-32267371e156", "d9def0f6-9dc1-4267-b446-85a1ad9ce954", "BP_CRAFT_COOL_AEGS_S02_Avalanche_SCItem"] },
  { filename: "mil3cool.png", identifiers: ["2c93a027-3b9a-4c8b-b5b0-b03676b35e2d", "81bd2f26-f106-4273-aed7-a66f52b14978", "BP_CRAFT_COOL_AEGS_S03_Blizzard_SCItem"] },
  { filename: "mil3sheild.png", identifiers: ["5fa67088-9677-40c4-b552-46c16bd7162e", "db6460d8-273e-4fe3-bf57-a02a61e7a3e2", "BP_CRAFT_SHLD_GODI_S03_FR86_SCItem"] },
  { filename: "mill3power.png", identifiers: ["ecea4817-3a40-480d-918d-6fe8cf7227c2", "99f5c8a9-2721-439e-9f18-b2ad7d9fc0ed", "799e4d02-1b04-45cb-ac67-2453588a8c99", "BP_CRAFT_POWR_AEGS_S03_QuadracellMX_SCItem"] },
  { filename: "milQTs2.png", identifiers: ["fce50a6d-690e-4b2d-9104-f3743387e1f0", "e55162ea-cd69-4ace-a519-ffd40bfb78a9", "BP_CRAFT_QDRV_WETK_S02_XL1_SCItem"] },
  { filename: "sealth1cool.png", identifiers: ["b4be7e39-8cd9-4d38-af89-61ace9c67796", "bb0bcf7d-9953-4d81-9976-284c9bc356e1", "BP_CRAFT_COOL_TYDT_S01_HeatSafe_SCItem"] },
  { filename: "sealth1shieldC.png", identifiers: ["ecc8d200-548c-4de0-a60e-d1e316515170", "5c1b49d9-db7e-4898-8fe1-a97072f8cf37", "BP_CRAFT_SHLD_ASAS_S01_Shimmer_SCItem"] },
  { filename: "shredder.png", identifiers: ["bbfbb4b5-c26e-4bee-9d41-9679e102e860", "f311c57f-f1ae-4ca1-b4dc-7b516f475f9c", "BP_CRAFT_BEHR_BallisticRepeater_S3"] },
  { filename: "stealth1cool.png", identifiers: ["5f474dec-75e8-4626-9c0a-f5a48f841f33", "b4e72df7-8386-4a6b-8bd8-de629a830676", "BP_CRAFT_COOL_TYDT_S01_VaporBlock_SCItem"] },
] as const;

type RepresentativeComponentArtEntry = {
  url: string;
  exactNames: readonly string[];
  identifiers: readonly string[];
  componentType: "quantumdrive" | "shield";
  size: number;
  className: "civilian" | "competition" | "industrial" | "military" | "stealth";
};

/** Exact item renders that also provide representative family/size/class art. */
export const REPRESENTATIVE_COMPONENT_ART: readonly RepresentativeComponentArtEntry[] = [
  { url: "/assets/fitting/components/representative/quantum-drives/s1/qdrv-acas-competition-s01-lightfire.webp", exactNames: ["LightFire"], identifiers: ["39c89487-3a74-442a-b3a9-b1e26213f0bb", "f3ceefa2-670f-47c5-8c13-a80c8cf93c52"], componentType: "quantumdrive", size: 1, className: "competition" },
  { url: "/assets/fitting/components/representative/quantum-drives/s1/qdrv-just-industrial-s01-colossus.webp", exactNames: ["Colossus"], identifiers: ["6ba5fce8-fac4-42f3-8606-0185b2823ee2", "e61d58d6-3ffd-4d7b-ad19-64ae9d27efb1"], componentType: "quantumdrive", size: 1, className: "industrial" },
  { url: "/assets/fitting/components/representative/quantum-drives/s1/qdrv-raco-stealth-s01-spectre.png", exactNames: ["Spectre"], identifiers: ["1f57b7a3-ae43-405f-b9cc-457efb01cbc8", "1f6908a2-80b0-48c1-ad76-d93a6afcbfd7"], componentType: "quantumdrive", size: 1, className: "stealth" },
  { url: "/assets/fitting/components/representative/quantum-drives/s1/qdrv-rsi-civilian-s01-atlas.webp", exactNames: ["Atlas"], identifiers: ["17b29a33-88fe-484f-bb9b-fbf780273ff5", "934ac478-9c87-48d1-8fd3-e5359171983c"], componentType: "quantumdrive", size: 1, className: "civilian" },
  { url: "/assets/fitting/components/representative/quantum-drives/s1/qdrv-wetk-military-s01-vk00.webp", exactNames: ["VK-00", "VK00"], identifiers: ["33be7f1a-3f75-4627-bb8b-88e6d6b42f4e", "995c2de5-f7e6-4646-83e3-4627ba5a5865"], componentType: "quantumdrive", size: 1, className: "military" },
  { url: "/assets/fitting/components/representative/shields/s1/hld-basl-industrial-s01-palisade.webp", exactNames: ["Palisade"], identifiers: ["effce782-5e32-4402-b399-28b63eb573a7", "15ebdff2-2724-4fb3-abbf-db20e150da77"], componentType: "shield", size: 1, className: "industrial" },
  { url: "/assets/fitting/components/representative/shields/s1/shld-asas-stealth-s01-mirage.webp", exactNames: ["Mirage"], identifiers: ["84e8ce98-b46f-4b03-aec2-472a4e93bd97", "94807046-b89e-422d-8bbc-f914b1cbc08d"], componentType: "shield", size: 1, className: "stealth" },
  { url: "/assets/fitting/components/representative/shields/s1/shld-behr-civilian-s01-7sa.webp", exactNames: ["7SA", "7SA 'Concord'"], identifiers: ["1b604dc8-0828-421d-844d-130c38aaf0d8", "b1e490ef-86d6-466a-afb1-3875028b7a8a"], componentType: "shield", size: 1, className: "civilian" },
  { url: "/assets/fitting/components/representative/shields/s1/shld-godi-military-s01-fr66.webp", exactNames: ["FR-66", "FR66"], identifiers: ["db3f4c97-8d40-4b36-b397-452dea1594fc", "0baaf20a-460e-4668-84f2-d09f9d31b492", "BP_CRAFT_SHLD_GODI_S01_FR66_SCItem"], componentType: "shield", size: 1, className: "military" },
  { url: "/assets/fitting/components/representative/shields/s1/shld-yorm-competition-s01-jaghte.webp", exactNames: ["Jaghte"], identifiers: ["08735a40-c8ec-46b0-b84b-4fe7e2c30473", "0eae2a8c-8bc9-4b32-af70-a06e667b0165"], componentType: "shield", size: 1, className: "competition" },
] as const;

function normalizeIdentifier(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

const componentImageByIdentifier = new Map<string, string>();
const componentHeroSafeUrls = new Set<string>();
for (const entry of COMPONENT_IMAGE_ENTRIES) {
  const imageUrl = `${COMPONENT_IMAGE_ROOT}/${entry.filename}`;
  if (entry.heroSafe) componentHeroSafeUrls.add(imageUrl);
  for (const identifier of entry.identifiers) {
    componentImageByIdentifier.set(normalizeIdentifier(identifier), imageUrl);
  }
}

const representativeArtByExactName = new Map<string, string>();
for (const entry of REPRESENTATIVE_COMPONENT_ART) {
  for (const identifier of entry.identifiers) {
    componentImageByIdentifier.set(normalizeIdentifier(identifier), entry.url);
  }
  for (const name of entry.exactNames) {
    representativeArtByExactName.set(normalizeIdentifier(name), entry.url);
  }
}

export function resolveComponentImageUrl(identity: ComponentImageIdentity): string | null {
  const identifiers = [
    identity.entityClass,
    identity.componentId,
    identity.blueprintId,
    identity.canonicalKey,
  ];

  for (const identifier of identifiers) {
    const imageUrl = componentImageByIdentifier.get(normalizeIdentifier(identifier));
    if (imageUrl) return imageUrl;
  }

  const exactNameUrl = representativeArtByExactName.get(normalizeIdentifier(identity.componentName));
  if (exactNameUrl) return exactNameUrl;

  const componentType = normalizeIdentifier(identity.componentType).replace(/[_\s-]+/g, "");
  const size = typeof identity.size === "number" ? identity.size : Number(identity.size);
  const className = normalizeIdentifier(identity.className);
  const representative = REPRESENTATIVE_COMPONENT_ART.find((entry) => (
    normalizeIdentifier(entry.componentType).replace(/[_\s-]+/g, "") === componentType
    && entry.size === size
    && normalizeIdentifier(entry.className) === className
  ));
  if (representative) return representative.url;

  return null;
}

/** Returns only transparent, presentation-safe art suitable for a large hero stage. */
export function resolveComponentHeroArtUrl(identity: ComponentImageIdentity): string | null {
  const imageUrl = resolveComponentImageUrl(identity);
  if (!imageUrl) return null;

  if (REPRESENTATIVE_COMPONENT_ART.some((entry) => entry.url === imageUrl)) return imageUrl;

  return componentHeroSafeUrls.has(imageUrl) ? imageUrl : null;
}
