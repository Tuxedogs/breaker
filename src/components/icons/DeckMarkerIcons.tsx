import type { ReactNode } from "react";

type DeckMarkerIconProps = {
  className?: string;
};

type HudIconProps = DeckMarkerIconProps & {
  children: ReactNode;
};

const BODY = "#9aa7ad";
const BODY_DIM = "#65737c";
const SLATE = "#1b2630";
const SLATE_DARK = "#0b1118";
const TEAL = "#53d6c1";
const GOLD = "#d9a94e";
const PURPLE = "#a78bfa";
const ORANGE = "#e27a3f";

function ComponentModule({ children }: { children: ReactNode }) {
  return (
    <>
      <path
        d="M6.2 7h11.6l.8.9v8.2l-.8.9H6.2l-.8-.9V7.9L6.2 7z"
        fill="#93a0a5"
        stroke={BODY}
        strokeWidth="0.55"
        opacity="0.9"
      />
      <path d="M4.6 9.6h1.6v2.1H4.6zM4.6 13h1.6v2.1H4.6zM17.8 9.6h1.6v2.1h-1.6zM17.8 13h1.6v2.1h-1.6z" fill="#7e8c93" opacity="0.85" />
      <rect x="7.1" y="8.2" width="9.8" height="7.6" rx="1" fill={SLATE_DARK} />
      {children}
    </>
  );
}

function HudIcon({ className = "size-6", children }: HudIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="2.25" y="2.25" width="19.5" height="19.5" rx="2.25" fill="#071016" opacity="0.9" />
      <path d="M4.5 2.25h3M16.5 2.25h3M4.5 21.75h3M16.5 21.75h3" stroke="currentColor" strokeWidth="0.7" opacity="0.55" />
      <path d="M2.25 4.5v3M21.75 4.5v3M2.25 16.5v3M21.75 16.5v3" stroke={TEAL} strokeWidth="0.55" opacity="0.28" />
      <rect x="4.3" y="4.3" width="15.4" height="15.4" rx="1.25" fill="#0c151d" stroke="#20313b" strokeWidth="0.75" />
      <g filter="drop-shadow(0 1px 1px rgba(0,0,0,.8)) drop-shadow(0 0 2px currentColor)">
        {children}
      </g>
    </svg>
  );
}

// Used by current Perseus mid-deck markers.
export function CoolerIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <HudIcon className={className}>
      <ComponentModule>
        <path d="M8.55 9.55h6.9M8.55 12h6.9M8.55 14.45h6.9" stroke={TEAL} strokeWidth="0.75" strokeLinecap="round" />
        <path d="M10.55 8.85v6.3M13.45 8.85v6.3" stroke={BODY_DIM} strokeWidth="1" strokeLinecap="round" />
      </ComponentModule>
    </HudIcon>
  );
}

export function PowerPlantIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <HudIcon className={className}>
      <ComponentModule>
        <path d="M12 9.1a2.9 2.9 0 110 5.8 2.9 2.9 0 010-5.8zm0 1.15a1.75 1.75 0 100 3.5 1.75 1.75 0 000-3.5z" fill={ORANGE} />
        <path d="M11.2 9V7.75M12 8.85V7.55M12.8 9V7.75" stroke={ORANGE} strokeWidth="0.52" strokeLinecap="round" />
        <path d="M9.05 12h1.15M13.8 12h1.15" stroke={GOLD} strokeWidth="0.6" strokeLinecap="round" opacity="0.85" />
      </ComponentModule>
    </HudIcon>
  );
}

export function QuantumDriveIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <HudIcon className={className}>
      <ComponentModule>
        <path d="M11.25 8.75c-1.75.35-2.95 1.6-2.95 3.25s1.2 2.9 2.95 3.25L9.85 12z" fill={GOLD} opacity="0.86" />
        <path d="M12.75 8.75c1.75.35 2.95 1.6 2.95 3.25s-1.2 2.9-2.95 3.25L14.15 12z" fill={GOLD} opacity="0.86" />
        <path d="M12 8.3l1.7 3.7-1.7 3.7-1.7-3.7z" fill={SLATE_DARK} stroke={PURPLE} strokeWidth="0.6" />
        <circle cx="12" cy="12" r="0.75" fill={BODY} />
      </ComponentModule>
    </HudIcon>
  );
}

export function RadarIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <HudIcon className={className}>
      <circle cx="12" cy="12" r="5.7" stroke={BODY_DIM} strokeWidth="0.9" />
      <circle cx="12" cy="12" r="3.3" stroke={BODY_DIM} strokeWidth="0.7" opacity="0.75" />
      <path d="M12 6.3v11.4M6.3 12h11.4" stroke={TEAL} strokeWidth="0.45" opacity="0.45" />
      <path d="M12 12l4.2-3.6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="12" cy="12" r="0.9" fill={TEAL} />
    </HudIcon>
  );
}

