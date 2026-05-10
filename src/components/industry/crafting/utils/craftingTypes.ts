// ── Raw data shapes (match JSON files exactly) ─────────────────────

export interface ComponentMaterial {
  slot: string;
  cost_type: string;
  material_name: string;
  cost_id: string;
  quantity: number;
  qualityModifiers?: QualityModifier[];
}

export type CraftingItemKind = "vehicle" | "fps";

export interface ComponentRecipe {
  blueprint_id: string;
  component_type: string;
  component_name: string;
  size: string;
  craft_time_seconds: number;
  output_entityClass: string;
  baseStats?: Record<string, unknown>;
  materials: ComponentMaterial[];
  item_kind?: CraftingItemKind;
  internal_name?: string | null;
  fallback_name?: string | null;
  wiki_resolved?: boolean;
  wiki_url?: string | null;
  category?: string | null;
  grade?: string | null;
  class?: string | null;
  manufacturer?: string | null;
  source_file?: string | null;
  raw_name?: string | null;
  name_source?: string | null;
  wiki_uuid?: string | null;
  wiki_class_name?: string | null;
  wiki_type?: string | null;
  wiki_version?: string | null;
  qualityModifiers?: QualityModifier[];
  overallQualityModifiers?: QualityModifier[];
  rewardPools?: unknown[];
}

export interface QualityModifier {
  component_type: string;
  component_name: string;
  size: string;
  slot: string;
  gameplay_property: string;
  start_quality: number;
  end_quality: number;
  modifier_start: number;
  modifier_end: number;
  modifier_start_percent: number;
  modifier_end_percent: number;
  modifier_mode?: string;
  gameplay_property_id: string;
  blueprint_id: string;
}

export interface MaterialLookup {
  id: string;
  name: string;
}

export interface BlueprintReward {
  reward_group: string;
  reward_source: string;
  blueprint_name: string;
  category: string;
  weight: number;
}

// ── App state shapes ───────────────────────────────────────────────

export interface BuildQueueItem {
  blueprint_id: string;
  component_name: string;
  component_type: string;
  size: string;
  quantity: number;
  item_kind?: CraftingItemKind;
  materials?: ComponentMaterial[];
}

export type MaterialInventory = Record<string, number>;

// ── Computed shapes ────────────────────────────────────────────────

export interface AggregatedMaterial {
  cost_id: string;
  material_name: string;
  needed: number;
  owned: number;
  missing: number;
}

export interface MaterialDemandEntry {
  material_name: string;
  cost_id: string;
  total_quantity: number;
  recipe_count: number;
  component_types: string[];
}
