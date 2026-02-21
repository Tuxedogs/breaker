import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export type IndexListItem = {
  label: string;
  to: string;
  description?: string;
  icon?: ReactNode;
  children?: IndexListItem[];
};

type IndexListProps = {
  items: IndexListItem[];
  shipsStyle?: boolean;
  compactOnShortViewport?: boolean;
};

function Chevron() {
  return (
    <span
      aria-hidden
      className="ml-3 inline-flex items-center justify-center text-lg leading-none"
      style={{
        color: "color-mix(in srgb, var(--accent) 84%, white 16%)",
      }}
    >
      &#8250;
    </span>
  );
}

function IndexRow({
  item,
  nested = false,
  shipsStyle = false,
}: {
  item: IndexListItem;
  nested?: boolean;
  shipsStyle?: boolean;
}) {
  return (
    <div className={nested ? "ml-6" : ""}>
      <Link
        to={item.to}
        className={[
          "group relative flex w-full items-center justify-between rounded-xl",
          "px-4",
          nested ? "py-2.5 text-sm" : "py-3 text-base",
          "transition-all duration-250 ease-out will-change-transform",
          "hover:-translate-y-[1px]",
          // Make rows feel like real UI surfaces
          "border border-black/50 bg-black/25 backdrop-blur-xl",
          "hover:border-black/35",
          shipsStyle ? "rounded-md" : "",
        ].join(" ")}
        style={{
          // subtle inner edge + controlled glow using card vars
          boxShadow: nested
            ? "0 0 0 1px rgba(255,255,255,0.03) inset"
            : shipsStyle
              ? "0 0 0 1px color-mix(in srgb, var(--accent) 20%, rgba(0,0,0,0.82) 80%) inset, 0 0 0 1px rgba(0,0,0,0.52)"
              : "0 0 0 1px rgba(255,255,255,0.04) inset",
          background: shipsStyle ? "rgba(8, 8, 10, 0.78)" : undefined,
        }}
      >
        {/* Accent wash on hover */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-70"
          style={{
            background: nested
              ? "radial-gradient(120% 120% at 15% 50%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0) 55%)"
              : "radial-gradient(105% 105% at 15% 50%, color-mix(in srgb, var(--accent-soft) 65%, transparent) 0%, rgba(0,0,0,0) 48%)",
          }}
        />

        {/* Left accent tick */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-1/2 h-[60%] w-[3px] -translate-y-1/2 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: nested ? "rgba(255,255,255,0.18)" : "var(--accent)",
            boxShadow: nested ? "none" : "0 0 12px 1px var(--accent-soft)",
          }}
        />

        <span className="relative z-10 flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/20 bg-white/[0.06]"
            style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04) inset" }}
          >
            {item.icon ?? <span className="h-4 w-4 rounded-sm bg-white/80" />}
          </span>
            <span className="min-w-0">
            <span
              className="block truncate font-semibold"
              style={{ color: "color-mix(in srgb, var(--accent) 88%, white 12%)" }}
            >
              {nested ? `-- ${item.label}` : item.label}
            </span>
            {item.description ? (
              <span
                className="mt-0.5 block truncate text-sm"
                style={{ color: "color-mix(in srgb, var(--accent) 66%, white 34%)" }}
              >
                {item.description}
              </span>
            ) : null}
          </span>
        </span>

        <span className="relative z-10 flex items-center">
          <Chevron />
        </span>
      </Link>

      {item.children ? (
        <div className="mt-1 space-y-1">
          {item.children.map((child) => (
            <IndexRow key={child.to} item={child} nested shipsStyle={shipsStyle} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function IndexList({
  items,
  shipsStyle = false,
  compactOnShortViewport = false,
}: IndexListProps) {
  return (
    <div className={compactOnShortViewport ? "index-list compact-two-col" : "index-list space-y-1"}>
      {items.map((item) => (
        <IndexRow key={item.to} item={item} shipsStyle={shipsStyle} />
      ))}
    </div>
  );
}
