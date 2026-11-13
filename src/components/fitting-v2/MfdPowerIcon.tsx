import type { SystemIconKind } from "../fitting/terminal/SystemIcon";

const ICON_FILES: Record<SystemIconKind, string> = {
  weapons: "wep.svg",
  engines: "eng.svg",
  shields: "SHD.svg",
  quantum: "QT.svg",
  qed: "QED.svg",
  emp: "EMP.svg",
  radar: "RDR.svg",
  lifeSupport: "CLR.svg",
  cooler: "CLR.svg",
};

export default function MfdPowerIcon({ kind, className = "" }: { kind: SystemIconKind; className?: string }) {
  return <img className={className} src={`/images/fitting-v2/mfd/${ICON_FILES[kind]}`} alt="" />;
}
