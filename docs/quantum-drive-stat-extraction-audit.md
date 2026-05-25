# Quantum Drive Stat Extraction Audit

## Scope

- Category: vehicle `quantumdrive`
- Primary foundry source: `D:\scintel\data\libs\foundry\records\entities\scitem\ships\quantumdrive`
- Generator updated: `scripts/generate-component-card-index.ts`
- Generated index updated: `public/api/crafting/component_card_index.json`
- UI, CSS, selectors, layouts, and routes were not changed.

## Source Records

Audited foundry quantum drive records with `SCItemQuantumDriveParams`:

- Foundry XML records loaded: 63
- Craftable quantum drive blueprints: 57
- Joined craftable records: 57
- Unjoined XML records: 8 non-craftable/template or non-index records:
  - `qdrv_aegs_s04_javelin_scitem.xml`
  - `qdrv_just_s01_goliath_scitem.xml`
  - `qdrv_s01_template.xml`
  - `qdrv_s02_template.xml`
  - `qdrv_s03_template.xml`
  - `qdrv_s04_template.xml`
  - `qdrv_s04_vncl_mauler.xml`
  - `qdrv_wetk_s01_beacon_scitem.xml`

## Join Key Proof

The safe join key is:

- `public/api/crafting/blueprints.json[].entityClass`
- equals foundry XML root `EntityClassDefinition.*@__ref`

Proof from audit:

- `componentType === "quantumdrive"` blueprint count: 57
- XML records with `SCItemQuantumDriveParams`: 63
- Blueprint `entityClass` values matched to XML `__ref`: 57/57
- Missing craftable joins: 0

Example:

- Atlas blueprint `entityClass`: `934ac478-9c87-48d1-8fd3-e5359171983c`
- Atlas XML: `qdrv_rsi_s01_atlas_scitem.xml`
- Atlas XML root `__ref`: `934ac478-9c87-48d1-8fd3-e5359171983c`

## Field Safety And Transforms

All populated fields are parsed directly from the joined XML record except min resource usage, which follows the existing shield pattern of multiplying maximum resource units by `minimumConsumptionFraction`.

| Index field | Source | Safety |
| --- | --- | --- |
| `fuelEfficiency` | No direct XML field found | Not populated; remains `null` |
| `quantumFuelRequirement` | `SCItemQuantumDriveParams@quantumFuelRequirement` | Safe parse number |
| `quantumFuelConsumptionRate` | `ItemResourceState[name=Travelling]` `QuantumFuel` `SMicroResourceUnit@microResourceUnits` | Safe parse number |
| `normalJumpSpeed` | `SCItemQuantumDriveParams/params@driveSpeed` | Safe parse number |
| `splineJumpSpeed` | `SCItemQuantumDriveParams/splineJumpParams@driveSpeed` | Safe parse number |
| `spoolTime` | `SCItemQuantumDriveParams/params@spoolUpTime` | Safe parse number |
| `cooldown` | `SCItemQuantumDriveParams/params@cooldownTime` | Safe parse number |
| `splineCooldown` | `SCItemQuantumDriveParams/splineJumpParams@cooldownTime` | Safe parse number |
| `calibrationRequirementMin` | `SCItemQuantumDriveParams/params@minCalibrationRequirement` | Safe parse number |
| `calibrationRequirementMax` | `SCItemQuantumDriveParams/params@maxCalibrationRequirement` | Safe parse number |
| `calibrationAngleMin` | `SCItemQuantumDriveParams/params@calibrationProcessAngleLimit` | Caution: XML calls this process angle, not min |
| `calibrationAngleMax` | `SCItemQuantumDriveParams/params@calibrationWarningAngleLimit` | Caution: XML calls this warning angle, not max |
| `calibrationDelay` | `SCItemQuantumDriveParams/params@calibrationDelayInSeconds` | Safe parse number |
| `calibrationRate` | `SCItemQuantumDriveParams/params@calibrationRate` | Safe parse number |
| `stageOneAcceleration` | `SCItemQuantumDriveParams/params@stageOneAccelRate` | Safe parse number |
| `stageTwoAcceleration` | `SCItemQuantumDriveParams/params@stageTwoAccelRate` | Safe parse number |
| `engageSpeed` | `SCItemQuantumDriveParams/params@engageSpeed` | Safe parse number |
| `interdictionEffectTime` | `SCItemQuantumDriveParams/params@interdictionEffectTime` | Safe parse number |
| `powerUsageMin` | Online Power units * `minimumConsumptionFraction` | Caution: derived |
| `powerUsageMax` | Online Power `SStandardResourceUnit@standardResourceUnits` | Safe parse number |
| `coolantUsageMin` | Online Coolant units * `minimumConsumptionFraction` | Caution: derived |
| `coolantUsageMax` | Online Coolant `SStandardResourceUnit@standardResourceUnits` | Safe parse number |
| `onlineEmSignature` | Online `EMSignature@nominalSignature` | Safe parse number |
| `onlineIrSignature` | Online `IRSignature@nominalSignature` | Safe parse number |
| `travellingEmSignature` | Travelling `EMSignature@nominalSignature` | Safe parse number |
| `travellingIrSignature` | Travelling `IRSignature@nominalSignature` | Safe parse number |

