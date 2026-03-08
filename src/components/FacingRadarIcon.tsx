import { IconDefs, METAL, ids } from "./icons/IconStyleKit";

type FacingRadarIconProps = {
  size?: number;
  accentColor?: string;
};

export function FacingRadarIcon({
  size = 200,
  accentColor = "#a78bfa",
}: FacingRadarIconProps) {
  const d = ids("facing-radar");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
    >
      <defs>
        <IconDefs accentColor={accentColor} id="facing-radar" />

        <radialGradient id="facing-radar-sweepGrad">
          <stop offset="0%" stopColor={accentColor} stopOpacity="0.8" />
          <stop offset="70%" stopColor={accentColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle
        cx="100"
        cy="100"
        r="85"
        fill={METAL.dark}
        stroke={METAL.trim}
        strokeWidth="1.5"
        filter={`url(#${d.shipGlow})`}
      />
      <circle
        cx="100"
        cy="100"
        r="80"
        fill={METAL.panel}
        stroke={METAL.groove}
        strokeWidth="0.5"
      />

      <g opacity="0.4">
        <circle cx="100" cy="100" r="60" fill="none" stroke={METAL.edge} strokeWidth="0.5" />
        <circle cx="100" cy="100" r="40" fill="none" stroke={METAL.edge} strokeWidth="0.5" />
        <circle cx="100" cy="100" r="20" fill="none" stroke={METAL.edge} strokeWidth="0.5" />
      </g>

      <g opacity="0.2" stroke={METAL.edge} strokeWidth="0.3">
        <line x1="100" y1="20" x2="100" y2="180" />
        <line x1="20" y1="100" x2="180" y2="100" />
        <line x1="43.4" y1="43.4" x2="156.6" y2="156.6" />
        <line x1="156.6" y1="43.4" x2="43.4" y2="156.6" />
      </g>

      <g filter={`url(#${d.accentGlow})`}>
        <circle cx="130" cy="70" r="2.5" fill={accentColor}>
          <animate attributeName="opacity" values="0;0;0.9;0.9;0;0;0;0" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="75" cy="120" r="2.5" fill={accentColor}>
          <animate attributeName="opacity" values="0;0;0;0;0.9;0.9;0;0" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="145" cy="135" r="2.5" fill={accentColor}>
          <animate attributeName="opacity" values="0;0;0;0;0;0.9;0.9;0" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="60" cy="65" r="2.5" fill={accentColor}>
          <animate attributeName="opacity" values="0.9;0.9;0;0;0;0;0;0" dur="3s" repeatCount="indefinite" />
        </circle>
      </g>

      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 100 100"
          to="360 100 100"
          dur="3s"
          repeatCount="indefinite"
        />
        <path
          d="M 100 100 L 100 20 L 115 30 Z"
          fill="url(#facing-radar-sweepGrad)"
          opacity="0.6"
          filter={`url(#${d.accentGlow})`}
        />
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="20"
          stroke={accentColor}
          strokeWidth="2"
          opacity="0.9"
          filter={`url(#${d.accentGlow})`}
        />
        <path d="M 100 100 L 100 20 L 107 25 Z" fill={accentColor} opacity="0.3" />
      </g>

      <circle
        cx="100"
        cy="100"
        r="8"
        fill={METAL.darkest}
        stroke={METAL.trim}
        strokeWidth="1"
      />
      <circle
        cx="100"
        cy="100"
        r="5"
        fill={accentColor}
        opacity="0.6"
        filter={`url(#${d.accentGlow})`}
      >
        <animate attributeName="opacity" values="0.6;0.9;0.6" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="100" cy="100" r="2.5" fill="#ffffff" opacity="0.95" />
    </svg>
  );
}
