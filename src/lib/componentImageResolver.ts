const COMPONENT_IMAGE_ROOT = "/images/component-thumbnails";

export type ComponentImageIdentity = {
  entityClass?: string | null;
  componentId?: string | null;
  blueprintId?: string | null;
  canonicalKey?: string | null;
};

type ComponentImageEntry = {
  filename: string;
  identifiers: readonly string[];
};

export const COMPONENT_IMAGE_ENTRIES: readonly ComponentImageEntry[] = [
  { filename: "ad5b.png", identifiers: ["ba842720-ad32-4d53-8f56-992bacb1fc45", "ad5b", "BP_CRAFT_BEHR_BallisticGatling_S5"] },
  { filename: "AD4B.png", identifiers: ["e4afc8b4-da61-4efb-af7e-f003d9900d96", "1727fc8f-e31c-4d66-9670-084aadb15955", "BP_CRAFT_BEHR_BallisticGatling_S4"] },
  { filename: "c788.png", identifiers: ["6635dc5f-dfcd-4b72-9d9d-8d3620820352", "6713db41-8231-4e71-b7a2-74073ddd4b50", "BP_CRAFT_BEHR_BallisticCannon_S4"] },
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

function normalizeIdentifier(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

const componentImageByIdentifier = new Map<string, string>();
for (const entry of COMPONENT_IMAGE_ENTRIES) {
  const imageUrl = `${COMPONENT_IMAGE_ROOT}/${entry.filename}`;
  for (const identifier of entry.identifiers) {
    componentImageByIdentifier.set(normalizeIdentifier(identifier), imageUrl);
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

  return null;
}
