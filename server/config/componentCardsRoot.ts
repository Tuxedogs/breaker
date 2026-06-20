import path from "node:path";

export function getComponentCardsRoot(): string {
  if (process.env.COMPONENT_CARDS_ROOT) {
    return path.resolve(process.env.COMPONENT_CARDS_ROOT);
  }
  return path.resolve(process.cwd(), "server-data", "crafting", "component-cards");
}