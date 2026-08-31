import { apiUrl } from "../../lib/apiUrl";
import { parseJsonResponse } from "../../lib/safeJson";

export type GeneratedLagrangeGroup = {
  label: string;
  letter: string;
  locations: string[];
};

type GeneratedLagrangeGroups = {
  groups: GeneratedLagrangeGroup[];
};

export type ResolvedStantonLagrangeChild = {
  code: string;
  groupLetter: string;
};

export type ResolvedStantonLagrangeChildren = {
  label: string;
  matchedLocationCodes: string[];
  children: ResolvedStantonLagrangeChild[];
};

const LAGRANGE_GROUPS_URL = "/api/mining/lagrange-groups";

let generatedGroups: GeneratedLagrangeGroups | null = null;
let loadPromise: Promise<void> | null = null;

function normalizeComparableLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function normalizeLocationCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function uniqueSortedCodes(codes: string[]): string[] {
  return [...new Set(codes.map(normalizeLocationCode).filter(isStantonLocationCode))];
}

function isStantonLocationCode(value: string): boolean {
  return /^(?:ARC|CRU|HUR|MIC)-L[1-5]$/i.test(value);
}

function extractStantonLocationCodes(value: string): string[] {
  const matches = value.match(/\b(?:ARC|CRU|HUR|MIC)-L[1-5]\b/gi) ?? [];
  return uniqueSortedCodes(matches);
}

function locationCodesForRecommenderLabel(label: string): string[] {
  const directCodes = extractStantonLocationCodes(label);
  if (directCodes.length > 0) return directCodes;

  const normalizedLabel = normalizeComparableLabel(label);
  const group = generatedGroups?.groups.find((candidate) =>
    normalizeComparableLabel(candidate.label) === normalizedLabel ||
    normalizeComparableLabel(`Lagrange ${candidate.letter}`) === normalizedLabel
  );

  return group ? uniqueSortedCodes(group.locations) : [];
}

function groupForLocationCode(code: string): GeneratedLagrangeGroup | null {
  const normalizedCode = normalizeLocationCode(code);
  return generatedGroups?.groups.find((group) =>
    group.locations.some((location) => normalizeLocationCode(location) === normalizedCode)
  ) ?? null;
}

export function getStantonLagrangeGroupForLocationCode(code: string): GeneratedLagrangeGroup | null {
  const group = groupForLocationCode(code);
  if (!group) return null;

  return {
    ...group,
    locations: uniqueSortedCodes(group.locations),
  };
}

export function configureStantonLagrangeGroupData(groups: GeneratedLagrangeGroups): void {
  generatedGroups = groups;
}

export async function loadStantonLagrangeGroupData(fetcher: typeof fetch = fetch): Promise<void> {
  if (generatedGroups) return;
  const groupsUrl = apiUrl(LAGRANGE_GROUPS_URL);
  loadPromise ??= fetcher(groupsUrl)
    .then(async (response) => {
      const data = await parseJsonResponse<GeneratedLagrangeGroups>(response, {
        label: "lagrange groups",
        url: groupsUrl,
      });
      if (!response.ok) throw new Error(`Failed to load ${LAGRANGE_GROUPS_URL}: ${response.status}`);
      return data;
    })
    .then(configureStantonLagrangeGroupData)
    .finally(() => {
      loadPromise = null;
    });
  return loadPromise;
}

export function resolveRecommenderStantonLagrangeChildren(
  recommenderLabel: string,
  matchedLocationCodes: string[] = [],
): ResolvedStantonLagrangeChildren {
  const matchedCodes = uniqueSortedCodes(matchedLocationCodes);
  const codes = matchedCodes.length > 0
    ? matchedCodes
    : locationCodesForRecommenderLabel(recommenderLabel);

  return {
    label: recommenderLabel,
    matchedLocationCodes: codes,
    children: codes.map((code) => ({
      code,
      groupLetter: groupForLocationCode(code)?.letter ?? "",
    })),
  };
}
