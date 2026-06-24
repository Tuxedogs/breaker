import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";

export function getComponentCardVariantGroupKey(record: ComponentCardIndexRecord): string | null {
  if (record.kind !== "fps") return null;

  const name = typeof record.name === "string" ? record.name : "";
  const baseName = name.replace(/\s*"[^"]+"\s*/g, " ").replace(/\s+/g, " ").trim();
  if (!baseName) return null;
  return `${baseName.toLowerCase()}::${record.type ?? ""}::${record.kind}`;
}

export function pickComponentCardGroupRepresentative(
  group: ComponentCardIndexRecord[],
): ComponentCardIndexRecord {
  if (group.length === 1) return group[0];

  const base = group.find((record) => !/"\w/.test(record.name));
  return base ?? group.slice().sort((a, b) => a.name.localeCompare(b.name))[0];
}
