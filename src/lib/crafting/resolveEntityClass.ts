import type { ComponentRecipe } from "../../components/industry/crafting/utils/craftingTypes";
import type { ComponentCardIndexRecord } from "../componentCardIndex";

export type EntityClassResolutionSource = "recipe" | "card_bridge" | "unresolved";

export type EntityClassResolution = {
  entityClass: string | null;
  source: EntityClassResolutionSource;
  confidence: "high" | "medium" | "low";
  reason?: string;
};

function normalizeGuid(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function isValidGuid(value: string | null): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export type ResolveEntityClassInput = {
  recipe?: Pick<ComponentRecipe, "blueprint_id" | "output_entityClass"> | null;
  cardBridge?: Pick<ComponentCardIndexRecord, "id" | "entityClass"> | null;
};

export function resolveEntityClassForCraftingItem(input: ResolveEntityClassInput): EntityClassResolution {
  const recipeEntityClass = normalizeGuid(input.recipe?.output_entityClass);
  if (isValidGuid(recipeEntityClass)) {
    return {
      entityClass: recipeEntityClass,
      source: "recipe",
      confidence: "high",
    };
  }

  const blueprintId = normalizeGuid(input.recipe?.blueprint_id);
  const cardId = normalizeGuid(input.cardBridge?.id);
  const cardEntityClass = normalizeGuid(input.cardBridge?.entityClass);

  if (blueprintId && cardId && blueprintId !== cardId) {
    return {
      entityClass: null,
      source: "unresolved",
      confidence: "low",
      reason: "Card bridge blueprint_id does not match recipe blueprint_id.",
    };
  }

  if (isValidGuid(cardEntityClass)) {
    return {
      entityClass: cardEntityClass,
      source: "card_bridge",
      confidence: blueprintId && cardId && blueprintId === cardId ? "medium" : "low",
      reason: recipeEntityClass
        ? "Recipe output_entityClass was missing; used card entityClass bridge."
        : undefined,
    };
  }

  return {
    entityClass: null,
    source: "unresolved",
    confidence: "low",
    reason: "No output_entityClass on recipe and no card entityClass bridge available.",
  };
}
