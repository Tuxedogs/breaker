import additionalIcon from "@/assets/icons/component-stat-icons/25-additional.webp";
import ammunitionIcon from "@/assets/icons/component-stat-icons/26-ammunition.webp";
import ballisticsDamageIcon from "@/assets/icons/component-stat-icons/01-ballistics-damage.webp";
import beamRangeIcon from "@/assets/icons/component-stat-icons/20-beam-range.webp";
import damageOutputIcon from "@/assets/icons/component-stat-icons/02-damage-output.webp";
import damageTakenMultipliersIcon from "@/assets/icons/component-stat-icons/22-damage-taken-multipliers.webp";
import durabilityPhysicalIcon from "@/assets/icons/component-stat-icons/18-durability-physical.webp";
import environmentIcon from "@/assets/icons/component-stat-icons/24-environment.webp";
import falloffIcon from "@/assets/icons/component-stat-icons/27-falloff.webp";
import fireActionsIcon from "@/assets/icons/component-stat-icons/07-fire-actions.webp";
import handlingIcon from "@/assets/icons/component-stat-icons/06-handling.webp";
import identityIcon from "@/assets/icons/component-stat-icons/21-identity.webp";
import outputIcon from "@/assets/icons/component-stat-icons/12-output.webp";
import penetrationIcon from "@/assets/icons/component-stat-icons/04-penetration.webp";
import powerAndThermalIcon from "@/assets/icons/component-stat-icons/15-power-and-thermal.webp";
import projectileIcon from "@/assets/icons/component-stat-icons/03-projectile.webp";
import protectionIcon from "@/assets/icons/component-stat-icons/23-protection.webp";
import quantumTravelIcon from "@/assets/icons/component-stat-icons/13-quantum-travel.webp";
import radarPerformanceIcon from "@/assets/icons/component-stat-icons/14-radar-performance.webp";
import repairIcon from "@/assets/icons/component-stat-icons/17-repair.webp";
import resistanceAbsorptionIcon from "@/assets/icons/component-stat-icons/11-resistance-absorption.webp";
import shieldPerformanceIcon from "@/assets/icons/component-stat-icons/10-shield-performance.webp";
import signatureDetectionIcon from "@/assets/icons/component-stat-icons/09-signature-detection.webp";
import signaturesIcon from "@/assets/icons/component-stat-icons/16-signatures.webp";
import spreadIcon from "@/assets/icons/component-stat-icons/05-spread.webp";
import thermalPowerIcon from "@/assets/icons/component-stat-icons/08-thermal-power.webp";
import toolOutputIcon from "@/assets/icons/component-stat-icons/19-tool-output.webp";

const STAT_GROUP_ICONS: Record<string, string> = {
  additional: additionalIcon,
  ammunition: ammunitionIcon,
  ballisticsanddamage: ballisticsDamageIcon,
  ballisticsdamage: ballisticsDamageIcon,
  beamrange: beamRangeIcon,
  damageoutput: damageOutputIcon,
  damagetakenmultipliers: damageTakenMultipliersIcon,
  durabilityandphysical: durabilityPhysicalIcon,
  durabilityphysical: durabilityPhysicalIcon,
  environment: environmentIcon,
  falloff: falloffIcon,
  fireactions: fireActionsIcon,
  handling: handlingIcon,
  identity: identityIcon,
  output: outputIcon,
  penetration: penetrationIcon,
  powerandthermal: powerAndThermalIcon,
  powerthermal: powerAndThermalIcon,
  projectile: projectileIcon,
  protection: protectionIcon,
  quantumtravel: quantumTravelIcon,
  radarperformance: radarPerformanceIcon,
  repair: repairIcon,
  resistanceabsorption: resistanceAbsorptionIcon,
  resistanceandabsorption: resistanceAbsorptionIcon,
  shieldperformance: shieldPerformanceIcon,
  signatureanddetection: signatureDetectionIcon,
  signaturedetection: signatureDetectionIcon,
  signatures: signaturesIcon,
  spread: spreadIcon,
  thermalandpower: thermalPowerIcon,
  thermalpower: thermalPowerIcon,
  tooloutput: toolOutputIcon,
};

export function getStatGroupIconSrc(groupKey: string): string | undefined {
  return STAT_GROUP_ICONS[groupKey];
}
