import type { PipCategory } from "../fittingTerminalTypes";

/** Display label for an existing power allocation channel. */
export function resolvePowerChannelLabel(channel: PipCategory): string {
  switch (channel) {
    case "weapons":
      return "WPN";
    case "engines":
      return "ENG";
    case "quantum":
      return "QT";
    case "radar":
      return "RDR";
    case "lifeSupport":
      return "LS";
    case "cooler1":
      return "C1";
    case "cooler2":
      return "C2";
    default:
      return channel;
  }
}
