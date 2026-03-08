type DeckMarkerIconProps = {
  className?: string;
};

// Used by current Perseus mid-deck markers.
export function CoolerIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6.3 6.3l11.4 11.4M17.7 6.3L6.3 17.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 4l-1.5 2.5h3L12 4zM12 20l-1.5-2.5h3L12 20zM4 12l2.5-1.5v3L4 12zM20 12l-2.5-1.5v3L20 12z" fill="currentColor" />
      <path d="M6.3 6.3l1.4 2.4 1.3-1.3-2.7-1.1zM17.7 17.7l-1.4-2.4-1.3 1.3 2.7 1.1zM17.7 6.3l-2.4 1.4 1.3 1.3 1.1-2.7zM6.3 17.7l2.4-1.4-1.3-1.3-1.1 2.7z" fill="currentColor" />
    </svg>
  );
}

export function PowerPlantIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 2L4 14h7l-2 8 11-12h-7l2-8z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

export function QuantumDriveIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 18l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 13l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RadarIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
      <path d="M12 12L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export function ShieldGeneratorIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3L4 7v5c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V7l-8-4z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.2" />
      <path d="M12 7L7 9.5v3c0 2.8 1.8 5.3 5 6.5 3.2-1.2 5-3.7 5-6.5v-3L12 7z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="13" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function LifeSupportIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 10h2M8 14h2M14 10h2M14 14h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 10v4M13 10v4" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <path d="M7 18h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TorpedoStationIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="5" width="16" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10" y="17" width="4" height="1.5" rx="0.5" fill="currentColor" opacity="0.5" />
      <path d="M9 19h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11" r="1.5" stroke="currentColor" strokeWidth="1" fill="currentColor" opacity="0.3" />
      <path d="M10 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 9l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

export function EngineerStationIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="5" width="16" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10" y="17" width="4" height="1.5" rx="0.5" fill="currentColor" opacity="0.5" />
      <path d="M9 19h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 8h2a0.5 0.5 0 010 1v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13.5 9.5l2-2M10.5 12.5l-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TurretStationIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function ElevatorIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="3" width="14" height="18" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 9l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 15l-3 3-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="8" y="17" width="8" height="1" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

export function CrewQuartersIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="8" width="8" height="11" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="8" width="8" height="11" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="5" y="11" width="4" height="2" rx="0.5" fill="currentColor" opacity="0.4" />
      <rect x="15" y="11" width="4" height="2" rx="0.5" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

// NOT USED: no current Perseus mid-deck marker is mapped to this icon.
export function CopilotIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="8" width="16" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="7" y="11" width="4" height="3" rx="0.5" stroke="currentColor" strokeWidth="1" />
      <rect x="13" y="11" width="4" height="3" rx="0.5" stroke="currentColor" strokeWidth="1" />
      <path d="M4 14h3M17 14h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 7v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// NOT USED: no current Perseus mid-deck marker is mapped to this icon.
export function RemoteTurretIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="6" width="16" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
      <rect x="9" y="18" width="6" height="1.5" rx="0.5" fill="currentColor" opacity="0.5" />
    </svg>
  );
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
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="7" y="7" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.2" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" />
      <path d="M9 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 4v3M11 17v3M4 11h3M17 11h3" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

// NOT USED: no current Perseus mid-deck marker is mapped to this icon.
export function LocationMarkerIcon({ className = "size-6" }: DeckMarkerIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.3" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </svg>
  );
}
