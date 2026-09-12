import handMiningMultitoolIcon from "../../../assets/mining/methods/hand-mining-multitool.png";
import surfaceShipMiningIcon from "../../../assets/mining/methods/surface-ship-mining-ship.png";
import vehicleMiningExosuitIcon from "../../../assets/mining/methods/vehicle-mining-exosuit.png";

const MINING_METHOD_ICON_ASSETS = {
  hand: handMiningMultitoolIcon,
  ship: surfaceShipMiningIcon,
  vehicle: vehicleMiningExosuitIcon,
} as const;

function miningMethodIconKey(method: string | null | undefined): keyof typeof MINING_METHOD_ICON_ASSETS | null {
  const normalized = method?.toLowerCase() ?? "";
  if (normalized.includes("hand")) return "hand";
  if (normalized.includes("vehicle")) return "vehicle";
  if (normalized.includes("ship") || normalized.includes("surface") || normalized.includes("space")) return "ship";
  return null;
}

export default function MiningMethodIcon({ method, className = "mdet-method-icon" }: { method: string | null | undefined; className?: string }) {
  const methodKey = miningMethodIconKey(method);
  if (!methodKey) return null;
  return <img className={`${className} ${className}--${methodKey}`} src={MINING_METHOD_ICON_ASSETS[methodKey]} alt="" aria-hidden="true" />;
}
