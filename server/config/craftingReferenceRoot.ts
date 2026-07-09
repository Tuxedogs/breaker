import path from "node:path";

export function getCraftingReferenceRoot(): string {
  if (process.env.CRAFTING_REFERENCE_ROOT) {
    return path.resolve(process.env.CRAFTING_REFERENCE_ROOT);
  }
  return path.resolve(process.cwd(), "server-data", "crafting", "reference");
}
