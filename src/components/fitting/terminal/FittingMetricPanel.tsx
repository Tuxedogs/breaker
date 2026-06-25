import type { ReactNode } from "react";

type FittingMetricPanelProps = {
  title: string;
  badge?: string;
  children: ReactNode;
  action?: ReactNode;
};

export default function FittingMetricPanel({ title, badge, children, action }: FittingMetricPanelProps) {
  return (
    <article className="fit-term-metric">
      <header className="fit-term-metric-head">
        <h3>{title}</h3>
        {badge && <span className="fit-term-metric-badge">{badge}</span>}
        {action}
      </header>
      <div className="fit-term-metric-body">{children}</div>
    </article>
  );
}
