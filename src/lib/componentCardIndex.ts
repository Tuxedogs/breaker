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

export type ComponentCardIndexFamilyStats = Record<string, unknown>;

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
  variantLabel?: string | null;
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
    cooler: ComponentCardIndexFamilyStats | null;
    powerPlant: ComponentCardIndexFamilyStats | null;
    quantumDrive: ComponentCardIndexFamilyStats | null;
    shield: ComponentCardIndexShieldStats | null;
    shipWeapon: ComponentCardIndexFamilyStats | null;
    radar: ComponentCardIndexFamilyStats | null;
    tractorBeam: ComponentCardIndexFamilyStats | null;
    miningLaser?: ComponentCardIndexFamilyStats | null;
    weaponMining?: ComponentCardIndexFamilyStats | null;
    fpsWeapon: ComponentCardIndexFamilyStats | null;
    fpsArmor: ComponentCardIndexFamilyStats | null;
    fpsAmmo: ComponentCardIndexFamilyStats | null;
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
