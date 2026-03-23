import { normalizeShipName } from '../../lib/ships/normalize'

export function getDefenseProfileKey(name: string): string {
  return normalizeShipName(name).toLowerCase()
}

/**
 * Erkul seed `name` (normalized key) → exact `name` string from defense profile JSON.
 * Used when Erkul uses long or different spellings than the shield export.
 */
const SEED_KEY_TO_PROFILE_NAME: Record<string, string> = {
  avenger_titan_renegade: 'Avenger Titan Rngd.',
  idris_m: 'Idris-M',
  idris_p: 'Idris-P',
  c8x_pisces_expedition: 'C8X Pisces Exp.',
  clipper: 'Drake Clipper',
  golem_ox: 'Drake Golem OX',
  dragonfly_yellowjacket: 'Dragonfly Yellowjckt',
  'l-21_wolf': 'Wolf',
  'l-22_alpha_wolf': 'Kruger L-22 Alpha Wolf',
  '600i_executive_edition': '600i Exec. Edition',
  aurora_mk_i_mr: 'Aurora MR',
  constellation_andromeda: 'Constellation Andr.',
  constellation_aquila: 'Constellation Aqlla.',
  constellation_phoenix: 'Constellation Phnx.',
  constellation_phoenix_emerald: 'Constelltn. PhnxEmr.',
  constellation_taurus: 'Constellation Tau.',
  scorpius_antares: 'Scorpius',
  'p-52_merlin': 'P-52',
  'p-72_archimedes': 'P-72',
  'p-72_archimedes_emerald': 'P-72 Emerald',
  ptv: 'Greycat PTV',
  roc: 'Greycat ROC',
  'roc-ds': 'Greycat ROC-DS',
  stv: 'Greycat STV',
  cyclone_tr: 'Cyclone',
}

/**
 * When multiple profiles share the display name "Unknown Ship", resolve by `profile.id`.
 */
export const SEED_KEY_TO_PROFILE_ID: Record<string, string> = {
  asgard: 'anvl_asgard',
  meteor: 'rsi_meteor',
  /** Greycat MTC / MDC share the `grin_mtc` export (name "Unknown Ship"). */
  mtc: 'grin_mtc',
  mdc: 'grin_mtc',
}

/**
 * All normalized keys to try when resolving a defense profile for a ship record name.
 */
export function getDefenseProfileLookupKeys(recordName: string): string[] {
  const key = getDefenseProfileKey(recordName)
  const keys = new Set<string>()
  const add = (k: string | undefined) => {
    if (k) keys.add(k)
  }

  add(key)

  const aliasName = SEED_KEY_TO_PROFILE_NAME[key]
  if (aliasName) add(getDefenseProfileKey(aliasName))

  if (/_starlifter$/i.test(key)) add(key.replace(/_starlifter$/i, ''))
  if (/_star_runner$/i.test(key)) add(key.replace(/_star_runner$/i, ''))
  add(key.replace(/_star_fighter_/gi, '_'))
  add(key.replace(/_star_kitten$/i, '_starkitten'))

  const withoutHornet = key.replace(/_hornet_/gi, '_')
  add(withoutHornet)
  add(withoutHornet.replace(/_heartseeker_mk_ii$/i, '_hrtskr._mk_ii'))
  add(withoutHornet.replace(/_heartseeker_mk_i$/i, '_hrtskr._mk_i'))

  /* F7C-M Super Hornet Mk I → profile "F7C-M Mk I" (no "Super" / "Hornet" in export name). */
  add(key.replace(/_super_hornet_/gi, '_'))
  /* F7C-R Hornet Tracker → "F7C-R Mk I"; F7C-S Hornet Ghost → "F7C-S Mk I". */
  add(withoutHornet.replace(/_tracker_/gi, '_'))
  add(withoutHornet.replace(/_ghost_/gi, '_'))

  return [...keys]
}

export function getDefenseProfileIdHint(recordName: string): string | undefined {
  return SEED_KEY_TO_PROFILE_ID[getDefenseProfileKey(recordName)]
}
