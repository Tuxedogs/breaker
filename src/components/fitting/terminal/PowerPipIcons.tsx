import type { PipCategory } from "../../../lib/fitting/fittingTerminalTypes";
import SystemIcon, { pipCategoryToSystemIconKind, type SystemIconKind } from "./SystemIcon";

export type { SystemIconKind };
export { SystemIcon, pipCategoryToSystemIconKind };

type PowerPipIconProps = {
  category: PipCategory;
  className?: string;
};

export default function PowerPipIcon({ category, className }: PowerPipIconProps) {
  return <SystemIcon kind={pipCategoryToSystemIconKind(category)} className={className} />;
}
