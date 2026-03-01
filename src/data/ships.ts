import { moduleById } from "./modules";
import { refByKey } from "./refs";

export type ShipRoleLens = "pilot" | "gunner" | "engineer";

export type ShipHub = {
  slug: string;
  name: string;
  career: "Combat" | "Industry" | "Logistics";
  role: string;
  imageSrc: string;
  primaryRoles: ShipRoleLens[];
  loadoutAssumption?: string;
  primaryRoleFlow: string[];
  commonFailureModes: string[];
  recommendedModuleIds: string[];
  referenceIds: string[];
  operationalLinks?: Array<{
    id: string;
    title: string;
    summary: string;
    to: string;
  }>;
};

const shipHubData: ShipHub[] = [
  {
    slug: "perseus",
    name: "RSI Perseus",
    career: "Combat",
    role: "Heavy Gunship",
    imageSrc: "/images/bg-states/percy-final.png",
    primaryRoles: ["pilot", "gunner", "engineer"],
    loadoutAssumption: "Baseline anti-cap fit with stocked torpedoes and full engineering support.",
    primaryRoleFlow: [
      "Pilot maintains aft pressure window at effective weapon range.",
      "Gunners prioritize power plant and QT drive components.",
      "Engineer rotates repairs and any combat station, increasing total output and increasing survivability significantly.",
      "Crews recommit only when range, and support are confirmed.",
    ],
    commonFailureModes: [
      "Pilot over-corrects and drops turret firing windows.",
      "Gunners split fire across low-value surfaces.",
      "Pilot over uses boost, causing a gradual sliding loss of position, endangering the crew.",
      "Crew commits before target state is verified.",
    ],
    recommendedModuleIds: [
      "perseus-relative-tracking",
      "perseus-engagement-ranges",
      "perseus-component-sniping",
      "sub-targeting-component-cycle",
      "turret-keybind-baseline",
      "anti-cap-target-triage",
      "perseus-recovery-cycle",
    ],
    referenceIds: [
      "diagram/perseus-component-priority",
      "diagram/subtarget-reference-frames",
    ],
    operationalLinks: [
      {
        id: "perseus-turret-keybinds",
        title: "Turret Keybinds",
        summary: "Current keybind baseline for all gunners until reference pages are refactored.",
        to: "/systems/turret-keybinds",
      },
      {
        id: "perseus-maps",
        title: "Perseus Deck Map",
        summary: "Use the current maps page until the dedicated deck-map reference is refactored.",
        to: "/maps",
      },
    ],
  },
  {
    slug: "polaris",
    name: "RSI Polaris",
    career: "Combat",
    role: "Corvette",
    imageSrc: "/images/bg-states/Idristop.png",
    primaryRoles: ["pilot", "gunner", "engineer"],
    loadoutAssumption: "Placeholder hub while Polaris-specific modules are being validated.",
    primaryRoleFlow: [
      "Establish standoff posture and assign missile windows.",
      "Coordinate turret coverage with approach vector.",
      "Protect engineering throughput during sustained fire.",
    ],
    commonFailureModes: [
      "Early missile release with no target lock discipline.",
      "Turret teams lose overlapping coverage.",
      "Engineer callouts are delayed under pressure.",
    ],
    recommendedModuleIds: ["anti-cap-target-triage"],
    referenceIds: ["map/stanton-orbit-lanes"],
  },
  {
    slug: "idris",
    name: "Aegis Idris",
    career: "Combat",
    role: "Frigate",
    imageSrc: "/images/bg-states/idrishero.png",
    primaryRoles: ["pilot", "gunner", "engineer"],
    loadoutAssumption: "Placeholder hub while Idris doctrine modules are drafted.",
    primaryRoleFlow: [
      "Align broadside pressure with escort coverage.",
      "Prioritize subsystem suppression before hull race.",
      "Rotate engineering teams to maintain offensive uptime.",
    ],
    commonFailureModes: [
      "Broadside drift breaks firing lanes.",
      "Subsystem priorities are not synchronized.",
      "Recommit occurs before critical repairs complete.",
    ],
    recommendedModuleIds: ["anti-cap-target-triage"],
    referenceIds: ["diagram/perseus-component-priority"],
  },
];

function validateShips() {
  for (const ship of shipHubData) {
    for (const moduleId of ship.recommendedModuleIds) {
      if (!moduleById.has(moduleId)) {
        throw new Error(
          `[content] ship "${ship.slug}" references unknown module id "${moduleId}" in recommendedModuleIds`
        );
      }
    }

    for (const refId of ship.referenceIds) {
      if (!refByKey.has(refId)) {
        throw new Error(
          `[content] ship "${ship.slug}" references unknown reference id "${refId}" in referenceIds`
        );
      }
    }
  }
}

export let shipLoadError: Error | null = null;
try {
  validateShips();
} catch (error) {
  const loadError = error instanceof Error ? error : new Error(String(error));
  shipLoadError = loadError;
  if (import.meta.env.PROD) {
    throw loadError;
  }
  console.error(loadError);
}

export const shipHubs = shipHubData;
export const shipHubBySlug = new Map(shipHubs.map((ship) => [ship.slug, ship]));