## Populated Field Counts

Generated output after extraction:

```text
quantum drive foundry records loaded: 63
quantum drive records joined: 57
quantum drive populated fields:
{
  "fuelEfficiency": 0,
  "quantumFuelRequirement": 57,
  "quantumFuelConsumptionRate": 57,
  "normalJumpSpeed": 57,
  "splineJumpSpeed": 57,
  "spoolTime": 57,
  "cooldown": 57,
  "splineCooldown": 57,
  "calibrationRequirementMin": 57,
  "calibrationRequirementMax": 57,
  "calibrationAngleMin": 57,
  "calibrationAngleMax": 57,
  "calibrationDelay": 57,
  "calibrationRate": 57,
  "stageOneAcceleration": 57,
  "stageTwoAcceleration": 57,
  "engageSpeed": 57,
  "interdictionEffectTime": 57,
  "powerUsageMin": 57,
  "powerUsageMax": 57,
  "coolantUsageMin": 57,
  "coolantUsageMax": 57,
  "onlineEmSignature": 57,
  "onlineIrSignature": 57,
  "travellingEmSignature": 57,
  "travellingIrSignature": 57
}
```

## Before / After Examples

Before this extraction, `buildVehicleRecord` emitted `stats.quantumDrive: null` for all vehicle records.

After extraction:

```json
{
  "name": "Atlas",
  "entityClass": "934ac478-9c87-48d1-8fd3-e5359171983c",
  "quantumDrive": {
    "fuelEfficiency": null,
    "quantumFuelRequirement": 0.007546,
    "quantumFuelConsumptionRate": 14,
    "normalJumpSpeed": 231000000,
    "splineJumpSpeed": 500000,
    "spoolTime": 4,
    "cooldown": 8.7,
    "splineCooldown": 10,
    "calibrationRequirementMin": 5000,
    "calibrationRequirementMax": 10000,
    "calibrationAngleMin": 5,
    "calibrationAngleMax": 8,
    "calibrationDelay": 1.5,
    "calibrationRate": 1000,
    "stageOneAcceleration": 7000000,
    "stageTwoAcceleration": 21000000,
    "engageSpeed": 1500,
    "interdictionEffectTime": 3,
    "powerUsageMin": 2,
    "powerUsageMax": 2,
    "coolantUsageMin": 0,
    "coolantUsageMax": 0,
    "onlineEmSignature": 18000,
    "onlineIrSignature": 0,
    "travellingEmSignature": 18000,
    "travellingIrSignature": 0
  }
}
```

```json
{
  "name": "VK-00",
  "entityClass": "995c2de5-f7e6-4646-83e3-4627ba5a5865",
  "quantumDrive": {
    "fuelEfficiency": null,
    "quantumFuelRequirement": 0.02156,
    "quantumFuelConsumptionRate": 14,
    "normalJumpSpeed": 266000000,
    "splineJumpSpeed": 500000,
    "spoolTime": 4,
    "cooldown": 12.7,
    "splineCooldown": 10,
    "stageOneAcceleration": 8050000,
    "stageTwoAcceleration": 24200000,
    "powerUsageMax": 3,
    "coolantUsageMax": 0,
    "onlineEmSignature": 18800,
    "travellingEmSignature": 18800
  }
}
```

```json
{
  "name": "XL1",
  "quantumDrive": {
    "fuelEfficiency": null,
    "quantumFuelRequirement": 0.02398,
    "quantumFuelConsumptionRate": 11,
    "normalJumpSpeed": 324000000,
    "splineJumpSpeed": 400000,
    "spoolTime": 6,
    "cooldown": 22.86,
    "splineCooldown": 22.86
  }
}
```

## Validation Notes

- Generic stats remain under `stats.generic`.
- Quantum-drive performance stats are under `stats.quantumDrive`.
- Source metadata includes the foundry XML file and field mappings.
- Source warnings preserve caution cases and explicitly state why `fuelEfficiency` remains null.
- No UI/card layout/CSS/route files were changed for this extraction.
