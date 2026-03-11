import { Link } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";

type SectionHubCardProps = {
  title: string;
  subtitle: string;
  icon: ReactNode;
  href: string;
  accentColor: string;
  isActive?: boolean;
  variant?: "default" | "maps";
};

export default function SectionHubCard({
  title,
  subtitle,
  icon,
  href,
  accentColor,
  isActive = false,
  variant = "default",
}: SectionHubCardProps) {
  return (
    <Link
      to={href}
      className={`section-hub-card ${variant === "maps" ? "section-hub-card-maps" : ""} ${isActive ? "is-active" : ""}`}
      style={{ "--hub-accent": accentColor } as CSSProperties}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="section-hub-icon-wrap" aria-hidden="true">
        {icon}
      </span>
      <span className="section-hub-copy">
        <span className="title-font section-hub-title">{title}</span>
        <span className="section-hub-subtitle">{subtitle}</span>
      </span>
      <span className="section-hub-indicator" aria-hidden="true" />
    </Link>
  );
}
