import { Link } from "react-router-dom";

export type IndexListItem = {
  label: string;
  to: string;
  description?: string;
  children?: IndexListItem[];
};

type IndexListProps = {
  items: IndexListItem[];
  shipsStyle?: boolean;
};

function Chevron() {
  return (
    <span
      aria-hidden
      className="ml-3 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-base leading-none text-white/80 transition group-hover:border-white/20 group-hover:text-white"
      style={{
        boxShadow: "0 0 0 1px rgba(255,255,255,0.04) inset",
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
          "border border-white/10 bg-black/25 backdrop-blur-xl",
          "hover:border-white/18",
          shipsStyle ? "rounded-md" : "",
        ].join(" ")}
        style={{
          // subtle inner edge + controlled glow using card vars
          boxShadow: nested
            ? "0 0 0 1px rgba(255,255,255,0.03) inset"
            : shipsStyle
              ? "0 0 0 1px color-mix(in srgb, var(--accent) 55%, rgba(255,255,255,0.16) 45%) inset, 0 0 0 1px rgba(0,0,0,0.4)"
              : "0 0 0 1px rgba(255,255,255,0.04) inset",
          background: shipsStyle ? "rgba(8, 8, 10, 0.78)" : undefined,
        }}
      >
        {/* Accent wash on hover */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: nested
              ? "radial-gradient(120% 120% at 15% 50%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0) 55%)"
              : "radial-gradient(120% 120% at 15% 50%, var(--accent-soft) 0%, rgba(0,0,0,0) 55%)",
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
          <span className="min-w-0">
            <span className="block truncate text-white/90 group-hover:text-white">
              {nested ? `-- ${item.label}` : item.label}
            </span>
            {item.description ? (
              <span className="mt-0.5 block truncate text-sm text-slate-400">{item.description}</span>
            ) : null}
          </span>
        </span>

        <span className="relative z-10 flex items-center">
          <Chevron />
        </span>
      </Link>

      {item.children ? (
        <div className="mt-2 space-y-2">
            {item.children.map((child) => (
            <IndexRow key={child.to} item={child} nested shipsStyle={shipsStyle} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function IndexList({ items, shipsStyle = false }: IndexListProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <IndexRow key={item.to} item={item} shipsStyle={shipsStyle} />
      ))}
    </div>
  );
}
