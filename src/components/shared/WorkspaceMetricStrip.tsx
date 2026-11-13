import type { HTMLAttributes } from "react";

/** Unified metric-bar surface; grid tracks and live values remain controlled by each feature. */
export type WorkspaceMetricStripProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "dl";
};

export default function WorkspaceMetricStrip({
  as: Element = "div",
  className,
  children,
  ...props
}: WorkspaceMetricStripProps) {
  return (
    <Element {...props} data-workspace-metrics="" className={["workspace-metric-strip", className].filter(Boolean).join(" ")}>
      {children}
    </Element>
  );
}
