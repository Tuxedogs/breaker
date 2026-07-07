import type { ComponentRecipe } from "../../components/industry/crafting/utils/craftingTypes";
import type { ComponentCardIndexRecord } from "../componentCardIndex";
import type { FittingComponentDetail } from "../fitting/fittingApi";
import { getComponentDisplayName } from "../../components/industry/crafting/utils/componentDisplayNames";

const GENERIC_BLUEPRINT_LABEL = /^(?:s\d+|small|medium|large|military \d+|utility \d+)$/i;

export function isGenericBlueprintLabel(name: string | null | undefined): boolean {
  const trimmed = name?.trim();
  if (!trimmed) return true;
  return GENERIC_BLUEPRINT_LABEL.test(trimmed);
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

/** Source-backed variant label from Foundry blueprint or entity file names. */
export function variantLabelFromFoundryToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/\\/g, "/").split("/").pop()?.replace(/\.xml$/i, "") ?? value;

  const salvation = normalized.match(/(?:^|_)scraper[_-]salvation[_-](small|medium|large)(?:$|[_-])/i)
    ?? normalized.match(/Scraper_Salvation_(Small|Medium|Large)/i);
  if (salvation) return `Salvation ${titleCase(salvation[1])}`;

  const scraper = normalized.match(/(?:^|_)scraper[_-](small|medium|large)(?:$|[_-])/i)
    ?? normalized.match(/Scraper_(Small|Medium|Large)/i);
  if (scraper) return titleCase(scraper[1]);

  const mining = normalized.match(/[_-]s(\d+|v)(?:$|[_-])/i);
  if (mining) return mining[1].toUpperCase() === "V" ? "SV" : `S${mining[1]}`;

  return null;
}

export function variantLabelFromBlueprintFields(input: {
  blueprintName?: string | null;
  entityClassPath?: string | null;
  displayName?: string | null;
}): string | null {
  const blueprintName = input.blueprintName?.trim();
  if (blueprintName) {
    const fromBlueprint = variantLabelFromFoundryToken(blueprintName.replace(/^BP_CRAFT_/i, ""));
    if (fromBlueprint) return fromBlueprint;
  }

  const fromPath = variantLabelFromFoundryToken(input.entityClassPath);
  if (fromPath) return fromPath;

  const displayName = input.displayName?.trim();
  if (displayName && isGenericBlueprintLabel(displayName)) return titleCase(displayName);

  return null;
}

export type ResolveCraftingDisplayNameInput = {
  fittingDetail?: Pick<FittingComponentDetail, "displayName" | "name"> | null;
  recipe?: Pick<ComponentRecipe, "component_name" | "item_kind" | "internal_name" | "source_file"> | null;
  card?: Pick<ComponentCardIndexRecord, "name" | "variantLabel" | "variantName"> | null;
};

function normalizeName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function recipeFallbackName(recipe: ResolveCraftingDisplayNameInput["recipe"]): string | null {
  if (!recipe) return null;
  const raw = normalizeName(recipe.component_name);
  if (!raw) return null;
  return recipe.item_kind === "fps" ? getComponentDisplayName(raw) : raw;
}

/** Prefer fitting/localized identity over generic blueprint labels. */
export function resolveCraftingDisplayName(input: ResolveCraftingDisplayNameInput): string {
  const fittingName = normalizeName(input.fittingDetail?.displayName);
  if (fittingName) return fittingName;

  const cardName = normalizeName(input.card?.name);
  if (cardName && !isGenericBlueprintLabel(cardName)) return cardName;

  const recipeName = recipeFallbackName(input.recipe);
  if (recipeName && !isGenericBlueprintLabel(recipeName)) return recipeName;

  return cardName ?? recipeName ?? "Unknown Component";
}

export function resolveCraftingVariantLabel(input: ResolveCraftingDisplayNameInput): string | null {
  const cardVariant = normalizeName(input.card?.variantLabel) ?? normalizeName(input.card?.variantName);
  if (cardVariant) return cardVariant;

  const fromFittingInternal = variantLabelFromFoundryToken(input.fittingDetail?.name);
  if (fromFittingInternal) return fromFittingInternal;

  const fromRecipeInternal = variantLabelFromFoundryToken(input.recipe?.internal_name)
    ?? variantLabelFromFoundryToken(input.recipe?.source_file);
  if (fromRecipeInternal) return fromRecipeInternal;

  const recipeName = recipeFallbackName(input.recipe);
  if (recipeName && isGenericBlueprintLabel(recipeName)) return titleCase(recipeName);

  return null;
}

export function formatCraftingDisplayTitle(primaryName: string, variantLabel: string | null | undefined): string {
  const primary = primaryName.trim();
  const variant = variantLabel?.trim();
  if (!variant) return primary;
  if (primary.toLowerCase().includes(variant.toLowerCase())) return primary;
  return `${primary} · ${variant}`;
}

export function resolveCraftingCardTitle(input: ResolveCraftingDisplayNameInput): string {
  const primaryName = resolveCraftingDisplayName(input);
  const variantLabel = resolveCraftingVariantLabel(input);
  return formatCraftingDisplayTitle(primaryName, variantLabel);
}
