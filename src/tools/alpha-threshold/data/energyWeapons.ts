import { normalizeManualWeaponRecord } from '../lib/weapons/adapters/manual'
import type { WeaponRecord } from '../types'

const rawEnergyWeapons = [
  { name: 'M5A Laser Cannon', size: 'S3', type: 'energy', burstDps: 683.6, alpha: 410.2, speed: 1000 },
  { name: 'M5A Defense Division', size: 'S3', type: 'energy', burstDps: 683.6, alpha: 410.2, speed: 1000 },
  { name: 'M4A Laser Cannon', size: 'S2', type: 'energy', burstDps: 455.6, alpha: 273.4, speed: 1000 },
  { name: 'M4A Defense Division', size: 'S2', type: 'energy', burstDps: 455.6, alpha: 273.4, speed: 1000 },
  { name: 'NN-14 Neutron Cannon*', size: 'S3', type: 'energy', burstDps: 551.8, alpha: 220.7, speed: 1400 },
  { name: 'Omnisky IX', size: 'S3', type: 'energy', burstDps: 546.8, alpha: 218.7, speed: 1400 },
  { name: 'Quarreler', size: 'S3', type: 'energy', burstDps: 546.8, alpha: 218.7, speed: 1400 },
  { name: 'NN-14 Neutron Cannon*', size: 'S2', type: 'energy', burstDps: 382, alpha: 152.8, speed: 1400 },
  { name: 'Ardor-3 Salvaged', size: 'S3', type: 'energy', burstDps: 884.3, alpha: 151.6, speed: 1000 },
  { name: 'Omnisky VI', size: 'S2', type: 'energy', burstDps: 364.5, alpha: 145.8, speed: 1400 },
  { name: 'Attrition-3', size: 'S3', type: 'energy', burstDps: 786.2, alpha: 134.8, speed: 1000 },
  { name: 'Lightstrike III', size: 'S3', type: 'energy', burstDps: 461.7, alpha: 110.8, speed: 1800 },
  { name: 'Ardor-2 Salvaged', size: 'S2', type: 'energy', burstDps: 639.9, alpha: 109.7, speed: 1000 },
  { name: 'Attrition-2', size: 'S2', type: 'energy', burstDps: 581.7, alpha: 99.7, speed: 1000 },
  { name: 'NDB-30 Neutron Repeater*', size: 'S3', type: 'energy', burstDps: 712.5, alpha: 85.5, speed: 1400 },
  { name: 'Lightstrike II', size: 'S2', type: 'energy', burstDps: 308.5, alpha: 74, speed: 1800 },
  { name: 'NDB-28 Neutron Repeater*', size: 'S2', type: 'energy', burstDps: 474.8, alpha: 57, speed: 1400 },
  { name: 'CF-337 Panther', size: 'S3', type: 'energy', burstDps: 545.6, alpha: 43.7, speed: 1800 },
  { name: 'CF-227 Badger', size: 'S2', type: 'energy', burstDps: 328, alpha: 26.2, speed: 1800 },
] as const

export const energyWeapons: WeaponRecord[] = rawEnergyWeapons.map((weapon) =>
  normalizeManualWeaponRecord(weapon, 'merged')
)
