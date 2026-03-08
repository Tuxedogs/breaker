import helmetPng from "../assets/Screenshot 2026-03-08 094139.png";
import { IconDefs, ids } from "./icons/IconStyleKit";

type HelmetIconProps = {
  size?: number;
  accentColor?: string;
};

export function HelmetIcon({
  size = 200,
  accentColor = "#f5c35b",
}: HelmetIconProps) {
  const d = ids("helmet");

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
        <IconDefs accentColor={accentColor} id="helmet" />
      </defs>

      <g filter={`url(#${d.shipGlow})`}>
        <image
          href={helmetPng}
          x="-9"
          y="-10"
          width="230"
          height="230"
          style={{ mixBlendMode: "lighten" }}
        />
      </g>

      <image
        href={helmetPng}
        x="-9"
        y="-10"
        width="230"
        height="230"
        opacity="0.65"
        filter={`url(#${d.accentGlow})`}
        style={{
          mixBlendMode: "screen",
          filter: `drop-shadow(0 0 18px ${accentColor})`,
        }}
      />

      <g opacity="0.32" filter={`url(#${d.accentGlow})`}>
        <line x1="100" y1="4" x2="100" y2="18" stroke={accentColor} strokeWidth="0.9" strokeOpacity="0.75">
          <animate attributeName="y1" values="4;0;4" dur="1.8s" repeatCount="indefinite" />
        </line>
        <line x1="100" y1="172" x2="100" y2="188" stroke={accentColor} strokeWidth="0.9" strokeOpacity="0.75">
          <animate attributeName="y2" values="188;194;188" dur="1.8s" repeatCount="indefinite" />
        </line>
      </g>
    </svg>
  );
}
