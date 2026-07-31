import type { MissionConceptView } from "@/lib/missionData";

export const MISSION_BROWSER_PATH = "/industry/missions";

export function missionNameSlug(displayName: string): string {
  const slug = displayName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "mission";
}

export function missionConceptSlug(concept: Pick<MissionConceptView, "conceptKey" | "displayName">): string {
  return `${missionNameSlug(concept.displayName)}--${concept.conceptKey}`;
}

export function missionConceptPath(concept: Pick<MissionConceptView, "conceptKey" | "displayName">): string {
  return `${MISSION_BROWSER_PATH}/${missionConceptSlug(concept)}`;
}

export function missionConceptKeyFromSlug(slug: string | undefined): string {
  if (!slug) return "";
  const separator = slug.lastIndexOf("--");
  return separator < 0 ? "" : slug.slice(separator + 2).trim().toLowerCase();
}
