import handMiningMultitoolIcon from "../../../assets/mining/methods/hand-mining-multitool.png";
import surfaceShipMiningIcon from "../../../assets/mining/methods/surface-ship-mining-ship.png";
import vehicleMiningExosuitIcon from "../../../assets/mining/methods/vehicle-mining-exosuit.png";
import type { MiningMethodIconKey } from "./miningMethodPresentation";

const MINING_METHOD_ICON_ASSETS: Record<MiningMethodIconKey, string> = {
  hand: handMiningMultitoolIcon,
  ship: surfaceShipMiningIcon,
  vehicle: vehicleMiningExosuitIcon,
};

export default function MiningMethodIcon({
  methodKey,
  className = "mdet-method-icon",
}: {
  methodKey: MiningMethodIconKey;
  className?: string;
}) {
  return (
    <img
      className={`${className} ${className}--${methodKey}`}
      src={MINING_METHOD_ICON_ASSETS[methodKey]}
      alt=""
      aria-hidden="true"
    />
  );
}
