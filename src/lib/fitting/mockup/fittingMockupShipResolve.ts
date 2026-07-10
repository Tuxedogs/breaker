import type { FittingShipSummary } from "../fittingPortGrouping";

/** Canonical Polaris GUID for mockup validation at 1920×1080. */
export const FITTING_MOCKUP_POLARIS_SHIP_KEY = "a5a5b055-c5d7-4384-9951-f15d47b88789";

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MANUFACTURER_PREFIX_TO_CODE: Record<string, string> = {
  rsi: "rsi",
  roberts: "rsi",
  aegis: "aegs",
  anvil: "anvl",
  crusader: "crus",
  drake: "drak",
  origin: "orig",
  misc: "misc",
  banu: "banu",
  xi: "xi",
  esperia: "espr",
  vanduul: "vand",
  kruger: "krig",
  tumbril: "tmbl",
  greycat: "grin",
  gatac: "gatac",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isFittingShipGuid(value: string): boolean {
  return GUID_RE.test(value);
}

/** Resolve ?ship= query: GUID, slug (e.g. polaris), or default Polaris. */
export function resolveMockupShipKey(
  queryParam: string | null,
  ships: Pick<FittingShipSummary, "shipKey" | "name">[],
): string {
  if (!queryParam) return FITTING_MOCKUP_POLARIS_SHIP_KEY;
  if (isFittingShipGuid(queryParam)) return queryParam;

  const slug = slugify(queryParam);
  const needle = queryParam.toLowerCase().trim();

  const match = ships.find((ship) => {
    const name = ship.name.toLowerCase();
    const nameSlug = slugify(ship.name);
    return (
      ship.shipKey === queryParam
      || name.includes(needle)
      || nameSlug === slug
      || nameSlug.endsWith(`-${slug}`)
      || nameSlug.split("-").includes(slug)
    );
  });

  return match?.shipKey ?? FITTING_MOCKUP_POLARIS_SHIP_KEY;
}

/** Derive wiki manufacturer code when fitting API manufacturer is null. */
export function deriveManufacturerCode(manufacturer: string | null, displayName: string): string {
  const candidates = [
    manufacturer?.trim(),
    displayName.trim().split(/\s+/)[0],
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const token = candidate.toLowerCase().split(/\s+/)[0] ?? "";
    if (MANUFACTURER_PREFIX_TO_CODE[token]) return MANUFACTURER_PREFIX_TO_CODE[token];
    if (/^[a-z]{3,5}$/.test(token)) return token;
  }
  return "";
}

/** Ship model name without manufacturer prefix, e.g. "RSI Polaris" → "Polaris". */
export function deriveShipModelName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? displayName;
  return parts.slice(1).join(" ");
}

/** Display manufacturer label for chrome when API field is null. */
export function deriveDisplayManufacturer(manufacturer: string | null, displayName: string): string | null {
  if (manufacturer) return manufacturer;
  const first = displayName.trim().split(/\s+/)[0];
  return first && displayName.includes(" ") ? first : null;
}

export function wikiSlugAssetCandidates(displayName: string): Array<{ src: string; alt: string }> {
  const slug = slugify(deriveShipModelName(displayName));
  if (!slug) return [];
  return [
    { src: `/ships/wiki/${slug}.png`, alt: `${displayName} ship image` },
    { src: `/ships/wiki/${slug}.jpg`, alt: `${displayName} ship image` },
  ];
}
