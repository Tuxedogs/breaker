/**
 * FPS Build Queue / Crafting stats fallback.
 *
 * Fitting LIVE component detail (`/api/v1/fitting/components/:entityClass`) does not
 * include FPS weapons or armor (404 RESOURCE_NOT_FOUND for those entity classes).
 * Authoritative extracted values live on the component-card index under
 * `stats.fpsWeapon` / `stats.fpsArmor` (shaped from Foundry XML via crafting pipelines).
 *
 * This module normalizes those card stats into `FittingComponentDetail` so the shared
 * projection → modifier → grouping pipeline can render FPS items without inventing fields.
 */
import type { ComponentCardIndexRecord } from "../componentCardIndex";
import type {
  DamageTypeMap,
  FittingComponentDetail,
  FittingComponentMitigation,
  FittingComponentStats,
} from "../fitting/fittingApi";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFinite(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getStatsObject(record: ComponentCardIndexRecord, key: "fpsWeapon" | "fpsArmor" | "fpsAmmo"): Record<string, unknown> | null {
  const stats = record.stats as unknown;
  if (!isRecord(stats)) return null;
  const value = stats[key];
  return isRecord(value) ? value : null;
}

function damageTypeEntry(value: unknown): DamageTypeMap[keyof DamageTypeMap] | undefined {
  const number = readFinite(value);
  if (number === null) return undefined;
  return { value: number };
}

function buildArmorMitigation(armor: Record<string, unknown>): FittingComponentMitigation {
  const resistanceByDamageType: DamageTypeMap = {};
  const physical = damageTypeEntry(armor.physicalResistance);
  const energy = damageTypeEntry(armor.energyResistance);
  const distortion = damageTypeEntry(armor.distortionResistance);
  const thermal = damageTypeEntry(armor.thermalResistance);
  const biochemical = damageTypeEntry(armor.biochemicalResistance);
  const stun = damageTypeEntry(armor.stunResistance);

  if (physical) resistanceByDamageType.physical = physical;
  if (energy) resistanceByDamageType.energy = energy;
  if (distortion) resistanceByDamageType.distortion = distortion;
  if (thermal) resistanceByDamageType.thermal = thermal;
  if (biochemical) resistanceByDamageType.biochemical = biochemical;
  if (stun) resistanceByDamageType.stun = stun;

  return {
    kind: "armor",
    health: readFinite(armor.health),
    basePenetrationReduction: null,
    damageMultiplierByDamageType: Object.keys(resistanceByDamageType).length > 0 ? resistanceByDamageType : null,
    deflectionThresholdByDamageType: null,
    penetrationAbsorptionByDamageType: null,
    resistanceByDamageType: Object.keys(resistanceByDamageType).length > 0 ? resistanceByDamageType : null,
  };
}

function buildFpsWeaponDetail(
  record: ComponentCardIndexRecord,
  weapon: Record<string, unknown>,
): FittingComponentDetail {
  const projectileTravel =
    readFinite(weapon.projectileLifetimeTravel)
    ?? readFinite(weapon.calculatedRange);

  const stats: FittingComponentStats = {
    alphaDamage: readFinite(weapon.alphaDamageTotal),
    dps: readFinite(weapon.dps),
    fireRateRpm: readFinite(weapon.fireRateRpm),
    burstShotCount: readFinite(weapon.burstShotCount),
    ammoCapacity: readFinite(weapon.ammoCapacity),
    projectileSpeed: readFinite(weapon.projectileSpeed),
    projectileLifetime: readFinite(weapon.projectileLifetime),
    calculatedRange: projectileTravel,
    damagePhysical: readFinite(weapon.damagePhysical),
    damageEnergy: readFinite(weapon.damageEnergy),
    damageDistortion: readFinite(weapon.damageDistortion),
    damageThermal: readFinite(weapon.damageThermal),
    damageBiochemical: readFinite(weapon.damageBiochemical),
    damageStun: readFinite(weapon.damageStun),
    heatPerShot: readFinite(weapon.heatPerShot),
    wearPerSecond: readFinite(weapon.wearPerShot),
    spreadMin: readFinite(weapon.hipFireSpreadMin),
    spreadMax: readFinite(weapon.hipFireSpreadMax),
    spreadFirstAttack: readFinite(weapon.hipFireSpreadFirstAttack),
    spreadPerAttack: readFinite(weapon.hipFireSpreadPerAttack),
    spreadDecay: readFinite(weapon.hipFireSpreadDecay),
    falloffStart: readFinite(weapon.falloffStart),
    damageDropPerMeter: readFinite(weapon.damageDropPerMeter),
    damageDropMinDamage: readFinite(weapon.damageDropMinDamage),
    penetrationNearRadius: readFinite(weapon.penetrationNearRadius),
    penetrationFarRadius: readFinite(weapon.penetrationFarRadius),
    bulletImpulseFalloffMinDistance: readFinite(weapon.bulletImpulseFalloffMinDistance),
    bulletImpulseDropFalloff: readFinite(weapon.bulletImpulseDropFalloff),
    bulletImpulseMaxFalloff: readFinite(weapon.bulletImpulseMaxFalloff),
    mass: readFinite(weapon.mass),
    maxPenetrationThickness: readFinite(weapon.penetrationNearRadius),
  };

  const mitigation: FittingComponentMitigation | null = {
    kind: "weapon_projectile",
    damage: {
      physical: readFinite(weapon.damagePhysical),
      energy: readFinite(weapon.damageEnergy),
      distortion: readFinite(weapon.damageDistortion),
      thermal: readFinite(weapon.damageThermal),
      biochemical: readFinite(weapon.damageBiochemical),
      stun: readFinite(weapon.damageStun),
    },
    ammoPenetration: null,
    basePenetrationDistance: readFinite(weapon.penetrationBaseDistance),
    maxPenetrationThickness: readFinite(weapon.penetrationNearRadius),
    penetrationParams: null,
  };

  return {
    id: record.entityClass?.trim() || record.id,
    name: record.name,
    displayName: record.name,
    manufacturer: record.manufacturer ?? null,
    type: "fps_weapon",
    subtype: readString(weapon.weaponClass) ?? record.facets.weaponClass ?? null,
    size: record.size,
    grade: record.grade,
    class: readString(weapon.fireMode),
    confidence: "medium",
    stats,
    mitigation,
  };
}

function buildFpsAmmoDetail(
  record: ComponentCardIndexRecord,
  ammo: Record<string, unknown>,
): FittingComponentDetail {
  const stats: FittingComponentStats = {
    alphaDamage: readFinite(ammo.alphaDamageTotal),
    ammoCapacity: readFinite(ammo.magazineCapacity),
    initialAmmoCount: readFinite(ammo.ammoCount),
    projectileSpeed: readFinite(ammo.projectileSpeed),
    projectileLifetime: readFinite(ammo.projectileLifetime),
    calculatedRange: readFinite(ammo.projectileLifetimeTravel) ?? readFinite(ammo.calculatedRange),
    damagePhysical: readFinite(ammo.damagePhysical),
    damageEnergy: readFinite(ammo.damageEnergy),
    damageDistortion: readFinite(ammo.damageDistortion),
    damageThermal: readFinite(ammo.damageThermal),
    damageBiochemical: readFinite(ammo.damageBiochemical),
    damageStun: readFinite(ammo.damageStun),
    falloffStart: readFinite(ammo.falloffStart),
    damageDropPerMeter: readFinite(ammo.damageDropPerMeter),
    damageDropMinDamage: readFinite(ammo.damageDropMinDamage),
    penetrationNearRadius: readFinite(ammo.penetrationNearRadius),
    penetrationFarRadius: readFinite(ammo.penetrationFarRadius),
    bulletImpulseFalloffMinDistance: readFinite(ammo.bulletImpulseFalloffMinDistance),
    bulletImpulseDropFalloff: readFinite(ammo.bulletImpulseDropFalloff),
    bulletImpulseMaxFalloff: readFinite(ammo.bulletImpulseMaxFalloff),
    maxPenetrationThickness: readFinite(ammo.penetrationNearRadius),
  };

  return {
    id: record.entityClass?.trim() || record.id,
    name: record.name,
    displayName: record.name,
    manufacturer: record.manufacturer ?? null,
    type: "fps_ammo",
    subtype: readString(ammo.compatibleWeaponClass),
    size: record.size,
    grade: record.grade,
    class: readString(ammo.ammoClass),
    confidence: "medium",
    stats,
    mitigation: {
      kind: "weapon_projectile",
      damage: {
        physical: readFinite(ammo.damagePhysical),
        energy: readFinite(ammo.damageEnergy),
        distortion: readFinite(ammo.damageDistortion),
        thermal: readFinite(ammo.damageThermal),
        biochemical: readFinite(ammo.damageBiochemical),
        stun: readFinite(ammo.damageStun),
      },
      ammoPenetration: null,
      basePenetrationDistance: readFinite(ammo.penetrationBaseDistance),
      maxPenetrationThickness: readFinite(ammo.penetrationNearRadius),
      penetrationParams: null,
    },
  };
}

function buildFpsArmorDetail(
  record: ComponentCardIndexRecord,
  armor: Record<string, unknown>,
): FittingComponentDetail {
  const stats: FittingComponentStats = {
    mass: readFinite(armor.mass),
    health: readFinite(armor.health),
  };

  return {
    id: record.entityClass?.trim() || record.id,
    name: record.name,
    displayName: record.name,
    manufacturer: record.manufacturer ?? null,
    type: "fps_armor",
    subtype: readString(armor.armorSlot) ?? record.facets.armorSlot ?? null,
    size: record.size,
    grade: record.grade,
    class: readString(armor.armorWeight) ?? record.facets.armorWeight ?? null,
    confidence: "medium",
    stats,
    mitigation: buildArmorMitigation(armor),
  };
}

/** Expose proven card-only armor climate fields for projection without inventing fitting keys. */
export type FpsArmorCardExtras = {
  temperatureMin: number | null;
  temperatureMax: number | null;
  radiationDissipation: number | null;
  storageCapacity: number | null;
};

const fpsArmorExtrasById = new Map<string, FpsArmorCardExtras>();

export function getFpsArmorCardExtras(detail: FittingComponentDetail): FpsArmorCardExtras | null {
  if (detail.type !== "fps_armor") return null;
  return fpsArmorExtrasById.get(detail.id) ?? null;
}

/**
 * Normalize FPS component-card stats into a fitting-shaped detail for shared BQ/Crafting projection.
 * Returns null when the card is not FPS or lacks a usable fpsWeapon/fpsArmor stats object.
 */
export function buildFittingDetailFromFpsComponentCard(
  record: ComponentCardIndexRecord | null | undefined,
): FittingComponentDetail | null {
  if (!record || record.kind !== "fps") return null;

  if (record.type === "weapons") {
    const weapon = getStatsObject(record, "fpsWeapon");
    if (!weapon) return null;
    const detail = buildFpsWeaponDetail(record, weapon);
    const hasCombatStat = [
      detail.stats.alphaDamage,
      detail.stats.fireRateRpm,
      detail.stats.ammoCapacity,
      detail.stats.dps,
    ].some((value) => typeof value === "number" && Number.isFinite(value));
    return hasCombatStat ? detail : null;
  }

  if (record.type === "armor") {
    const armor = getStatsObject(record, "fpsArmor");
    if (!armor) return null;
    const detail = buildFpsArmorDetail(record, armor);
    const mitigation = detail.mitigation?.kind === "armor" ? detail.mitigation : null;
    const hasResistance = Boolean(
      mitigation?.resistanceByDamageType
      && Object.keys(mitigation.resistanceByDamageType).length > 0,
    );
    const hasBodyStat = typeof detail.stats.mass === "number" && Number.isFinite(detail.stats.mass);
    if (!hasResistance && !hasBodyStat) return null;

    fpsArmorExtrasById.set(detail.id, {
      temperatureMin: readFinite(armor.temperatureMin),
      temperatureMax: readFinite(armor.temperatureMax),
      radiationDissipation: readFinite(armor.radiationDissipation),
      storageCapacity: readFinite(armor.storageCapacity),
    });
    return detail;
  }

  if (record.type === "ammo") {
    const ammo = getStatsObject(record, "fpsAmmo");
    if (!ammo) return null;
    const detail = buildFpsAmmoDetail(record, ammo);
    const hasProjectileStat = [
      detail.stats.alphaDamage,
      detail.stats.ammoCapacity,
      detail.stats.projectileSpeed,
    ].some((value) => typeof value === "number" && Number.isFinite(value));
    return hasProjectileStat ? detail : null;
  }

  return null;
}
