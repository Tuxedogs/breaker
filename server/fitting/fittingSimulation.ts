export const FITTING_SIMULATION_MODEL_VERSION = "fitting-simulation-v1" as const;

export type FittingSimulationPowerCategory =
  | "weapons"
  | "engines"
  | "quantum"
  | "radar"
  | "shields"
  | "lifeSupport"
  | "cooler1"
  | "cooler2";

export type FittingSimulationAllocation = Partial<
  Record<FittingSimulationPowerCategory, number>
>;

export interface NormalizedWeaponSimulationFacts {
  alphaDamage: number | null;
  fireRateRpm: number | null;
  /** Ammunition resource units consumed by each shot. */
  ammoCostPerShot?: number | null;
  /** Regenerative energy-ammunition capacity at full weapon allocation. */
  maxAmmoLoad?: number | null;
  maxRegenPerSecond?: number | null;
  regenCooldownSeconds?: number | null;
  /** Finite ballistic reserve. Used only when maxAmmoLoad is not available. */
  ammoCapacity?: number | null;
  heatPerShot?: number | null;
  minimumTemperature?: number | null;
  overheatTemperature?: number | null;
  coolingPerSecond?: number | null;
  coolingDelaySeconds?: number | null;
  overheatRecoverySeconds?: number | null;
  temperatureAfterOverheatRecovery?: number | null;
}

export interface NormalizedShieldSimulationFacts {
  maxRegenPerSecond: number | null;
  maxRegenSourcePath?: string | null;
  regenByPowerAllocation?: Array<{
    allocation: number;
    value: number;
    allocationSourcePath?: string;
    valueSourcePath?: string;
  }>;
}

export interface NormalizedFittingSimulationComponent {
  id: string;
  componentId?: string;
  componentType: string;
  active?: boolean;
  powerCategory?: FittingSimulationPowerCategory;
  powerCapacitySegments?: number | null;
  nominalPowerDemandSegments?: number | null;
  minimumPowerDemandSegments?: number | null;
  nominalPowerDemandUnitType?: string | null;
  coolingCapacity?: number | null;
  coolingCapacityByPowerAllocation?: Array<{
    allocation: number;
    capacity: number;
  }>;
  shield?: NormalizedShieldSimulationFacts | null;
  /** Foundry resource link inherited from the fitted port ancestry. */
  weaponMountTopology?: "turret" | "pilot" | null;
  weapon?: NormalizedWeaponSimulationFacts | null;
}

export interface FittingSimulationInput {
  components: NormalizedFittingSimulationComponent[];
  powerAllocation?: FittingSimulationAllocation;
  defaultedPowerAllocationCategories?: FittingSimulationPowerCategory[];
  /** Foundry FixedPowerPool capacity for WeaponGun consumers. */
  weaponPowerPoolSegments?: number | null;
  weaponPowerPoolSourcePath?: string | null;
  durationSeconds?: number;
}

export interface SimulationSourceFact {
  componentId: string;
  mountId: string | null;
  path: string;
  value: number;
}

export interface SimulationMetric {
  value: number | null;
  provenance: "derived" | "unavailable";
  formula: string | null;
  sources: SimulationSourceFact[];
}

export interface SimulationMissingInput {
  componentId: string | null;
  mountId: string | null;
  path: string;
  reason: string;
}

export interface WeaponSimulationResult {
  componentId: string;
  mountId: string | null;
  mountTopology: "turret" | "pilot" | null;
  ammunitionModel: "energy" | "ballistic" | "unavailable";
  allocationRatio: SimulationMetric;
  effectiveAmmo: SimulationMetric;
  effectiveRegenPerSecond: SimulationMetric;
  maxShotsBeforeOverheat: SimulationMetric;
  overheatInterruptions: SimulationMetric;
  overheatTimeSeconds: SimulationMetric;
  shotsFired: SimulationMetric;
  damage: SimulationMetric;
  dps: SimulationMetric;
  completeMagazinesFired: number | null;
  magazineStartTimesSeconds: number[];
  directInputs: SimulationSourceFact[];
  assumptions: string[];
  missingInputs: SimulationMissingInput[];
}

export interface FittingSimulationResult {
  modelVersion: typeof FITTING_SIMULATION_MODEL_VERSION;
  durationSeconds: number;
  power: {
    capacitySegments: SimulationMetric;
    weaponPoolCapacitySegments: SimulationMetric;
    allocatedSegments: SimulationMetric;
    marginSegments: SimulationMetric;
    allocatedByCategory: Record<FittingSimulationPowerCategory, number>;
  };
  cooling: {
    capacity: SimulationMetric;
    demand: SimulationMetric;
    utilizationPercent: SimulationMetric;
  };
  shields: {
    maxRegenPerSecond: SimulationMetric;
    effectiveRegenPerSecond: SimulationMetric;
  };
  weapons: WeaponSimulationResult[];
  weaponsSummary: {
    simulatedWeaponCount: SimulationMetric;
    totalDamage: SimulationMetric;
    dps: SimulationMetric;
  };
  provenance: {
    directInputs: SimulationSourceFact[];
    derivedModel: typeof FITTING_SIMULATION_MODEL_VERSION;
  };
  assumptions: string[];
  missingInputs: SimulationMissingInput[];
}

const POWER_CATEGORIES: FittingSimulationPowerCategory[] = [
  "weapons",
  "engines",
  "quantum",
  "radar",
  "shields",
  "lifeSupport",
  "cooler1",
  "cooler2",
];

