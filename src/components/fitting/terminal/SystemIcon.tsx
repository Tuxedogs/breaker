import type { ComponentType, SVGProps } from "react";
import EnginesIcon from "@/assets/icons/sc-system/sc-system-engines.svg?react";
import WeaponsIcon from "@/assets/icons/sc-system/sc-system-weapons.svg?react";
import QuantumIcon from "@/assets/icons/sc-system/sc-system-quantum.svg?react";
import LifeSupportIcon from "@/assets/icons/sc-system/sc-system-life-support.svg?react";
import RadarIcon from "@/assets/icons/sc-system/sc-system-radar.svg?react";
import CoolerIcon from "@/assets/icons/sc-system/sc-system-cooler.svg?react";

/** Semantic ship system icon kinds for the fitting terminal. */
export type SystemIconKind =
  | "engines"
  | "weapons"
  | "quantum"
  | "lifeSupport"
  | "radar"
  | "cooler";

const SYSTEM_ICONS: Record<SystemIconKind, ComponentType<SVGProps<SVGSVGElement>>> = {
  engines: EnginesIcon,
  weapons: WeaponsIcon,
  quantum: QuantumIcon,
  lifeSupport: LifeSupportIcon,
  radar: RadarIcon,
  cooler: CoolerIcon,
};

type SystemIconProps = {
  kind: SystemIconKind;
  className?: string;
};

export default function SystemIcon({ kind, className }: SystemIconProps) {
  const Icon = SYSTEM_ICONS[kind];
  return <Icon className={className} aria-hidden />;
}
