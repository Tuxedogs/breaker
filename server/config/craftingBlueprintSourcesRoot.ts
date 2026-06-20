import path from "node:path";

export const craftingBlueprintSourcesMissionSourceRoot = path.resolve(
  process.cwd(),
  "server-data",
  "missions",
  "source",
);

export function getCraftingBlueprintSourcesRoot(): string {
  if (process.env.CRAFTING_BLUEPRINT_SOURCES_ROOT) {
    return path.resolve(process.env.CRAFTING_BLUEPRINT_SOURCES_ROOT);
  }
  return path.resolve(process.cwd(), "server-data", "crafting", "blueprint-sources");
}