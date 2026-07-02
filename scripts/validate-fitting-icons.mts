import { resolveCraftedItemIcon } from "../src/lib/fitting/resolveCraftedItemIcon.ts";
import { resolveFittingComponentIcon } from "../src/lib/fitting/resolveFittingComponentIcon.ts";

function assertContains(label: string, value: string, needle: string) {
  if (!value.includes(needle)) {
    throw new Error(`${label}: expected "${value}" to include "${needle}"`);
  }
}

const cases = [
  {
    label: "Deadbolt S1 auto accent",
    input: { componentType: "ship_weapon", componentName: "Deadbolt I Cannon", size: 1, preferredMode: "auto" as const },
    expectMode: "accent",
    expectPath: "deadboltS1_accent",
  },
  {
    label: "Deadbolt S3 size-specific",
    input: { componentType: "ship_weapon", componentName: "Deadbolt III Cannon", size: 3, preferredMode: "auto" as const },
    expectMode: "accent",
    expectPath: "deadboltS3_accent",
  },
  {
    label: "Deadbolt S2 accent available",
    input: { componentType: "ship_weapon", componentName: "Deadbolt II Cannon", size: 2, preferredMode: "accent" as const },
    expectMode: "accent",
    expectPath: "deadboltS2_accent",
  },
  {
    label: "S1 shield auto accent",
    input: { componentType: "shield", componentName: "Bulwark", size: 1, preferredMode: "auto" as const },
    expectMode: "accent",
    expectPath: "shieldGeneratorS1_accent",
  },
  {
    label: "S1 cooler auto mono",
    input: { componentType: "cooler", componentName: "IcePlunge", size: 1, preferredMode: "auto" as const },
    expectMode: "mono",
    expectPath: "coolerS1_mono",
  },
  {
    label: "S1 quantum drive auto mono",
    input: { componentType: "quantum_drive", componentName: "XL-1", size: 1, preferredMode: "auto" as const },
    expectMode: "mono",
    expectPath: "s1QuantumDrive_outline-mono",
  },
  {
    label: "S3 quantum drive auto accent fallback",
    input: { componentType: "quantum_drive", componentName: "TS-3 Quantum Drive", size: 3, preferredMode: "auto" as const },
    expectMode: "accent",
    expectPath: "s3QuantumDrive_outline-accent",
  },
  {
    label: "S2 quantum drive keeps S1 icon",
    input: { componentType: "quantum_drive", componentName: "TS-2 Quantum Drive", size: 2, preferredMode: "auto" as const },
    expectMode: "mono",
    expectPath: "s1QuantumDrive_outline-mono",
  },
  {
    label: "S4 quantum drive keeps S1 icon",
    input: { componentType: "quantum_drive", componentName: "VK-44 Quantum Drive", size: 4, preferredMode: "auto" as const },
    expectMode: "mono",
    expectPath: "s1QuantumDrive_outline-mono",
  },
  {
    label: "quantumdrive category S3 via component cards",
    input: { componentType: "quantumdrive", componentName: "Colossus QD", size: 3, preferredMode: "auto" as const },
    expectMode: "accent",
    expectPath: "s3QuantumDrive_outline-accent",
  },
  {
    label: "CF-337 Panther Repeater S3 accent",
    input: { componentType: "ship_weapon", componentName: "CF-337 Panther Repeater", size: 3, preferredMode: "auto" as const },
    expectMode: "accent",
    expectPath: "cfRepeaterS3_accent",
  },
  {
    label: "C-788 Cannon S4 accent",
    input: { componentType: "ship_weapon", componentName: "C-788 Cannon", size: 4, preferredMode: "auto" as const },
    expectMode: "accent",
    expectPath: "c788S4_accent",
  },
  {
    label: "S1 power plant auto mono",
    input: { componentType: "powerplant", componentName: "Fierell Cascade", size: 1, preferredMode: "auto" as const },
    expectMode: "mono",
    expectPath: "powerPlantS1_mono",
  },
  {
    label: "Global accent override on cooler",
    input: { componentType: "cooler", componentName: "IcePlunge", size: 1, preferredMode: "accent" as const },
    expectMode: "mono",
    expectPath: "coolerS1_mono",
  },
  {
    label: "Global mono override on shield",
    input: { componentType: "shield", componentName: "Bulwark", size: 1, preferredMode: "mono" as const },
    expectMode: "mono",
    expectPath: "shieldGeneratorS1_mono",
  },
] as const;

for (const testCase of cases) {
  const result = resolveFittingComponentIcon(testCase.input);
  if (result.resolvedMode !== testCase.expectMode) {
    throw new Error(`${testCase.label}: expected mode ${testCase.expectMode}, got ${result.resolvedMode} (${result.reason ?? "no reason"})`);
  }
  assertContains(testCase.label, result.src, testCase.expectPath);
  console.log(`ok ${testCase.label}`);
}

const craftedCases = [
  {
    label: "Quadracell MX powerplant mono",
    input: { itemName: "Quadracell MX", category: "ship_part", preferredMode: "auto" as const },
    expectMode: "mono",
    expectPath: "quadracellS3_mono",
  },
  {
    label: "Quadracell MT powerplant accent",
    input: { itemName: "Quadracell MT", category: "ship_part", preferredMode: "accent" as const },
    expectMode: "accent",
    expectPath: "quadracellS2_accent",
  },
  {
    label: "TS-2 quantum drive accent",
    input: { itemName: "TS-2", category: "ship_part", preferredMode: "auto" as const },
    expectMode: "accent",
    expectPath: "s3QuantumDrive_outline-accent",
  },
  {
    label: "A03 Sniper Rifle manifest accent",
    input: { itemName: "A03 Sniper Rifle", category: "weapon", preferredMode: "auto" as const },
    expectMode: "accent",
    expectPath: "a03Sniper_accent",
  },
  {
    label: "P6-LR Sniper Rifle manifest mono",
    input: { itemName: "P6-LR Sniper Rifle", category: "weapon", preferredMode: "auto" as const },
    expectMode: "mono",
    expectPath: "p6lrSniper_mono",
  },
  {
    label: "Morozov-SH Core torso accent",
    input: { itemName: "Morozov-SH Core", category: "armor", preferredMode: "auto" as const },
    expectMode: "accent",
    expectPath: "morozovTorso_outline",
  },
  {
    label: "VB80112 radar mono",
    input: { itemName: "VB80112", category: "ship_part", preferredMode: "auto" as const },
    expectMode: "placeholder",
    expectPath: "turret.webp",
  },
] as const;

for (const testCase of craftedCases) {
  const result = resolveCraftedItemIcon(testCase.input);
  if (!result.src) throw new Error(`${testCase.label}: expected src`);
  if (result.resolvedMode !== testCase.expectMode) {
    throw new Error(`${testCase.label}: expected mode ${testCase.expectMode}, got ${result.resolvedMode}`);
  }
  assertContains(testCase.label, result.src, testCase.expectPath);
  console.log(`ok ${testCase.label}`);
}

console.log("fitting icon resolver validation passed");