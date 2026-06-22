const COMPONENT_CARD_INDEX_URL = "/api/crafting/component_card_index.json";
const RESPONSE_PREVIEW_LENGTH = 200;

export type ComponentCardIndexMetric = {
  label: string;
  value: string;
  field?: string;
  confidence?: "safe" | "caution";
};

export type ComponentCardIndexShieldRange = {
  min: number;
  max: number;
};

export type ComponentCardIndexShieldStats = {
  maxShieldHealth: number | null;
  regenRate: number | null;
  regenTime: number | null;
  damageRegenDelay: number | null;
  downedRegenDelay: number | null;
  reservePoolRegenRate: number | null;
  reservePoolRegenTime: number | null;
  physicalAbsorption: ComponentCardIndexShieldRange | null;
  physicalResistance: ComponentCardIndexShieldRange | null;
  distortionResistance: ComponentCardIndexShieldRange | null;
  powerUsageMin: number | null;
  powerUsageMax: number | null;
  coolantUsageMin: number | null;
  coolantUsageMax: number | null;
};

export type ComponentCardIndexMaterial = {
  slot: string | null;
  name: string;
  quantity: number;
  unit: string | null;
  materialId: string | null;
  costId: string | null;
  materialKey: string | null;
  minQuality: number | null;
};

export type ComponentCardIndexRecord = {
  id: string;
  name: string;
  kind: "vehicle" | "fps";
  category: string;
  type: string;
  typeLabel: string;
  size: number | null;
  grade: string | null;
  class: string | null;
  manufacturerGuid?: string | null;
  manufacturer?: string | null;
  family?: string | null;
  familyKey?: string | null;
  variants?: string[];
  variantName?: string | null;
  entityClass?: string | null;
  craftTimeSeconds: number;
  materials?: ComponentCardIndexMaterial[];
  description?: string | null;
  descriptionSourceKey?: string | null;
  searchText: string;
  searchTokens?: string[];
  facets: {
    kind?: "vehicle" | "fps";
    category?: string;
    type?: string;
    size?: string | null;
    grade?: string | null;
    class?: string | null;
    materials: string[];
    materialNames: string[];
    weaponClass?: string | null;
    armorSlot?: string | null;
    armorWeight?: string | null;
    ammoClass?: string | null;
    sourcePools?: string[];
  };
  sort: {
    name: string;
    type: string;
    craftTimeSeconds?: number;
    size?: number | null;
    gradeRank?: number | null;
    materialCount?: number;
    sourceCount?: number;
    coolantGeneration?: number;
    powerDraw?: number;
  };
  card: {
    primary?: ComponentCardIndexMetric[];
    secondary?: ComponentCardIndexMetric[];
    materialsPreview: Array<Pick<ComponentCardIndexMaterial, "name" | "quantity" | "unit">>;
    badges: string[];
    modifierLabels: string[];
  };
  stats: {
    generic: {
      mass: number | null;
      health: number | null;
      emSignature: number | null;
      irSignature: number | null;
      distortionMaximum: number | null;
    };
    cooler: { coolantGeneration: number | null; powerDraw: number | null } | null;
    powerPlant: null;
    quantumDrive: null;
    shield: ComponentCardIndexShieldStats | null;
    shipWeapon: null;
    radar: null;
    tractorBeam: null;
    fpsWeapon: { weaponClass: string | null; family: string | null; variantName: string | null; variantCount: number } | null;
    fpsArmor: { armorSlot: string | null; armorWeight: string | null; family: string | null; variantName: string | null; variantCount: number } | null;
    fpsAmmo: { ammoClass: string | null; family: string | null; variantName: string | null; variantCount: number } | null;
  };
  source: {
    files: string[];
    fields: string[];
    warnings: string[];
  };
};

export type ComponentCardIndex = {
  schemaVersion: number;
  generatedAt: string;
  sourceRecordCount: {
    vehicle: number;
    fps: number;
    total: number;
  };
  records: ComponentCardIndexRecord[];
  facets: {
    types: Array<{ value: string; label: string }>;
    materials: Array<{ value: string; label: string }>;
    grades: string[];
    classes: string[];
    weaponClasses: string[];
    armorSlots: string[];
    armorWeights: string[];
    ammoClasses: string[];
  };
};

let componentCardIndexPromise: Promise<ComponentCardIndex> | null = null;

function getResponseTextPreview(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, RESPONSE_PREVIEW_LENGTH);
}

function logComponentCardIndexLoadFailure(details: {
  requestedUrl: string;
  status?: number;
  responseTextPreview?: string;
  recordsArrayExists?: boolean;
  recordCount?: number;
  error?: unknown;
}): void {
  console.error("Component card index load failed", {
    requestedUrl: details.requestedUrl,
    status: details.status,
    responseTextPreview: details.responseTextPreview,
    recordsArrayExists: details.recordsArrayExists,
    recordCount: details.recordCount,
    error: details.error,
  });
}

export async function getComponentCardIndexFromMonolith(): Promise<ComponentCardIndex> {
  componentCardIndexPromise ??= fetch(COMPONENT_CARD_INDEX_URL).then(async (response) => {
    const requestedUrl = COMPONENT_CARD_INDEX_URL;
    const text = await response.text();
    const responseTextPreview = getResponseTextPreview(text);

    if (!response.ok) {
      logComponentCardIndexLoadFailure({
        requestedUrl,
        status: response.status,
        responseTextPreview,
        recordsArrayExists: false,
      });
      throw new Error(`Failed to load component card index: ${response.status}`);
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (error) {
      logComponentCardIndexLoadFailure({
        requestedUrl,
        status: response.status,
        responseTextPreview,
        recordsArrayExists: false,
        error,
      });
      throw new Error("Component card index returned invalid JSON");
    }

    const records = data && typeof data === "object" ? (data as Partial<ComponentCardIndex>).records : undefined;
    const recordsArrayExists = Array.isArray(records);
    const recordCount = recordsArrayExists ? records.length : undefined;

    if (!recordsArrayExists) {
      logComponentCardIndexLoadFailure({
        requestedUrl,
        status: response.status,
        recordsArrayExists,
        recordCount,
      });
      throw new Error("Component card index payload is invalid");
    }

    return data as ComponentCardIndex;
  });
  return componentCardIndexPromise;
}

export function clearComponentCardIndexMonolithCache(): void {
  componentCardIndexPromise = null;
}
