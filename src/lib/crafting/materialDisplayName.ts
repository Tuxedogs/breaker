const CANONICAL_HAND_MINABLE_NAMES = new Map([
  ["aphorite", "Aphorite"],
  ["carinitepure", "Carinite Pure"],
  ["dolivine", "Dolivine"],
  ["hadanite", "Hadanite"],
  ["jaclium", "Jaclium"],
  ["janalite", "Janalite"],
  ["sadaryx", "Sadaryx"],
  ["saldynium", "Saldynium"],
]);

function normalizeMaterialKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Canonical display casing for source material names with known lowercase aliases. */
export function formatMaterialDisplayName(value: string | null | undefined): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const canonical = CANONICAL_HAND_MINABLE_NAMES.get(normalizeMaterialKey(trimmed));
  if (canonical) return canonical;
  if (trimmed === trimmed.toLowerCase()) {
    return trimmed.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }
  return trimmed;
}
