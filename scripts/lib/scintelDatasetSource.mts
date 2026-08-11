import path from "node:path";

export function getScintelDatasetRoot(): string {
  const configuredRoot = process.env.SCINTEL_DATASET_ROOT?.trim();
  if (!configuredRoot) {
    throw new Error(
      "SCINTEL_DATASET_ROOT is required. Point it at an accepted Scintel out/<CHANNEL>/<BUILD_ID>/datasets directory.",
    );
  }
  return path.resolve(configuredRoot);
}

export function getScintelCraftingSourcePath(...segments: string[]): string {
  return path.join(getScintelDatasetRoot(), "crafting", ...segments);
}

export function getScintelComponentCardSourcePath(): string {
  const configuredPath = process.env.SCINTEL_COMPONENT_CARD_SOURCE?.trim();
  return configuredPath
    ? path.resolve(configuredPath)
    : getScintelCraftingSourcePath("component_card_index.json");
}
