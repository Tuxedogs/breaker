import { apiUrl } from "../../lib/apiUrl";
import { parseJsonResponse } from "../../lib/safeJson";

export type StantonLagrangeChildRecord = {
  id: string;
  guid?: string;
  recordName: string;
  system: string;
  body: string;
  lagrange: string;
  pointKey: string;
  childKey: string | null;
  childIndex: string | null;
  isEntrance: boolean;
  path: string;
};

type GeneratedLagrangeGroup = {
  label: string;
  letter: string;
  locations: string[];
};

type GeneratedLagrangeGroups = {
  groups: GeneratedLagrangeGroup[];
};

type GeneratedLagrangePoint = {
  system: string;
  body: string;
  lagrange: string;
  pointKey: string;
  children: StantonLagrangeChildRecord[];
};

type GeneratedLagrangeChildren = {
  points: GeneratedLagrangePoint[];
};

export type ResolvedStantonLagrangePointChildren = {
  code: string;
  groupLetter: string;
  displayName: string;
  pointKey: string;
  bodyName: string;
  lagrange: string;
  children: StantonLagrangeChildRecord[];
};

export type ResolvedStantonLagrangeChildren = {
  label: string;
  matchedLocationCodes: string[];
  points: ResolvedStantonLagrangePointChildren[];
};

const LAGRANGE_GROUPS_URL = "/api/lagrange-groups.generated.json";
const LAGRANGE_CHILDREN_URL = "/api/lagrange-children.generated.json";

const BODY_BY_PREFIX: Record<string, { bodyName: string; stantonBody: string }> = {
  HUR: { bodyName: "Hurston", stantonBody: "Stanton1" },
  CRU: { bodyName: "Crusader", stantonBody: "Stanton2" },
  ARC: { bodyName: "ArcCorp", stantonBody: "Stanton3" },
  MIC: { bodyName: "microTech", stantonBody: "Stanton4" },
};

let generatedGroups: GeneratedLagrangeGroups | null = null;
let generatedChildren: GeneratedLagrangeChildren | null = null;
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

function pointKeyForCode(code: string): string | null {
  const match = normalizeLocationCode(code).match(/^(ARC|CRU|HUR|MIC)-(L[1-5])$/);
  if (!match) return null;
  const body = BODY_BY_PREFIX[match[1]];
  return body ? `${body.stantonBody}_${match[2]}` : null;
}

function bodyNameForCode(code: string): string {
  const prefix = normalizeLocationCode(code).split("-")[0];
  return BODY_BY_PREFIX[prefix]?.bodyName ?? prefix;
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

export function configureStantonLagrangeChildrenData(
  groups: GeneratedLagrangeGroups,
  children: GeneratedLagrangeChildren,
): void {
  generatedGroups = groups;
  generatedChildren = children;
}

export async function loadStantonLagrangeChildrenData(fetcher: typeof fetch = fetch): Promise<void> {
  if (generatedGroups && generatedChildren) return;
  const groupsUrl = apiUrl(LAGRANGE_GROUPS_URL);
  const childrenUrl = apiUrl(LAGRANGE_CHILDREN_URL);
  loadPromise ??= Promise.all([
    fetcher(groupsUrl).then(async (response) => {
      const data = await parseJsonResponse<GeneratedLagrangeGroups>(response, {
        label: "lagrange groups",
        url: groupsUrl,
      });
      if (!response.ok) throw new Error(`Failed to load ${LAGRANGE_GROUPS_URL}: ${response.status}`);
      return data;
    }),
    fetcher(childrenUrl).then(async (response) => {
      const data = await parseJsonResponse<GeneratedLagrangeChildren>(response, {
        label: "lagrange children",
        url: childrenUrl,
      });
      if (!response.ok) throw new Error(`Failed to load ${LAGRANGE_CHILDREN_URL}: ${response.status}`);
      return data;
    }),
  ]).then(([groups, children]) => {
    configureStantonLagrangeChildrenData(groups, children);
  }).finally(() => {
    loadPromise = null;
  });
  return loadPromise;
}

export function getStantonPointChildrenByCode(code: string): ResolvedStantonLagrangePointChildren | null {
  const normalizedCode = normalizeLocationCode(code);
  const pointKey = pointKeyForCode(normalizedCode);
  if (!pointKey) return null;

  const point = generatedChildren?.points.find((candidate) =>
    candidate.system.toLowerCase() === "stanton" &&
    candidate.pointKey === pointKey
  );
  if (!point || point.children.length === 0) return null;

  return {
    code: normalizedCode,
    groupLetter: groupForLocationCode(normalizedCode)?.letter ?? "",
    displayName: normalizedCode,
    pointKey,
    bodyName: bodyNameForCode(normalizedCode),
    lagrange: point.lagrange,
    children: point.children,
  };
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
    points: codes.flatMap((code) => {
      const point = getStantonPointChildrenByCode(code);
      if (!point) return [];
      const group = groupForLocationCode(code);
      return [{
        ...point,
        groupLetter: group?.letter ?? point.groupLetter,
        displayName: group ? `Lagrange ${group.letter} ${point.code}` : point.code,
      }];
    }),
  };
}
