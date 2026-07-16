export type ComponentCatalogGenerationPart = {
  generatedAt?: string | null;
};

export function validateComponentCatalogGeneration(
  expectedGeneration: string | null | undefined,
  ...parts: ComponentCatalogGenerationPart[]
): void {
  if (!expectedGeneration) return;
  for (const part of parts) {
    if (part.generatedAt && part.generatedAt !== expectedGeneration) {
      throw new Error(
        `Component catalog generation mismatch: expected ${expectedGeneration}, got ${part.generatedAt}`,
      );
    }
  }
}