function isFiniteNonnegative(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function source(
  componentId: string,
  path: string,
  value: number,
  mountId: string | null = null,
): SimulationSourceFact {
  return { componentId, mountId, path, value };
}

function componentSource(
  component: NormalizedFittingSimulationComponent,
  path: string,
  value: number,
): SimulationSourceFact {
  return source(component.componentId ?? component.id, path, value, component.componentId ? component.id : null);
}

function derived(
  value: number,
  formula: string,
  sources: SimulationSourceFact[],
): SimulationMetric {
  return { value, provenance: "derived", formula, sources };
}

function unavailable(sources: SimulationSourceFact[] = []): SimulationMetric {
  return { value: null, provenance: "unavailable", formula: null, sources };
}

function validateInput(input: FittingSimulationInput): number {
  const duration = input.durationSeconds ?? 60;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new RangeError("durationSeconds must be a finite number greater than zero");
  }

  for (const [category, allocation] of Object.entries(input.powerAllocation ?? {})) {
    if (!isFiniteNonnegative(allocation)) {
      throw new RangeError(`powerAllocation.${category} must be a finite nonnegative number`);
    }
  }
  if (input.weaponPowerPoolSegments != null && !isFiniteNonnegative(input.weaponPowerPoolSegments)) {
    throw new RangeError("weaponPowerPoolSegments must be a finite nonnegative number");
  }
  return duration;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function categoryNominalDemand(
  components: NormalizedFittingSimulationComponent[],
  category: FittingSimulationPowerCategory,
): number {
  return sum(
    components
      .filter((component) => component.powerCategory === category)
      .map((component) => component.nominalPowerDemandSegments)
      .filter(isFiniteNonnegative),
  );
}

function allocatedByCategory(
  components: NormalizedFittingSimulationComponent[],
  allocation: FittingSimulationAllocation,
  weaponPowerPoolSegments: number | null,
): Record<FittingSimulationPowerCategory, number> {
  return Object.fromEntries(
    POWER_CATEGORIES.map((category) => {
      const demand = categoryNominalDemand(components, category);
      const requested = allocation[category] ?? demand;
      const categoryCapacity = category === "weapons" && weaponPowerPoolSegments !== null
        ? weaponPowerPoolSegments
        : Number.POSITIVE_INFINITY;
      return [category, Math.min(requested, demand, categoryCapacity)];
    }),
  ) as Record<FittingSimulationPowerCategory, number>;
}

function directNumber(
  component: NormalizedFittingSimulationComponent,
  path: string,
  value: number | null | undefined,
  directInputs: SimulationSourceFact[],
): number | null {
  if (!isFiniteNonnegative(value)) return null;
  directInputs.push(componentSource(component, path, value));
  return value;
}

function directFiniteNumber(
  component: NormalizedFittingSimulationComponent,
  path: string,
  value: number | null | undefined,
  directInputs: SimulationSourceFact[],
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  directInputs.push(componentSource(component, path, value));
  return value;
}

function missing(
  componentId: string | null,
  path: string,
  reason: string,
  mountId: string | null = null,
): SimulationMissingInput {
  return { componentId, mountId, path, reason };
}

function componentMissing(
  component: NormalizedFittingSimulationComponent,
  path: string,
  reason: string,
): SimulationMissingInput {
  return missing(component.componentId ?? component.id, path, reason, component.componentId ? component.id : null);
}

function simulateWeapon(args: {
  component: NormalizedFittingSimulationComponent;
  durationSeconds: number;
  weaponAllocationRatio: number | null;
  allocationSources: SimulationSourceFact[];
  allocationUnavailableReason?: string;
}): WeaponSimulationResult {
  const {
    component,
    durationSeconds,
    weaponAllocationRatio,
    allocationSources,
    allocationUnavailableReason,
  } = args;
  const facts = component.weapon;
  const directInputs: SimulationSourceFact[] = [];
  const missingInputs: SimulationMissingInput[] = [];
  const assumptions: string[] = [];
  let firstThermalShotLimit: number | null = null;
  let subsequentThermalShotLimit: number | null = null;
  let thermalRecoverySeconds: number | null = null;
  let thermalTimingAvailable = false;
  let maxShotsBeforeOverheatMetric = unavailable();
  let overheatInterruptionsMetric = unavailable();
  let overheatTimeSecondsMetric = unavailable();

  if (!facts) {
    missingInputs.push(componentMissing(component, "weapon", "Weapon simulation facts are unavailable."));
    return {
      componentId: component.componentId ?? component.id,
      mountId: component.componentId ? component.id : null,
      mountTopology: component.weaponMountTopology ?? null,
      ammunitionModel: "unavailable",
      allocationRatio: unavailable(allocationSources),
      effectiveAmmo: unavailable(),
      effectiveRegenPerSecond: unavailable(),
      maxShotsBeforeOverheat: unavailable(),
      overheatInterruptions: unavailable(),
      overheatTimeSeconds: unavailable(),
      shotsFired: unavailable(),
      damage: unavailable(),
      dps: unavailable(),
      completeMagazinesFired: null,
      magazineStartTimesSeconds: [],
      directInputs,
      assumptions,
      missingInputs,
    };
  }

  const alpha = directNumber(component, "weapon.alphaDamage", facts.alphaDamage, directInputs);
  const rpm = directNumber(component, "weapon.fireRateRpm", facts.fireRateRpm, directInputs);
  if (alpha === null) missingInputs.push(componentMissing(component, "weapon.alphaDamage", "Required for damage."));
  if (rpm === null || rpm === 0) {
    missingInputs.push(componentMissing(component, "weapon.fireRateRpm", "A positive rate is required for shot timing."));
  }
  if (weaponAllocationRatio === null) {
    const allocationMissingPath = allocationUnavailableReason?.includes("powerRatioMultiplier")
      ? "ship.resourceNetwork.modifiers.powerRatioMultiplier"
      : allocationUnavailableReason?.includes("FixedPowerPool")
        ? "ship.resourceNetworkPowerPools.fixed[itemType=WeaponGun].poolSize"
      : allocationUnavailableReason
        ? "powerAllocation"
        : "nominalPowerDemandSegments";
    missingInputs.push(componentMissing(
      component,
      allocationMissingPath,
      allocationUnavailableReason ?? "Required for weapon allocation ratio.",
    ));
  }

  const heatPerShot = directNumber(component, "weapon.heatPerShot", facts.heatPerShot, directInputs);
  if (heatPerShot === null) {
    missingInputs.push(componentMissing(component, "weapon.heatPerShot", "Required to determine whether heat interrupts firing."));
    assumptions.push("Heat and overheat interruptions are not applied because heatPerShot is unavailable.");
  } else if (heatPerShot === 0) {
    thermalTimingAvailable = true;
    assumptions.push("heatPerShot is zero; no heat or overheat interruption applies.");
    overheatInterruptionsMetric = derived(0, "heatPerShot is zero", directInputs);
    overheatTimeSecondsMetric = derived(0, "heatPerShot is zero", directInputs);
  } else {
    const minimumTemperature = directFiniteNumber(
      component,
      "weapon.minimumTemperature",
      facts.minimumTemperature,
      directInputs,
    );
    const overheatTemperature = directFiniteNumber(
      component,
      "weapon.overheatTemperature",
      facts.overheatTemperature,
      directInputs,
    );
    const coolingPerSecond = directNumber(component, "weapon.coolingPerSecond", facts.coolingPerSecond, directInputs);
    const coolingDelaySeconds = directNumber(component, "weapon.coolingDelaySeconds", facts.coolingDelaySeconds, directInputs);
    thermalRecoverySeconds = directNumber(
      component,
      "weapon.overheatRecoverySeconds",
      facts.overheatRecoverySeconds,
      directInputs,
    );
    const temperatureAfterRecovery = directFiniteNumber(
      component,
      "weapon.temperatureAfterOverheatRecovery",
      facts.temperatureAfterOverheatRecovery,
      directInputs,
    );
    const requiredThermalFacts = [
      ["weapon.minimumTemperature", minimumTemperature],
      ["weapon.overheatTemperature", overheatTemperature],
      ["weapon.coolingPerSecond", coolingPerSecond],
      ["weapon.coolingDelaySeconds", coolingDelaySeconds],
      ["weapon.overheatRecoverySeconds", thermalRecoverySeconds],
      ["weapon.temperatureAfterOverheatRecovery", temperatureAfterRecovery],
    ] as const;
    const absentThermalFacts = requiredThermalFacts
      .filter(([, value]) => value === null)
      .map(([path]) => path);
    for (const path of absentThermalFacts) {
      missingInputs.push(componentMissing(component, path, "Required to model heat and overheat interruptions."));
    }
    if (absentThermalFacts.length > 0) {
      assumptions.push(
        `Heat and overheat interruptions are not applied because these dependencies are unavailable: ${absentThermalFacts.join(", ")}.`,
      );
    } else if (
      overheatTemperature! <= minimumTemperature!
      || temperatureAfterRecovery! >= overheatTemperature!
    ) {
      missingInputs.push(componentMissing(
        component,
        "weapon.minimumTemperature|weapon.overheatTemperature|weapon.temperatureAfterOverheatRecovery",
        "Thermal thresholds must satisfy minimumTemperature < overheatTemperature and post-recovery temperature < overheatTemperature.",
      ));
      assumptions.push("Heat interruptions are not applied because the extracted thermal thresholds are inconsistent.");
    } else if (rpm !== null && rpm > 0) {
      const secondsPerShot = 60 / rpm;
      const passiveCoolingPerShot = coolingPerSecond! * Math.max(0, secondsPerShot - coolingDelaySeconds!);
      const netHeatPerShot = heatPerShot - passiveCoolingPerShot;
      if (netHeatPerShot <= 0) {
        thermalTimingAvailable = true;
        overheatInterruptionsMetric = derived(
          0,
          "heatPerShot - coolingPerSecond * max(0, secondsPerShot - coolingDelaySeconds) <= 0",
          directInputs,
        );
        overheatTimeSecondsMetric = derived(0, "no overheat interruptions", directInputs);
        assumptions.push("Passive cooling between shots offsets heat generation; no overheat interruption applies.");
      } else {
        thermalTimingAvailable = true;
        firstThermalShotLimit = Math.max(1, Math.ceil(
          (overheatTemperature! - minimumTemperature!) / netHeatPerShot,
        ));
        subsequentThermalShotLimit = Math.max(1, Math.ceil(
          (overheatTemperature! - temperatureAfterRecovery!) / netHeatPerShot,
        ));
        maxShotsBeforeOverheatMetric = derived(
          firstThermalShotLimit,
          "ceil((overheatTemperature - minimumTemperature) / (heatPerShot - coolingPerSecond * max(0, 60 / fireRateRpm - coolingDelaySeconds)))",
          directInputs,
        );
        assumptions.push(
          "The captured SPViewer cycle model begins refill and thermal recovery after the normal shot interval; simultaneous refill and recovery durations are additive.",
        );
      }
    }
  }

  const ratioMetric = weaponAllocationRatio === null
    ? unavailable(allocationSources)
    : derived(
        weaponAllocationRatio,
        "min(1, assigned weapon segments / sum active weapon nominal demand)",
        allocationSources,
      );

  const maxAmmoLoad = directNumber(component, "weapon.maxAmmoLoad", facts.maxAmmoLoad, directInputs);
  const ammoCapacity = directNumber(component, "weapon.ammoCapacity", facts.ammoCapacity, directInputs);
  let ammoCostPerShot: number | null = null;
  if (facts.ammoCostPerShot == null) {
    missingInputs.push(componentMissing(
      component,
      "weapon.ammoCostPerShot",
      "Required to convert ammunition resource capacity into a shot count.",
    ));
  } else if (isFiniteNonnegative(facts.ammoCostPerShot) && facts.ammoCostPerShot > 0) {
    ammoCostPerShot = facts.ammoCostPerShot;
    directInputs.push(componentSource(component, "weapon.ammoCostPerShot", ammoCostPerShot));
  } else {
    missingInputs.push(componentMissing(
      component,
      "weapon.ammoCostPerShot",
      "When supplied, ammunition cost per shot must be a positive finite number.",
    ));
  }
  const isEnergy = maxAmmoLoad !== null && maxAmmoLoad > 0;
  const isBallistic = !isEnergy && ammoCapacity !== null && ammoCapacity > 0;
  if (!isEnergy && !isBallistic) {
    missingInputs.push(componentMissing(
      component,
      "weapon.maxAmmoLoad|weapon.ammoCapacity",
      "A regenerative maximum load or finite ballistic reserve is required.",
    ));
  }
  if (isEnergy && component.weaponMountTopology === "turret") {
    assumptions.push(
      "Turret energy-weapon capacity is not simulated from pilot-capacitor values; extracted ship-level turret multipliers are required.",
    );
    missingInputs.push(componentMissing(
      component,
      "ship.resourceNetwork.modifiers.powerRatioMultiplier|maxAmmoLoadMultiplier|maxRegenPerSecMultiplier",
      "The weapon is turret-mounted, but the ship-level turret power, load, and regeneration multipliers are not present in the fitting dataset.",
    ));
  } else if (isEnergy && component.weaponMountTopology == null) {
    missingInputs.push(componentMissing(
      component,
      "ship.hardpoints.weaponMountTopology",
      "An explicit pilot or turret mount topology is required before applying an energy-weapon capacitor model.",
    ));
  }

  if (
    alpha === null
    || rpm === null
    || rpm <= 0
    || weaponAllocationRatio === null
    || (!isEnergy && !isBallistic)
    || ammoCostPerShot === null
    || !thermalTimingAvailable
    || (isEnergy && component.weaponMountTopology == null)
  ) {
    return {
      componentId: component.componentId ?? component.id,
      mountId: component.componentId ? component.id : null,
      mountTopology: component.weaponMountTopology ?? null,
      ammunitionModel: "unavailable",
      allocationRatio: ratioMetric,
      effectiveAmmo: unavailable(directInputs),
      effectiveRegenPerSecond: unavailable(directInputs),
      maxShotsBeforeOverheat: maxShotsBeforeOverheatMetric,
      overheatInterruptions: unavailable(directInputs),
      overheatTimeSeconds: unavailable(directInputs),
      shotsFired: unavailable(directInputs),
      damage: unavailable(directInputs),
      dps: unavailable(directInputs),
      completeMagazinesFired: null,
      magazineStartTimesSeconds: [],
      directInputs,
      assumptions,
      missingInputs,
    };
  }

  const shotsPerSecond = rpm / 60;
  let shotsFired = 0;
  let effectiveAmmo = 0;
  let effectiveRegen: number | null = null;
  let completeMagazinesFired = 0;
  const magazineStartTimesSeconds: number[] = [];
  const minimumPowerDemand = directNumber(
    component,
    "minimumPowerDemandSegments",
    component.minimumPowerDemandSegments,
    directInputs,
  );
  const nominalPowerDemand = component.nominalPowerDemandSegments;
  if (
    minimumPowerDemand !== null
    && isFiniteNonnegative(nominalPowerDemand)
    && nominalPowerDemand * weaponAllocationRatio < minimumPowerDemand
  ) {
    assumptions.push("Effective weapon power is below the extracted minimum-online input; the weapon is offline.");
    return {
      componentId: component.componentId ?? component.id,
      mountId: component.componentId ? component.id : null,
      mountTopology: component.weaponMountTopology ?? null,
      ammunitionModel: isEnergy ? "energy" : "ballistic",
      allocationRatio: ratioMetric,
      effectiveAmmo: derived(0, "weapon offline below minimumPowerDemandSegments", directInputs),
      effectiveRegenPerSecond: isEnergy
        ? derived(0, "weapon offline below minimumPowerDemandSegments", directInputs)
        : unavailable(),
      maxShotsBeforeOverheat: maxShotsBeforeOverheatMetric,
      overheatInterruptions: derived(0, "weapon offline below minimumPowerDemandSegments", directInputs),
      overheatTimeSeconds: derived(0, "weapon offline below minimumPowerDemandSegments", directInputs),
      shotsFired: derived(0, "weapon offline below minimumPowerDemandSegments", directInputs),
      damage: derived(0, "shotsFired * alphaDamage", directInputs),
      dps: derived(0, "damage / durationSeconds", directInputs),
      completeMagazinesFired: 0,
      magazineStartTimesSeconds,
      directInputs,
      assumptions,
      missingInputs,
    };
  }

  if (isEnergy && component.weaponMountTopology === "turret") {
    return {
      componentId: component.componentId ?? component.id,
      mountId: component.componentId ? component.id : null,
      mountTopology: "turret",
      ammunitionModel: "energy",
      allocationRatio: ratioMetric,
      effectiveAmmo: unavailable(directInputs),
      effectiveRegenPerSecond: unavailable(directInputs),
      maxShotsBeforeOverheat: maxShotsBeforeOverheatMetric,
      overheatInterruptions: unavailable(directInputs),
      overheatTimeSeconds: unavailable(directInputs),
      shotsFired: unavailable(directInputs),
      damage: unavailable(directInputs),
      dps: unavailable(directInputs),
      completeMagazinesFired: null,
      magazineStartTimesSeconds: [],
      directInputs,
      assumptions,
      missingInputs,
    };
  }

  if (isEnergy) {
    const regen = directNumber(component, "weapon.maxRegenPerSecond", facts.maxRegenPerSecond, directInputs);
    const cooldown = directNumber(component, "weapon.regenCooldownSeconds", facts.regenCooldownSeconds, directInputs);
    if (regen === null || regen <= 0) {
      missingInputs.push(componentMissing(component, "weapon.maxRegenPerSecond", "A positive regeneration rate is required."));
    }
    if (cooldown === null) {
      missingInputs.push(componentMissing(component, "weapon.regenCooldownSeconds", "Required for full-magazine cycle timing."));
    }
    if (regen === null || regen <= 0 || cooldown === null) {
      return {
        componentId: component.componentId ?? component.id,
        mountId: component.componentId ? component.id : null,
        mountTopology: component.weaponMountTopology ?? null,
        ammunitionModel: "energy",
        allocationRatio: ratioMetric,
        effectiveAmmo: unavailable(directInputs),
        effectiveRegenPerSecond: unavailable(directInputs),
        maxShotsBeforeOverheat: maxShotsBeforeOverheatMetric,
        overheatInterruptions: unavailable(directInputs),
        overheatTimeSeconds: unavailable(directInputs),
        shotsFired: unavailable(directInputs),
        damage: unavailable(directInputs),
        dps: unavailable(directInputs),
        completeMagazinesFired: null,
        magazineStartTimesSeconds,
        directInputs,
        assumptions,
        missingInputs,
      };
    }

    effectiveAmmo = Math.round(maxAmmoLoad * weaponAllocationRatio);
    effectiveRegen = regen * weaponAllocationRatio;
    if (effectiveAmmo > 0 && effectiveRegen > 0) {
      const shotsPerMagazine = Math.floor(effectiveAmmo / ammoCostPerShot);
      if (shotsPerMagazine === 0) {
        return {
          componentId: component.componentId ?? component.id,
          mountId: component.componentId ? component.id : null,
          mountTopology: component.weaponMountTopology ?? null,
          ammunitionModel: "energy",
          allocationRatio: ratioMetric,
          effectiveAmmo: derived(
            effectiveAmmo,
            "round(maxAmmoLoad * allocationRatio) resource units",
            directInputs,
          ),
          effectiveRegenPerSecond: derived(
            effectiveRegen,
            "maxRegenPerSecond * allocationRatio",
            directInputs,
          ),
          maxShotsBeforeOverheat: maxShotsBeforeOverheatMetric,
          overheatInterruptions: derived(0, "no ammunition shots available", directInputs),
          overheatTimeSeconds: derived(0, "no ammunition shots available", directInputs),
          shotsFired: derived(0, "floor(effectiveAmmo / ammoCostPerShot) is zero", directInputs),
          damage: derived(0, "shotsFired * alphaDamage", directInputs),
          dps: derived(0, "damage / durationSeconds", directInputs),
          completeMagazinesFired: 0,
          magazineStartTimesSeconds,
          directInputs,
          assumptions,
          missingInputs,
        };
      }
      let ammunitionShotsRemaining = shotsPerMagazine;
      let shotTime = 0;
      let shotsSinceThermalRecovery = 0;
      let activeThermalLimit = firstThermalShotLimit;
      let overheatInterruptions = 0;
      let overheatTimeSeconds = 0;
      magazineStartTimesSeconds.push(0);
      while (shotTime < durationSeconds) {
        shotsFired += 1;
        ammunitionShotsRemaining -= 1;
        shotsSinceThermalRecovery += 1;

        let waitAfterShot = 1 / shotsPerSecond;
        const recoveryStartsAt = shotTime + waitAfterShot;
        if (activeThermalLimit !== null && shotsSinceThermalRecovery >= activeThermalLimit) {
          if (recoveryStartsAt < durationSeconds) {
            overheatInterruptions += 1;
            overheatTimeSeconds += Math.min(
              thermalRecoverySeconds!,
              durationSeconds - recoveryStartsAt,
            );
          }
          waitAfterShot += thermalRecoverySeconds!;
          shotsSinceThermalRecovery = 0;
          activeThermalLimit = subsequentThermalShotLimit;
        }

        let startsRefilledMagazine = false;
        if (ammunitionShotsRemaining === 0) {
          completeMagazinesFired += 1;
          waitAfterShot += cooldown + effectiveAmmo / effectiveRegen;
          ammunitionShotsRemaining = shotsPerMagazine;
          startsRefilledMagazine = true;
        }

        shotTime += waitAfterShot;
        if (startsRefilledMagazine && shotTime < durationSeconds) {
          magazineStartTimesSeconds.push(shotTime);
        }
      }
      if (firstThermalShotLimit !== null) {
        overheatInterruptionsMetric = derived(
          overheatInterruptions,
          "count thermal recovery intervals beginning inside [0, durationSeconds)",
          directInputs,
        );
        overheatTimeSecondsMetric = derived(
          overheatTimeSeconds,
          "sum overlap of overheatRecoverySeconds with [0, durationSeconds)",
          directInputs,
        );
      }
    }
  } else {
    assumptions.push("Finite ballistic reserve is fired once without ammunition regeneration.");
    effectiveAmmo = ammoCapacity!;
    if (weaponAllocationRatio === 0) {
      assumptions.push("Zero allocated weapon power prevents ballistic firing.");
    } else {
      let availableShots = Math.floor(effectiveAmmo / ammoCostPerShot);
      let shotTime = 0;
      let shotsSinceThermalRecovery = 0;
      let activeThermalLimit = firstThermalShotLimit;
      let overheatInterruptions = 0;
      let overheatTimeSeconds = 0;
      if (availableShots > 0) magazineStartTimesSeconds.push(0);
      while (availableShots > 0 && shotTime < durationSeconds) {
        shotsFired += 1;
        availableShots -= 1;
        shotsSinceThermalRecovery += 1;

        let waitAfterShot = 1 / shotsPerSecond;
        const recoveryStartsAt = shotTime + waitAfterShot;
        if (activeThermalLimit !== null && shotsSinceThermalRecovery >= activeThermalLimit) {
          if (recoveryStartsAt < durationSeconds) {
            overheatInterruptions += 1;
            overheatTimeSeconds += Math.min(
              thermalRecoverySeconds!,
              durationSeconds - recoveryStartsAt,
            );
          }
          waitAfterShot += thermalRecoverySeconds!;
          shotsSinceThermalRecovery = 0;
          activeThermalLimit = subsequentThermalShotLimit;
        }
        shotTime += waitAfterShot;
      }
      if (availableShots === 0 && shotsFired > 0) completeMagazinesFired = 1;
      if (firstThermalShotLimit !== null) {
        overheatInterruptionsMetric = derived(
          overheatInterruptions,
          "count thermal recovery intervals beginning inside [0, durationSeconds)",
          directInputs,
        );
        overheatTimeSecondsMetric = derived(
          overheatTimeSeconds,
          "sum overlap of overheatRecoverySeconds with [0, durationSeconds)",
          directInputs,
        );
      }
    }
  }

  if (shotsFired === 0 && firstThermalShotLimit !== null) {
    overheatInterruptionsMetric = derived(0, "no shots fired", directInputs);
    overheatTimeSecondsMetric = derived(0, "no shots fired", directInputs);
  }
  const damage = shotsFired * alpha;
  const ammoSources = directInputs.filter((entry) => entry.path.includes("Ammo") || entry.path.includes("ammo"));
  return {
    componentId: component.componentId ?? component.id,
    mountId: component.componentId ? component.id : null,
    mountTopology: component.weaponMountTopology ?? null,
    ammunitionModel: isEnergy ? "energy" : "ballistic",
    allocationRatio: ratioMetric,
    effectiveAmmo: derived(
      effectiveAmmo,
      isEnergy
        ? "round(maxAmmoLoad * allocationRatio) resource units"
        : "ammoCapacity resource units",
      ammoSources,
    ),
    effectiveRegenPerSecond: isEnergy
      ? derived(effectiveRegen ?? 0, "maxRegenPerSecond * allocationRatio", directInputs)
      : unavailable(),
    maxShotsBeforeOverheat: maxShotsBeforeOverheatMetric,
    overheatInterruptions: overheatInterruptionsMetric,
    overheatTimeSeconds: overheatTimeSecondsMetric,
    shotsFired: derived(
      shotsFired,
      "count shot timestamps in half-open interval [0, durationSeconds)",
      directInputs,
    ),
    damage: derived(damage, "shotsFired * alphaDamage", directInputs),
    dps: derived(damage / durationSeconds, "damage / durationSeconds", directInputs),
    completeMagazinesFired,
    magazineStartTimesSeconds,
    directInputs,
    assumptions,
    missingInputs,
  };
}

export function simulateFitting(input: FittingSimulationInput): FittingSimulationResult {
  const durationSeconds = validateInput(input);
  const components = input.components.filter((component) => component.active !== false);
  const directInputs: SimulationSourceFact[] = [];
  const missingInputs: SimulationMissingInput[] = [];
  const assumptions = [
    "Power allocations are capped at the active components' nominal demand.",
    "Cooling demand equals effective allocated consumer power segments in the validated v1 resource model.",
    "Energy weapons wait for a full refill after the regeneration cooldown before firing again.",
  ];
  if (components.some((component) => component.nominalPowerDemandUnitType === "StandardResource")) {
    assumptions.push(
      "Foundry exposes at least one consumer demand as StandardResource rather than power segments; fitting-simulation-v1 applies the empirically validated numeric allocation ratio (assigned segments / summed nominal demand), because Foundry provides no conversion curve.",
    );
  }

  const weaponPowerPoolSegments = isFiniteNonnegative(input.weaponPowerPoolSegments)
    ? input.weaponPowerPoolSegments
    : null;
  const weaponPoolSources = weaponPowerPoolSegments === null
    ? []
    : [source(
        "ship",
        input.weaponPowerPoolSourcePath
          ?? "ship.resourceNetworkPowerPools.fixed[itemType=WeaponGun].poolSize",
        weaponPowerPoolSegments,
      )];
  const weaponPoolCapacityMetric = weaponPowerPoolSegments === null
    ? unavailable()
    : derived(weaponPowerPoolSegments, "Foundry FixedPowerPool poolSize for WeaponGun", weaponPoolSources);
  if (weaponPowerPoolSegments !== null) {
    assumptions.push("Weapon allocation is capped by the extracted WeaponGun FixedPowerPool poolSize.");
  }
  const activeWeaponComponents = components.filter((component) => component.weapon != null);
  const missingWeaponPowerPool = activeWeaponComponents.length > 0 && weaponPowerPoolSegments === null;
  const missingTurretPowerRatio = activeWeaponComponents.some(
    (component) => component.weaponMountTopology === "turret",
  );
  if (missingWeaponPowerPool) {
    missingInputs.push(missing(
      null,
      "ship.resourceNetworkPowerPools.fixed[itemType=WeaponGun].poolSize",
      "An extracted WeaponGun FixedPowerPool is required to bound weapon allocation.",
    ));
  }
  if (missingTurretPowerRatio) {
    missingInputs.push(missing(
      null,
      "ship.resourceNetwork.modifiers.powerRatioMultiplier",
      "An extracted turret power-ratio multiplier is required for ship-wide allocated power and cooling demand.",
    ));
  }

  const allocation = allocatedByCategory(
    components,
    input.powerAllocation ?? {},
    weaponPowerPoolSegments,
  );
  const allocatedSources: SimulationSourceFact[] = [];
  const defaultedAllocationCategories = new Set(input.defaultedPowerAllocationCategories ?? []);
  for (const category of POWER_CATEGORIES) {
    const requested = input.powerAllocation?.[category];
    if (requested !== undefined && !defaultedAllocationCategories.has(category)) {
      allocatedSources.push(source("allocation", `powerAllocation.${category}`, requested));
    }
  }
  for (const category of defaultedAllocationCategories) {
    assumptions.push(
      `The omitted powerAllocation.${category} category was defaulted to 0 for backward compatibility and was not supplied by the caller.`,
    );
  }

  const capacitySources: SimulationSourceFact[] = [];
  let powerCapacity = 0;
  for (const component of components) {
    const capacity = directNumber(component, "powerCapacitySegments", component.powerCapacitySegments, directInputs);
    if (capacity !== null) {
      powerCapacity += capacity;
      capacitySources.push(componentSource(component, "powerCapacitySegments", capacity));
    }
  }
  if (capacitySources.length === 0) {
    missingInputs.push(missing(null, "components[].powerCapacitySegments", "No active power capacity source is available."));
  }

  let hasCompletePowerDemand = true;
  const powerDemandSources: SimulationSourceFact[] = [];
  for (const component of components.filter((entry) => entry.powerCategory != null)) {
    if (!isFiniteNonnegative(component.nominalPowerDemandSegments)) {
      hasCompletePowerDemand = false;
      missingInputs.push(componentMissing(
        component,
        "nominalPowerDemandSegments",
        "Required for allocated power and category allocation ratios.",
      ));
    } else {
      directInputs.push(componentSource(component, "nominalPowerDemandSegments", component.nominalPowerDemandSegments));
      powerDemandSources.push(componentSource(component, "nominalPowerDemandSegments", component.nominalPowerDemandSegments));
    }
  }
  const unmappedPoweredComponents = components.filter(
    (component) => component.powerCategory == null
      && component.componentType !== "power_plant"
      && isFiniteNonnegative(component.nominalPowerDemandSegments)
      && component.nominalPowerDemandSegments > 0,
  );
  if (unmappedPoweredComponents.length > 0) {
    hasCompletePowerDemand = false;
    for (const component of unmappedPoweredComponents) {
      missingInputs.push(componentMissing(
        component,
        "powerCategory",
        `Powered component type ${component.componentType} has no supported allocation category in fitting-simulation-v1.`,
      ));
    }
  }

  const allocatedSegments = sum(Object.values(allocation));
  const powerCapacityMetric = capacitySources.length > 0
    ? derived(powerCapacity, "sum(active powerCapacitySegments)", capacitySources)
    : unavailable();
  const hasCompletePowerAllocation = hasCompletePowerDemand
    && !missingWeaponPowerPool
    && !missingTurretPowerRatio;
  const powerAllocatedMetric = hasCompletePowerAllocation
    ? derived(
        allocatedSegments,
        "sum(min(requested category allocation, active category nominal demand, extracted category power-pool capacity when available))",
        [...allocatedSources, ...weaponPoolSources],
      )
    : unavailable(allocatedSources);
  const powerMarginMetric = powerCapacityMetric.value === null || powerAllocatedMetric.value === null
    ? unavailable([...capacitySources, ...allocatedSources])
    : derived(
        powerCapacityMetric.value - allocatedSegments,
        "power capacity - allocated power",
        [...capacitySources, ...allocatedSources, ...weaponPoolSources],
      );
  const allocationOverCapacity = hasCompletePowerAllocation
    && powerCapacityMetric.value !== null
    && powerAllocatedMetric.value !== null
    && powerAllocatedMetric.value > powerCapacityMetric.value;
  if (allocationOverCapacity) {
    missingInputs.push(missing(
      null,
      "powerAllocation",
      "Requested effective allocation exceeds active reactor capacity; no allocation-priority rule is available.",
    ));
  }
  const allocationUnavailableReason = powerCapacityMetric.value === null
    ? "Active reactor capacity is unavailable."
    : powerAllocatedMetric.value === null
      ? missingTurretPowerRatio
        ? "An extracted ship.resourceNetwork.modifiers.powerRatioMultiplier is required to allocate power across pilot and turret weapons."
        : missingWeaponPowerPool
          ? "An extracted WeaponGun FixedPowerPool is required to bound weapon allocation."
          : "Overall power allocation is incomplete because one or more powered components are not modeled."
      : allocationOverCapacity
        ? "Requested effective allocation exceeds active reactor capacity and no priority rule is available."
        : undefined;

  const coolingCapacitySources: SimulationSourceFact[] = [];
  let coolingCapacity = 0;
  const activeCoolers = components.filter((entry) => entry.componentType === "cooler");
  let hasCompleteCoolingCapacity = activeCoolers.length > 0;
  for (const component of activeCoolers) {
    const capacity = directNumber(component, "coolingCapacity", component.coolingCapacity, directInputs);
    const category = component.powerCategory;
    const nominalDemand = component.nominalPowerDemandSegments;
    if (capacity === null || !category || !isFiniteNonnegative(nominalDemand) || nominalDemand <= 0) {
      hasCompleteCoolingCapacity = false;
      missingInputs.push(componentMissing(
        component,
        capacity === null ? "coolingCapacity" : "nominalPowerDemandSegments",
        "Cooling capacity and a positive cooler power demand are required.",
      ));
      continue;
    }

    const assigned = allocation[category];
    const coolersInCategory = activeCoolers.filter((entry) => entry.powerCategory === category);
    const categoryDemand = categoryNominalDemand(components, category);
    if (coolersInCategory.length > 1 && assigned > 0 && assigned < categoryDemand) {
      hasCompleteCoolingCapacity = false;
      missingInputs.push(componentMissing(
        component,
        `powerAllocation.${category}`,
        `Allocation ${assigned} is shared by ${coolersInCategory.length} coolers, but no per-cooler distribution rule is available.`,
      ));
      continue;
    }
    let effectiveCapacity: number | null = null;
    let capacityPath = "coolingCapacity";
    if (assigned === 0) {
      effectiveCapacity = 0;
      capacityPath = `powerAllocation.${category}`;
    } else {
      const exact = coolersInCategory.length === 1
        ? component.coolingCapacityByPowerAllocation?.find(
            (entry) => Math.abs(entry.allocation - assigned) < 1e-9,
          )
        : undefined;
      if (exact) {
        effectiveCapacity = exact.capacity;
        capacityPath = `coolingCapacityByPowerAllocation[allocation=${exact.allocation}]`;
      } else if (assigned >= categoryDemand) {
        effectiveCapacity = capacity;
      }
    }

    if (effectiveCapacity === null) {
      hasCompleteCoolingCapacity = false;
      missingInputs.push(componentMissing(
        component,
        "coolingCapacityByPowerAllocation",
        `No extracted cooler-output value is available for allocation ${assigned}.`,
      ));
      continue;
    }
    coolingCapacity += effectiveCapacity;
    if (assigned === 0) {
      const allocationSource = allocatedSources.find(
        (entry) => entry.path === `powerAllocation.${category}`,
      );
      if (allocationSource) coolingCapacitySources.push(allocationSource);
    } else {
      coolingCapacitySources.push(componentSource(component, capacityPath, effectiveCapacity));
    }
  }
  if (activeCoolers.length === 0) {
    missingInputs.push(missing(null, "components[componentType=cooler]", "No active cooler is available."));
  }

  const coolingCapacityMetric = hasCompleteCoolingCapacity
    ? derived(coolingCapacity, "sum(cooler capacity at effective power allocation)", coolingCapacitySources)
    : unavailable(coolingCapacitySources);
  const coolingDemandSources = [...powerDemandSources, ...allocatedSources, ...weaponPoolSources];
  const coolingDemandMetric = hasCompletePowerAllocation && !allocationOverCapacity
    ? derived(
        allocatedSegments,
        "sum(effective allocated consumer power segments)",
        coolingDemandSources,
      )
    : unavailable(coolingDemandSources);
  const coolingUtilizationMetric = coolingCapacityMetric.value !== null
    && coolingDemandMetric.value !== null
    && coolingCapacityMetric.value > 0
    ? derived(
        coolingDemandMetric.value / coolingCapacityMetric.value * 100,
        "cooling demand / cooling capacity * 100",
        [...coolingDemandSources, ...coolingCapacitySources],
      )
    : unavailable([...coolingDemandSources, ...coolingCapacitySources]);

  const activeShields = components.filter((component) => component.shield != null);
  const shieldMaxSources: SimulationSourceFact[] = [];
  let maxShieldRegen = 0;
  let hasCompleteShieldMaximum = activeShields.length > 0;
  for (const component of activeShields) {
    const value = component.shield?.maxRegenPerSecond;
    if (!isFiniteNonnegative(value)) {
      hasCompleteShieldMaximum = false;
      missingInputs.push(componentMissing(
        component,
        "shield.maxRegenPerSecond",
        "Maximum shield regeneration is unavailable for this active generator.",
      ));
      continue;
    }
    const fact = componentSource(
      component,
      component.shield?.maxRegenSourcePath ?? "shield.maxRegenPerSecond",
      value,
    );
    maxShieldRegen += value;
    shieldMaxSources.push(fact);
    directInputs.push(fact);
  }
  const maxShieldRegenMetric = hasCompleteShieldMaximum
    ? derived(maxShieldRegen, "sum(active shield maximum regeneration)", shieldMaxSources)
    : unavailable(shieldMaxSources);

  const shieldAllocationSources = allocatedSources.filter(
    (entry) => entry.path === "powerAllocation.shields",
  );
  const assignedShieldPower = allocation.shields;
  let effectiveShieldRegenMetric: SimulationMetric;
  if (activeShields.length === 0) {
    effectiveShieldRegenMetric = unavailable();
  } else if (allocationUnavailableReason) {
    effectiveShieldRegenMetric = unavailable([...shieldMaxSources, ...shieldAllocationSources]);
  } else if (assignedShieldPower === 0) {
    effectiveShieldRegenMetric = derived(
      0,
      "zero shield allocation produces zero regeneration",
      shieldAllocationSources,
    );
  } else {
    const shieldDemandSources: SimulationSourceFact[] = [];
    let totalShieldDemand = 0;
    let hasCompleteShieldDemand = true;
    for (const component of activeShields) {
      if (!isFiniteNonnegative(component.nominalPowerDemandSegments) || component.nominalPowerDemandSegments <= 0) {
        hasCompleteShieldDemand = false;
        missingInputs.push(componentMissing(
          component,
          "nominalPowerDemandSegments",
          "A positive shield power demand is required to resolve allocation-adjusted regeneration.",
        ));
        continue;
      }
      totalShieldDemand += component.nominalPowerDemandSegments;
      shieldDemandSources.push(componentSource(component, "nominalPowerDemandSegments", component.nominalPowerDemandSegments));
    }

    if (!hasCompleteShieldDemand) {
      effectiveShieldRegenMetric = unavailable([...shieldDemandSources, ...shieldAllocationSources]);
    } else if (assignedShieldPower >= totalShieldDemand) {
      effectiveShieldRegenMetric = hasCompleteShieldMaximum
        ? derived(
            maxShieldRegen,
            "sum(active shield maximum regeneration) at full shield allocation",
            [...shieldMaxSources, ...shieldDemandSources, ...shieldAllocationSources],
          )
        : unavailable([...shieldMaxSources, ...shieldDemandSources, ...shieldAllocationSources]);
    } else if (activeShields.length > 1) {
      missingInputs.push(missing(
        null,
        "powerAllocation.shields",
        `Allocation ${assignedShieldPower} is shared by ${activeShields.length} shield generators, but no per-generator distribution rule is available.`,
      ));
      effectiveShieldRegenMetric = unavailable([...shieldDemandSources, ...shieldAllocationSources]);
    } else {
      const component = activeShields[0];
      const exact = component.shield?.regenByPowerAllocation?.find(
        (entry) => isFiniteNonnegative(entry.allocation)
          && isFiniteNonnegative(entry.value)
          && Math.abs(entry.allocation - assignedShieldPower) < 1e-9,
      );
      if (!exact) {
        missingInputs.push(componentMissing(
          component,
          "shield.regenByPowerAllocation",
          `No extracted shield-regeneration value is available for allocation ${assignedShieldPower}.`,
        ));
        effectiveShieldRegenMetric = unavailable([...shieldDemandSources, ...shieldAllocationSources]);
      } else {
        const exactAllocationSource = componentSource(
          component,
          exact.allocationSourcePath ?? `shield.regenByPowerAllocation[allocation=${exact.allocation}].allocation`,
          exact.allocation,
        );
        const exactValueSource = componentSource(
          component,
          exact.valueSourcePath ?? `shield.regenByPowerAllocation[allocation=${exact.allocation}].value`,
          exact.value,
        );
        directInputs.push(exactAllocationSource, exactValueSource);
        effectiveShieldRegenMetric = derived(
          exact.value,
          "exact extracted shield regeneration at assigned allocation",
          [exactAllocationSource, exactValueSource, ...shieldDemandSources, ...shieldAllocationSources],
        );
      }
    }
  }

  const activeWeapons = activeWeaponComponents;
  const weaponDemandSources: SimulationSourceFact[] = [];
  let weaponNominalDemand = 0;
  let hasCompleteWeaponDemand = true;
  for (const component of activeWeapons) {
    if (!isFiniteNonnegative(component.nominalPowerDemandSegments)) {
      hasCompleteWeaponDemand = false;
      continue;
    }
    weaponNominalDemand += component.nominalPowerDemandSegments;
    weaponDemandSources.push(componentSource(component, "nominalPowerDemandSegments", component.nominalPowerDemandSegments));
  }
  const weaponAllocationSources = allocatedSources.filter(
    (entry) => entry.path === "powerAllocation.weapons",
  );
  const weaponNetworkUnavailableReason = allocationUnavailableReason;
  const weaponAllocationRatio = !weaponNetworkUnavailableReason
    && hasCompleteWeaponDemand
    && weaponNominalDemand > 0
    ? Math.min(1, allocation.weapons / weaponNominalDemand)
    : null;
  const weapons = activeWeapons.map((component) => simulateWeapon({
    component,
    durationSeconds,
    weaponAllocationRatio,
    allocationSources: [...weaponDemandSources, ...weaponAllocationSources, ...weaponPoolSources],
    allocationUnavailableReason: weaponNetworkUnavailableReason,
  }));

  for (const weapon of weapons) {
    directInputs.push(...weapon.directInputs);
    missingInputs.push(...weapon.missingInputs);
    assumptions.push(...weapon.assumptions);
  }

  const simulatedWeapons = weapons.filter((weapon) => weapon.dps.value !== null);
  const hasCompleteWeaponResults = simulatedWeapons.length === weapons.length;
  const weaponSummarySources = weapons.flatMap((weapon) => weapon.directInputs);
  const totalWeaponDamage = sum(
    simulatedWeapons.map((weapon) => weapon.damage.value ?? 0),
  );
  const weaponsSummary = {
    simulatedWeaponCount: derived(
      simulatedWeapons.length,
      "count(weapons with available simulation results)",
      weaponSummarySources,
    ),
    totalDamage: hasCompleteWeaponResults
      ? derived(totalWeaponDamage, "sum(per-weapon damage)", weaponSummarySources)
      : unavailable(weaponSummarySources),
    dps: hasCompleteWeaponResults
      ? derived(totalWeaponDamage / durationSeconds, "total weapon damage / durationSeconds", weaponSummarySources)
      : unavailable(weaponSummarySources),
  };

  return {
    modelVersion: FITTING_SIMULATION_MODEL_VERSION,
    durationSeconds,
    power: {
      capacitySegments: powerCapacityMetric,
      weaponPoolCapacitySegments: weaponPoolCapacityMetric,
      allocatedSegments: powerAllocatedMetric,
      marginSegments: powerMarginMetric,
      allocatedByCategory: allocation,
    },
    cooling: {
      capacity: coolingCapacityMetric,
      demand: coolingDemandMetric,
      utilizationPercent: coolingUtilizationMetric,
    },
    shields: {
      maxRegenPerSecond: maxShieldRegenMetric,
      effectiveRegenPerSecond: effectiveShieldRegenMetric,
    },
    weapons,
    weaponsSummary,
    provenance: {
      directInputs,
      derivedModel: FITTING_SIMULATION_MODEL_VERSION,
    },
    assumptions: [...new Set(assumptions)],
    missingInputs,
  };
}
