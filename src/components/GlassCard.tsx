import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";

type GlassCardProps = {
  accentColor: string;
  accentSoft: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaTo: string;
  children: ReactNode;
};

export default function GlassCard({
  accentColor,
  accentSoft,
  title,
  subtitle,
  ctaLabel,
  ctaTo,
  children,
}: GlassCardProps) {
  const accentStyle = {
    "--accent": accentColor,
    "--accent-soft": accentSoft,
  } as CSSProperties;

  return (
    <article style={accentStyle} className="glass-accent-card flex h-full flex-col rounded-3xl p-6">
      <header className="pb-5">
        <h2 className="title-font text-3xl tracking-[0.2em] text-white">{title}</h2>
        <p className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-300">{subtitle}</p>
      </header>

      <div>{children}</div>

      <div className="mt-auto pt-6">
        <Link to={ctaTo} className="accent-cta block w-full rounded-xl px-4 py-3 text-center text-sm font-medium uppercase tracking-[0.2em]">
          {ctaLabel}
        </Link>
      </div>
    </article>
  );
}
