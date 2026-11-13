const GRADES = new Set(["A", "B", "C", "D"]);
const CLASSES = new Set(["military", "civilian", "stealth", "industrial", "competition"]);

/** Tone class for a component grade (A–D); empty for unknown grades. */
export function gradeToneClass(grade: string | null | undefined): string {
  const value = grade?.trim().toUpperCase() ?? "";
  return GRADES.has(value) ? `craft-grade--${value.toLowerCase()}` : "";
}

/** Tone class for a component class (Military, Civilian, ...); empty for unknown classes. */
export function classToneClass(componentClass: string | null | undefined): string {
  const value = componentClass?.trim().toLowerCase() ?? "";
  return CLASSES.has(value) ? `craft-class--${value}` : "";
}
