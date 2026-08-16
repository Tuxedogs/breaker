import type { MissionConceptView, MissionOfferView } from "./missionData";

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

export function missionOfferUrl(
  offer: Pick<MissionOfferView, "offerKey">,
  variantKey?: string,
): string {
  const params = new URLSearchParams({ offer: offer.offerKey });
  if (variantKey) params.set("variant", variantKey);
  return `${MISSION_BROWSER_PATH}?${params.toString()}`;
}

export type LegacyMissionConceptResolution =
  | { kind: "offer"; offerKey: string }
  | { kind: "series"; conceptKey: string; offerKeys: string[] }
  | { kind: "unavailable"; conceptKey: string };

export function resolveLegacyMissionConcept(
  conceptKey: string,
  legacyConceptOfferKeys: Readonly<Record<string, string[]>>,
): LegacyMissionConceptResolution {
  const offerKeys = Array.from(new Set(legacyConceptOfferKeys[conceptKey] ?? []));
  if (offerKeys.length === 1) return { kind: "offer", offerKey: offerKeys[0]! };
  if (offerKeys.length > 1) return { kind: "series", conceptKey, offerKeys };
  return { kind: "unavailable", conceptKey };
}
