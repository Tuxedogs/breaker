/** Reviewed topography atlas artwork converted from
 * E:\Moonbreaker Artwork\Out\Planets\Topography_Detail, Nov 7 2026.
 * Decorative only: these are not resource heatmaps, GPS charts or spawn evidence.
 * Missing bodies deliberately have no map background.
 */
const BASE = "/assets/planetsandmoons/topography-hero";

const TOPOGRAPHY_BY_LOCATION: Readonly<Record<string,string>> = {
  "stanton:hurston": "stanton_1_hurston.webp",
  "stanton:arial": "stanton_1a_hurston_arial.webp",
  "stanton:aberdeen": "stanton_1b_hurston_aberdeen.webp",
  "stanton:magda": "stanton_1c_hurston_magda.webp",
  "stanton:ita": "stanton_1d_hurston_ita.webp",
  "stanton:crusader": "stanton_2_crusader.webp",
  "stanton:cellin": "stanton_2a_crusader_cellin.webp",
  "stanton:daymar": "stanton_2b_crusader_daymar.webp",
  "stanton:yela": "stanton_2c_crusader_yela.webp",
  "stanton:arccorp": "stanton_3_arccorp.webp",
  "stanton:lyria": "stanton_3a_arccorp_lyria.webp",
  "stanton:wala": "stanton_3b_arccorp_wala.webp",
  "stanton:microtech": "stanton_4_microtech.webp",
  "stanton:calliope": "stanton_4a_microtech_calliope.webp",
  "stanton:clio": "stanton_4b_microtech_clio.webp",
  "stanton:euterpe": "stanton_4c_microtech_euterpe.webp",
  // Assembled Pyro terrain from the Nov 7 map workspace; these ten have
  // not yet had the separate enhanced-detail pass completed.
  "pyro:pyroi": "pyro_1.webp",
  "pyro:pyro1": "pyro_1.webp",
  "pyro:monox": "pyro_2.webp", // Pyro II
  "pyro:pyroii": "pyro_2.webp",
  "pyro:bloom": "pyro_3.webp", // Pyro III
  "pyro:pyroiii": "pyro_3.webp",
  "pyro:pyroiv": "pyro_4.webp",
  "pyro:pyro4": "pyro_4.webp",
  "pyro:pyrovaignis": "pyro_5a.webp",
  "pyro:ignis": "pyro_5a.webp",
  "pyro:pyrovbvatra": "pyro_5b.webp",
  "pyro:vatra": "pyro_5b.webp",
  "pyro:pyrovcadir": "pyro_5c.webp",
  "pyro:adir": "pyro_5c.webp",
  "pyro:pyrovdfairo": "pyro_5d.webp",
  "pyro:fairo": "pyro_5d.webp",
  "pyro:pyrovefuego": "pyro_5e.webp",
  "pyro:fuego": "pyro_5e.webp",
  "pyro:pyrovfvuur": "pyro_5f.webp",
  "pyro:vuur": "pyro_5f.webp",
  "pyro:terminus": "pyro_6.webp",
  "pyro:pyrovi": "pyro_6.webp",
  "pyro:pyro6": "pyro_6.webp",
  "nyx:nyxi": "nyx_1.webp",
  "nyx:nyx1": "nyx_1.webp",
  "nyx:nyxii": "nyx_2.webp",
  "nyx:nyx2": "nyx_2.webp",
  "nyx:nyxiii": "nyx_3.webp",
  "nyx:nyx3": "nyx_3.webp",
};

const normalized = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function getLocationTopography(systemName: string, locationName: string): string | null {
  const system = normalized(systemName);
  const name = normalized(locationName);
  const full = TOPOGRAPHY_BY_LOCATION[system + ":" + name];
  if (full) return BASE + "/" + full;
  // CIG display aliases may include a parenthesized location name.
  const paren = locationName.match(/\(([^)]+)\)/);
  if (paren) {
    const alias = TOPOGRAPHY_BY_LOCATION[system + ":" + normalized(paren[1])];
    if (alias) return BASE + "/" + alias;
  }
  const beforeParen = locationName.split("(")[0].trim();
  const plain = TOPOGRAPHY_BY_LOCATION[system + ":" + normalized(beforeParen)];
  return plain ? BASE + "/" + plain : null;
}
