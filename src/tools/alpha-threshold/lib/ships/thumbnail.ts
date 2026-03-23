import { shipWikiImages } from '../../data/ships/wikiImages'
import type { Ship } from '../../types'

export type ShipThumbnailSource = 'primary' | 'mapped' | 'placeholder'

export type ShipThumbnailCandidate = {
  src: string
  alt: string
  source: ShipThumbnailSource
}

const SHARED_PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
      <defs>
        <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <rect width="320" height="320" fill="url(#g)"/>
      <circle cx="96" cy="86" r="72" fill="rgba(148,163,184,0.18)"/>
      <rect x="56" y="220" width="208" height="16" rx="8" fill="rgba(226,232,240,0.32)"/>
      <rect x="84" y="246" width="152" height="12" rx="6" fill="rgba(148,163,184,0.35)"/>
    </svg>`
  )

function normalizeToken(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function deriveNameKeys(name: string) {
  const raw = name.toLowerCase().trim()
  const normalized = normalizeToken(name)
  const underscoreRaw = raw.replace(/\s+/g, '_')
  const parts = normalized.split('_').filter(Boolean)
  const base = parts[0] ?? normalized
  const trimmedMk = normalized.replace(/_mk_[ivx]+$/i, '')

  return [raw, underscoreRaw, normalized, trimmedMk, base].filter(Boolean)
}

function deriveMappedKeys(ship: Pick<Ship, 'manufacturer' | 'name' | 'id'>) {
  const manufacturer = normalizeToken(ship.manufacturer)
  const nameKeys = deriveNameKeys(ship.name)
  const idName = normalizeToken(String(ship.id).split(':')[1] ?? '')
  const idNameKeys = idName ? deriveNameKeys(idName) : []

  const keys = new Set<string>()
  for (const token of [...nameKeys, ...idNameKeys]) {
    if (!token) continue
    keys.add(`${manufacturer}::${token}`)
  }
  return Array.from(keys)
}

const LEGACY_KEY_ALIASES: Record<string, string[]> = {
  'aegs::idris_m': ['aegs::idris-m', 'aegs::idris'],
  'aegs::idris_p': ['aegs::idris-p'],
  'aegs::avenger_titan_renegade': ['aegs::avenger_titan_rngd.'],
  'anvl::c8x_pisces_expedition': ['anvl::c8x_pisces_exp.'],
  'anvl::f7a_hornet_mk_i': ['anvl::f7a_mk_i'],
  'anvl::f7a_hornet_mk_ii': ['anvl::f7a_mk_ii'],
  'anvl::f7c_hornet_mk_i': ['anvl::f7c_mk_i'],
  'anvl::f7c_hornet_mk_ii': ['anvl::f7c_mk_ii'],
  'anvl::f7c_hornet_wildfire_mk_i': ['anvl::f7c_wildfire_mk_i'],
  'anvl::f7c-m_super_hornet_mk_i': ['anvl::f7c-m_mk_i'],
  'anvl::f7c-m_super_hornet_mk_ii': ['anvl::f7c-m_mk_ii'],
  'anvl::f7c-m_hornet_heartseeker_mk_i': ['anvl::f7c-m_hrtskr._mk_i'],
  'anvl::f7c-m_hornet_heartseeker_mk_ii': ['anvl::f7c-m_hrtskr._mk_ii'],
  'anvl::f7c-r_hornet_tracker_mk_i': ['anvl::f7c-r_mk_i'],
  'anvl::f7c-r_hornet_tracker_mk_ii': ['anvl::f7c-r_mk_ii'],
  'anvl::f7c-s_hornet_ghost_mk_i': ['anvl::f7c-s_mk_i', 'anvl::hornet_f7cs'],
  'anvl::f7c-s_hornet_ghost_mk_ii': ['anvl::f7c-s_mk_ii'],
  'crus::ares_star_fighter_inferno': ['crus::ares_inferno', 'crus::starfighter_inferno'],
  'crus::ares_star_fighter_ion': ['crus::ares_ion', 'crus::starfighter_ion'],
  'crus::a2_hercules_starlifter': ['crus::starlifter_a2'],
  'crus::c2_hercules_starlifter': ['crus::c2_hercules'],
  'crus::m2_hercules_starlifter': ['crus::m2_hercules', 'crus::starlifter'],
  'crus::mercury_star_runner': ['crus::mercury'],
  'drak::clipper': ['drak::drake_clipper'],
  'drak::dragonfly_star_kitten': ['drak::dragonfly_starkitten'],
  'drak::dragonfly_yellowjacket': ['drak::dragonfly_yellowjckt'],
  'drak::golem_ox': ['drak::drake_golem_ox'],
  'grin::ptv': ['grin::greycat_ptv'],
  'grin::roc': ['grin::greycat_roc'],
  'grin::roc-ds': ['grin::greycat_roc-ds'],
  'grin::stv': ['grin::greycat_stv'],
  'krig::l-21_wolf': ['krig::i21_alphawolf', 'krig::wolf'],
  'krig::l-22_alpha_wolf': ['krig::kruger_l-22_alpha_wolf'],
  'krig::p-52_merlin': ['krig::p-52'],
  'krig::p-72_archimedes': ['krig::p-72'],
  'krig::p-72_archimedes_emerald': ['krig::p-72_emerald'],
  'orig::600i_executive_edition': ['orig::600i_exec._edition'],
  'rsi::aurora_mk_i_mr': ['rsi::aurora_mr'],
  'rsi::constellation_aquila': ['rsi::constellation_aqlla.'],
  'rsi::constellation_phoenix': ['rsi::constellation_phnx.'],
  'rsi::constellation_phoenix_emerald': ['rsi::constelltn._phnxemr.'],
  'rsi::constellation_taurus': ['rsi::constellation_tau.'],
  'rsi::scorpius_antares': ['rsi::scorpius'],
  'tmbl::cyclone_tr': ['tmbl::cyclone'],
}

export function getShipThumbnailCandidates(
  ship: Pick<Ship, 'manufacturer' | 'name' | 'id' | 'imageSrc' | 'imageAlt'>
): ShipThumbnailCandidate[] {
  const alt = ship.imageAlt ?? `${ship.name} ship image`
  const candidates: ShipThumbnailCandidate[] = []

  if (ship.imageSrc) {
    candidates.push({ src: ship.imageSrc, alt, source: 'primary' })
  }

  const mappedKeys = deriveMappedKeys(ship)
  const keysToTry = new Set<string>(mappedKeys)
  mappedKeys.forEach((key) => {
    const aliases = LEGACY_KEY_ALIASES[key]
    aliases?.forEach((alias) => keysToTry.add(alias))
  })

  for (const key of keysToTry) {
    const mapped = shipWikiImages[key as keyof typeof shipWikiImages]
    if (mapped?.imageSrc) {
      candidates.push({
        src: mapped.imageSrc,
        alt: mapped.imageAlt ?? alt,
        source: 'mapped',
      })
      break
    }
  }

  candidates.push({
    src: SHARED_PLACEHOLDER_IMAGE,
    alt: `${ship.name} placeholder image`,
    source: 'placeholder',
  })

  const deduped: ShipThumbnailCandidate[] = []
  const seen = new Set<string>()
  for (const candidate of candidates) {
    if (seen.has(candidate.src)) continue
    seen.add(candidate.src)
    deduped.push(candidate)
  }
  return deduped
}
