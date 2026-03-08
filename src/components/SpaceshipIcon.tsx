import {
  IconDefs,
  ids,
  ThrusterFlame,
  MotionTrail,
} from "./icons/IconStyleKit";
import shipAssetUrl from "../assets/ARROWPNG.svg";

interface SpaceshipIconProps {
  size?: number;
  accentColor?: string;
}

export function SpaceshipIcon({
  size = 400,
  accentColor = "#164caf",
}: SpaceshipIconProps) {
  const d = ids("ship");

  return (
    <svg
      width={size}
      height={size * 1.6}
      viewBox="0 0 200 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
    >
      <defs>
        <IconDefs accentColor={accentColor} id="ship" />
        <clipPath id="ship_trailClip">
          <rect x="0" y="160" width="200" height="150" />
        </clipPath>
      </defs>

      {/* ── Motion Trail ── */}
      <g clipPath="url(#ship_trailClip)">
        <MotionTrail
          cx={100}
          trailStartY={140}
          trailEndY={240}
          accentColor={accentColor}
          trailGradId={d.trailGrad}
          trailGlowId={d.trailGlow}
          halfWidth={22}
          halfWidthEnd={18}
        />
      </g>

      {/* ── Thruster Flame (behind hull) ── */}
      <ThrusterFlame
        cx={100}
        cy={155}
        accentColor={accentColor}
        filterId={d.thrusterGlow}
        flameGradId={d.flameGrad}
        outerRx={14}
        outerRy={38}
      />

      {/* ── Ship Hull SVG ── */}
      <g filter={`url(#${d.shipGlow})`}>
        <image
          href={shipAssetUrl}
          x="25" 
          y="10"
          width="150"
          height="195"
          style={{ mixBlendMode: "lighten" }}
        />
      </g>

      {/* ── Accent glow overlay on ship edges ── */}
      <image
        href={shipAssetUrl}
        x="25"
        y="10"
        width="150"
        height="195 "
        opacity="0.4"
        filter={`url(#${d.accentGlow})`}
        style={{
          mixBlendMode: "screen",
          filter: `drop-shadow(0 0 8px ${accentColor})`,
        }}
      />
    </svg>
  );
}
