import type { PipCategory } from "../../../lib/fitting/fittingTerminalTypes";
import SystemIcon, { type SystemIconKind } from "./SystemIcon";

function pipCategoryToSystemIconKind(category: PipCategory): SystemIconKind {
  if (category === "cooler1" || category === "cooler2") return "cooler";
  return category;
}

type PowerPipIconProps = {
  category: PipCategory;
  kind?: SystemIconKind;
  className?: string;
};

export default function PowerPipIcon({ category, kind, className }: PowerPipIconProps) {
  return <SystemIcon kind={kind ?? pipCategoryToSystemIconKind(category)} className={className} />;
}
