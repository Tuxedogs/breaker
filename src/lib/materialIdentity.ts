export type MaterialIdentityUnitType = "unit" | "SCU" | "scu" | "cscu";

export type MaterialIdentityRecord = {
  materialKey: string;
  canonicalName?: string;
  displayName?: string;
  rawName?: string;
  refinedName?: string;
  commodityName?: string;
  materialForm?: string;
  unitType?: MaterialIdentityUnitType;
  isRefinable?: boolean;
  refinesToMaterialKey?: string | null;
  aliases?: Record<string, string[]> | string[];
};

export type CanonicalMaterialIdentity = {
  materialKey: string;
  displayName: string;
  unitType?: MaterialIdentityUnitType;
};

type MaterialIdentityOverride = {
  materialKey: string;
  displayName: string;
  aliases: readonly string[];
};

// Exceptions not currently expressed as aliases in the generated identity index.
// Keep this table limited to confirmed product IDs, spelling repairs, and legacy IDs.
export const MATERIAL_IDENTITY_OVERRIDES: readonly MaterialIdentityOverride[] = [
  { materialKey: "aluminum", displayName: "Aluminum", aliases: ["aluminium"] },
  { materialKey: "rawice", displayName: "Raw Ice", aliases: ["ice"] },
  { materialKey: "carinite-pure", displayName: "Carinite Pure", aliases: ["carinitepure", "purecarinite"] },
  { materialKey: "jaclium", displayName: "Jaclium", aliases: ["jacliumore"] },
  { materialKey: "saldynium", displayName: "Saldynium", aliases: ["saldyniumore"] },
  { materialKey: "quantanium", displayName: "Quantanium", aliases: ["quantainium"] },
  {
    materialKey: "savrilium",
    displayName: "Savrilium",
    aliases: [
      "savrillium",
      "savrilum",
      "6426f04e-2f7d-4c8e-a615-64aa582eaa31",
    ],
  },
  {
    materialKey: "hephaestanite",
    displayName: "Hephaestanite",
    aliases: ["hephaestonite", "hephaestonice"],
  },
] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeMaterialIdentityToken(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^entityclassdefinition\./, "")
    .replace(/[^a-z0-9]/g, "");
}

export function isMaterialIdentityGuid(value: string | null | undefined): boolean {
  return UUID_PATTERN.test(value ?? "");
}

function aliasValues(identity: MaterialIdentityRecord): string[] {
  const aliases = identity.aliases;
  if (!aliases) return [];
  return Array.isArray(aliases) ? aliases : Object.values(aliases).flat();
}

export type MaterialIdentityResolver = ReturnType<typeof createMaterialIdentityResolver>;

export function createMaterialIdentityResolver(identities: readonly MaterialIdentityRecord[]) {
  const overrideByAlias = new Map<string, MaterialIdentityOverride>();
  for (const override of MATERIAL_IDENTITY_OVERRIDES) {
    overrideByAlias.set(normalizeMaterialIdentityToken(override.materialKey), override);
    for (const alias of override.aliases) {
      overrideByAlias.set(normalizeMaterialIdentityToken(alias), override);
    }
  }

  const rawSourceByRefinedOutput = new Map<string, string>();
  for (const identity of identities) {
    if (identity.isRefinable && identity.refinesToMaterialKey) {
      rawSourceByRefinedOutput.set(
        normalizeMaterialIdentityToken(identity.refinesToMaterialKey),
        identity.materialKey,
      );
    }
  }

  const canonicalKeyFor = (value: string): string => {
    const relationshipKey = rawSourceByRefinedOutput.get(normalizeMaterialIdentityToken(value)) ?? value;
    return overrideByAlias.get(normalizeMaterialIdentityToken(relationshipKey))?.materialKey ?? relationshipKey;
  };

  const aliasToMaterialKey = new Map<string, string>();
  const aliasesByMaterialKey = new Map<string, Set<string>>();
  const identityByMaterialKey = new Map<string, CanonicalMaterialIdentity>();
  const identityPriorityByMaterialKey = new Map<string, number>();

  const addAlias = (alias: string | null | undefined, materialKey: string, overwrite = false) => {
    const token = normalizeMaterialIdentityToken(alias);
    if (!token) return;
    if (overwrite || !aliasToMaterialKey.has(token)) aliasToMaterialKey.set(token, materialKey);
    const aliases = aliasesByMaterialKey.get(materialKey) ?? new Set<string>();
    aliases.add(token);
    aliasesByMaterialKey.set(materialKey, aliases);
  };

  for (const identity of identities) {
    if (!identity.materialKey) continue;
    const materialKey = canonicalKeyFor(identity.materialKey);
    const isDirectCanonicalRecord = normalizeMaterialIdentityToken(identity.materialKey) === normalizeMaterialIdentityToken(materialKey);
    const priority = isDirectCanonicalRecord ? 2 : 1;
    if (priority > (identityPriorityByMaterialKey.get(materialKey) ?? 0)) {
      identityByMaterialKey.set(materialKey, {
        materialKey,
        displayName: identity.canonicalName ?? identity.displayName ?? identity.rawName ?? materialKey,
        unitType: identity.unitType,
      });
      identityPriorityByMaterialKey.set(materialKey, priority);
    }

    for (const alias of [
      identity.materialKey,
      identity.canonicalName,
      identity.displayName,
      identity.rawName,
      identity.refinedName,
      identity.commodityName,
      ...aliasValues(identity),
    ]) {
      addAlias(alias, materialKey);
    }
  }

  for (const override of MATERIAL_IDENTITY_OVERRIDES) {
    identityByMaterialKey.set(override.materialKey, {
      materialKey: override.materialKey,
      displayName: override.displayName,
      unitType: identityByMaterialKey.get(override.materialKey)?.unitType,
    });
    addAlias(override.materialKey, override.materialKey, true);
    for (const alias of override.aliases) addAlias(alias, override.materialKey, true);
  }

  const resolve = (value: string | null | undefined): CanonicalMaterialIdentity | null => {
    const materialKey = aliasToMaterialKey.get(normalizeMaterialIdentityToken(value));
    if (!materialKey) return null;
    return identityByMaterialKey.get(materialKey) ?? {
      materialKey,
      displayName: materialKey,
    };
  };

  return {
    resolve,
    canonicalKey(value: string | null | undefined): string {
      return resolve(value)?.materialKey ?? normalizeMaterialIdentityToken(value);
    },
    canonicalDisplayName(value: string | null | undefined): string {
      return resolve(value)?.displayName ?? (value ?? "").trim();
    },
    aliasesFor(materialKey: string): string[] {
      const canonicalKey = resolve(materialKey)?.materialKey ?? materialKey;
      return [...(aliasesByMaterialKey.get(canonicalKey) ?? [])];
    },
    isKnown(value: string | null | undefined): boolean {
      return Boolean(resolve(value));
    },
  };
}

export const DEFAULT_MATERIAL_IDENTITY_RESOLVER = createMaterialIdentityResolver([]);
