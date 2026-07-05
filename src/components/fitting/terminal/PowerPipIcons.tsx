type PowerPipIconProps = {
  category: "weapons" | "engines" | "quantum" | "radar" | "lifeSupport" | "cooler1" | "cooler2";
  className?: string;
};

export default function PowerPipIcon({ category, className }: PowerPipIconProps) {
  const shared = {
    viewBox: "0 0 24 24",
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (category) {
    case "weapons":
      return (
        <svg {...shared}>
          <path d="M8 4v16M12 4v16M16 4v16" />
        </svg>
      );
    case "engines":
      return (
        <svg {...shared}>
          <path d="M6 8l4 4-4 4M10 8l4 4-4 4M14 8l4 4-4 4" />
        </svg>
      );
    case "quantum":
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="8.5" strokeDasharray="2.5 2.5" />
          <path d="M12 5.5l5 2.75v4.25c0 3.25-2 5.25-5 6.5-3-1.25-5-3.25-5-6.5V8.25l5-2.75z" />
        </svg>
      );
    case "radar":
      return (
        <svg {...shared}>
          <path d="M5 18c4-6 10-6 14 0" />
          <path d="M8 18c2.5-3.5 6-3.5 8.5 0" />
          <path d="M11 18c1-1.5 2.5-1.5 3.5 0" />
        </svg>
      );
    case "lifeSupport":
      return (
        <svg {...shared}>
          <path d="M12 20c-3-2.5-5-5-5-7.5a5 5 0 0 1 10 0c0 2.5-2 5-5 7.5z" />
          <path d="M6.5 12h3l1.5-2 2 4 1.5-2.5h3.5" />
        </svg>
      );
    case "cooler1":
    case "cooler2":
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="7.5" />
          <path d="M12 4.5v15M4.5 12h15M7.2 7.2l9.6 9.6M16.8 7.2l-9.6 9.6" />
        </svg>
      );
    default:
      return null;
  }
}