export function ShieldGeneratorIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <HudIcon className={className}>
      <ComponentModule>
        <path d="M12 8.55l3.1 1.15-.65 3.65L12 15.5l-2.45-2.15L8.9 9.7z" fill={PURPLE} opacity="0.88" />
        <path d="M12 10l1.45.58-.35 1.9-1.1.98-1.1-.98-.35-1.9z" fill={SLATE_DARK} />
        <path d="M8.2 9.2h-.9v1.1M16.7 9.2h-.9M7.3 13.7v1.1h.9M15.8 14.8h.9v-1.1" stroke={TEAL} strokeWidth="0.55" strokeLinecap="square" />
      </ComponentModule>
    </HudIcon>
  );
}

export function LifeSupportIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <HudIcon className={className}>
      <rect x="7" y="6.7" width="10" height="10.6" rx="1.2" fill={SLATE} stroke={BODY} strokeWidth="0.8" />
      <path d="M9 6.7V5.4h6v1.3" stroke={BODY_DIM} strokeWidth="0.85" />
      <path d="M9.2 10h2M12.8 10h2M9.2 13.2h2M12.8 13.2h2" stroke={TEAL} strokeWidth="0.85" strokeLinecap="round" />
      <path d="M10.5 9v5.4M13.5 9v5.4" stroke={BODY_DIM} strokeWidth="0.55" opacity="0.8" />
    </HudIcon>
  );
}

export function TorpedoStationIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <HudIcon className={className}>
      <rect x="6.5" y="7.2" width="11" height="7.8" rx="0.9" fill={SLATE} stroke={BODY} strokeWidth="0.85" />
      <path d="M8.3 11.1h4.6" stroke={GOLD} strokeWidth="1" strokeLinecap="round" />
      <path d="M12.9 9.3l3.1 1.8-3.1 1.8z" fill={GOLD} opacity="0.78" />
      <path d="M10 16.1h4M8.7 18h6.6" stroke={BODY_DIM} strokeWidth="0.85" strokeLinecap="round" />
    </HudIcon>
  );
}

export function EngineerStationIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <HudIcon className={className}>
      <rect x="6.3" y="6.6" width="11.4" height="9.3" rx="0.9" fill={SLATE} stroke={BODY} strokeWidth="0.85" />
      <circle cx="12" cy="11.2" r="2.1" stroke={TEAL} strokeWidth="0.9" />
      <path d="M13.5 9.7l2-2M10.5 12.7l-2 2" stroke={GOLD} strokeWidth="0.85" strokeLinecap="round" />
      <path d="M10 16.9h4M8.8 18.6h6.4" stroke={BODY_DIM} strokeWidth="0.8" strokeLinecap="round" />
    </HudIcon>
  );
}

export function EngineeringTerminalIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <HudIcon className={className}>
      <rect x="6" y="6.7" width="12" height="9" rx="0.9" fill={SLATE} stroke={BODY} strokeWidth="0.85" />
      <rect x="7.8" y="8.5" width="3.2" height="2.2" rx="0.35" fill={SLATE_DARK} stroke={TEAL} strokeWidth="0.55" />
      <rect x="7.8" y="12" width="3.2" height="2" rx="0.35" fill={SLATE_DARK} stroke={BODY_DIM} strokeWidth="0.55" />
      <path d="M12.6 8.8h3.4M12.6 10.6h2.5M12.6 12.4h3.4M12.6 14h2" stroke={BODY} strokeWidth="0.65" strokeLinecap="round" />
      <circle cx="16.2" cy="8.8" r="0.55" fill={GOLD} />
    </HudIcon>
  );
}

export function TurretStationIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <HudIcon className={className}>
      <path d="M7.2 13.2h9.6l1.4 2.8H5.8l1.4-2.8z" fill={SLATE} stroke={BODY_DIM} strokeWidth="0.8" />
      <circle cx="12" cy="10.4" r="3.4" fill={SLATE_DARK} stroke={BODY} strokeWidth="0.85" />
      <path d="M12 10.4h6.1" stroke={BODY} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M12 8.3v4.2M9.9 10.4h4.2" stroke={GOLD} strokeWidth="0.75" strokeLinecap="round" />
      <circle cx="12" cy="10.4" r="0.9" fill={GOLD} />
    </HudIcon>
  );
}

export function ElevatorIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <HudIcon className={className}>
      <rect x="7.3" y="5.5" width="9.4" height="13" rx="0.9" fill={SLATE} stroke={BODY} strokeWidth="0.9" />
      <path d="M9.6 10l2.4-2.4 2.4 2.4M14.4 14l-2.4 2.4L9.6 14" stroke={TEAL} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.2 12h5.6" stroke={BODY_DIM} strokeWidth="0.8" />
    </HudIcon>
  );
}

export function LadderIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <HudIcon className={className}>
      <path d="M8.8 5.8v12.4M15.2 5.8v12.4" stroke={BODY} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M8.8 8.3h6.4M8.8 11h6.4M8.8 13.7h6.4M8.8 16.4h6.4" stroke={TEAL} strokeWidth="0.85" strokeLinecap="round" />
    </HudIcon>
  );
}

export function ArmoryIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <HudIcon className={className}>
      <rect x="6.2" y="6.2" width="11.6" height="11.6" rx="0.9" fill={SLATE} stroke={BODY} strokeWidth="0.85" />
      <path d="M8.3 9h2.7M8.3 12h2.7M8.3 15h2.7" stroke={BODY} strokeWidth="0.9" strokeLinecap="round" />
      <path d="M13.2 9.6h3M13.2 13.2h3" stroke={GOLD} strokeWidth="0.95" strokeLinecap="round" />
      <circle cx="11.1" cy="9" r="0.55" fill={TEAL} />
      <circle cx="11.1" cy="12" r="0.55" fill={TEAL} />
      <circle cx="11.1" cy="15" r="0.55" fill={TEAL} />
    </HudIcon>
  );
}

export function CrewQuartersIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <HudIcon className={className}>
      <rect x="5.7" y="9" width="5.3" height="8" rx="0.8" fill={SLATE} stroke={BODY} strokeWidth="0.8" />
      <rect x="13" y="9" width="5.3" height="8" rx="0.8" fill={SLATE} stroke={BODY} strokeWidth="0.8" />
      <circle cx="8.35" cy="6.5" r="1.35" stroke={BODY_DIM} strokeWidth="0.8" />
      <circle cx="15.65" cy="6.5" r="1.35" stroke={BODY_DIM} strokeWidth="0.8" />
      <rect x="7" y="11.2" width="2.7" height="1.45" rx="0.35" fill={TEAL} opacity="0.65" />
      <rect x="14.3" y="11.2" width="2.7" height="1.45" rx="0.35" fill={TEAL} opacity="0.65" />
      <path d="M7.2 15.2h2.3M14.5 15.2h2.3" stroke={GOLD} strokeWidth="0.65" strokeLinecap="round" />
    </HudIcon>
  );
}

// NOT USED: no current Perseus mid-deck marker is mapped to this icon.
export function CopilotIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <HudIcon className={className}>
      <rect x="6" y="8" width="12" height="7.8" rx="0.9" fill={SLATE} stroke={BODY} strokeWidth="0.85" />
      <rect x="8" y="10" width="3" height="2.8" rx="0.45" fill={SLATE_DARK} stroke={TEAL} strokeWidth="0.55" />
      <rect x="13" y="10" width="3" height="2.8" rx="0.45" fill={SLATE_DARK} stroke={TEAL} strokeWidth="0.55" />
      <circle cx="12" cy="5.8" r="1.5" stroke={BODY} strokeWidth="0.85" />
    </HudIcon>
  );
}

// NOT USED: no current Perseus mid-deck marker is mapped to this icon.
export function RemoteTurretIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return <TurretStationIcon className={className} />;
}

// NOT USED: no current Perseus mid-deck marker is mapped to this icon.
export function ElevatorUpIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return <ElevatorIcon className={className} />;
}

// NOT USED: no current Perseus mid-deck marker is mapped to this icon.
export function ElevatorDownIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return <ElevatorIcon className={className} />;
}

// NOT USED: no current Perseus mid-deck marker is mapped to this icon.
export function AirlockIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <HudIcon className={className}>
      <path d="M7 6.5h6.2c1 0 1.7.7 1.7 1.7v9.3H7c-1 0-1.7-.7-1.7-1.7V8.2c0-1 .7-1.7 1.7-1.7z" fill={SLATE} stroke={BODY} strokeWidth="0.85" />
      <path d="M14.9 8l3.7 1.4v8.1l-3.7-1.6V8z" fill={SLATE_DARK} stroke={BODY_DIM} strokeWidth="0.85" />
      <circle cx="10.4" cy="12.2" r="0.9" fill={TEAL} />
      <path d="M8 8.6v7.1M16 9.8v5.3" stroke="currentColor" strokeWidth="0.55" opacity="0.7" />
    </HudIcon>
  );
}

// NOT USED: no current Perseus mid-deck marker is mapped to this icon.
export function LocationMarkerIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <HudIcon className={className}>
      <circle cx="12" cy="12" r="5.8" fill={SLATE} stroke={BODY} strokeWidth="0.85" />
      <circle cx="12" cy="12" r="2.8" fill={SLATE_DARK} stroke={TEAL} strokeWidth="0.8" />
      <path d="M12 5.8v2M12 16.2v2M5.8 12h2M16.2 12h2" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="0.85" fill={GOLD} />
    </HudIcon>
  );
}
