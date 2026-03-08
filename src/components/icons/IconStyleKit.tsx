/* eslint-disable react-refresh/only-export-components */
/**
 * IconStyleKit — Shared SVG style system for the "SciFi Glow" icon family.
 *
 * DESIGN LANGUAGE:
 *  - Dark metallic panels (#1a1a1a → #3a3a3a range)
 *  - Single accent color: glows on edges, nozzles, cockpits, wing trims
 *  - Multi-layer glow via SVG feGaussianBlur filters (soft + hard passes)
 *  - Animated thruster flame: white core → accent → transparent
 *  - Motion trail: tapered polygon streaks fading to transparent
 *  - Subtle panel line details (stroke ~0.5–0.8)
 *  - Nose/tip always gets a bright accent highlight dot
 *
 * HOW TO USE:
 *  1. Render <IconDefs accentColor={...} id="myIcon" /> inside your <svg>'s <defs>.
 *     The `id` prefix namespaces all filter/gradient IDs so multiple icons can coexist.
 *  2. Use the exported METAL, ACCENT, and STYLE helpers to apply consistent fills/strokes.
 *  3. Use <ThrusterFlame>, <MotionTrail>, <GlowDot> sub-components for common FX elements.
 *
 * PALETTE REFERENCE:
 *  - Metal dark:    #111111
 *  - Metal mid:     #1e1e1e / #222222 / #252525
 *  - Metal light:   #2e2e2e / #333333 / #3a3a3a
 *  - Panel groove:  #444444 (stroke)
 *  - Cockpit glass: #1a2a3a tinted with accent @ 12% opacity
 *  - Accent:        (default #2538e9)
 *  - Accent dim:    accent @ 20–50% opacity
 *  - Hot core:      #ffffff
 */

// ─── ID helper ────────────────────────────────────────────────────────────────
export const ids = (prefix: string) => ({
  shipGlow:     `${prefix}_shipGlow`,
  accentGlow:   `${prefix}_accentGlow`,
  thrusterGlow: `${prefix}_thrusterGlow`,
  trailGlow:    `${prefix}_trailGlow`,
  bodyGrad:     `${prefix}_bodyGrad`,
  wingGrad:     `${prefix}_wingGrad`,
  panelGrad:    `${prefix}_panelGrad`,
  accentEdge:   `${prefix}_accentEdge`,
  flameGrad:    `${prefix}_flameGrad`,
  trailGrad:    `${prefix}_trailGrad`,
  thrusterRing: `${prefix}_thrusterRing`,
  ref: (id: string) => `url(#${id})`,
});

// ─── Shared metal palette ──────────────────────────────────────────────────────
export const METAL = {
  darkest: "#111111",
  dark:    "#1a1a1a",
  mid:     "#222222",
  panel:   "#252525",
  light:   "#2e2e2e",
  trim:    "#333333",
  edge:    "#3a3a3a",
  groove:  "#444444",
  cockpit: "#1a2a3a",
} as const;

// ─── IconDefs ─────────────────────────────────────────────────────────────────
// Drop this inside your <svg><defs>…</defs></svg>.
// `id` must be unique per icon instance on the page.
interface IconDefsProps {
  accentColor: string;
  id: string; // unique namespace, e.g. "ship" or "turret"
}

export function IconDefs({ accentColor, id }: IconDefsProps) {
  const d = ids(id);
  return (
    <>
      {/* ── Filters ── */}

      {/* General ship body soft glow */}
      <filter id={d.shipGlow} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Accent-colored edge / trim glow */}
      <filter id={d.accentGlow} x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Intense thruster / nozzle core glow */}
      <filter id={d.thrusterGlow} x="-200%" y="-200%" width="500%" height="500%">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Soft directional glow for motion trails */}
      <filter id={d.trailGlow} x="-50%" y="-10%" width="200%" height="120%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      

      {/* Thruster flame: white core → accent → transparent */}
      <linearGradient id={d.flameGrad} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#0664f0"     stopOpacity="1"   />
        <stop offset="20%"  stopColor={accentColor} stopOpacity="1"   />
        <stop offset="70%"  stopColor={accentColor} stopOpacity="0.4" />
        <stop offset="100%" stopColor={accentColor} stopOpacity="0"   />
      </linearGradient>

      {/* Motion trail: accent → transparent downward */}
      <linearGradient id={d.trailGrad} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor={accentColor} stopOpacity="0.8" />
        <stop offset="60%"  stopColor={accentColor} stopOpacity="0.2" />
        <stop offset="100%" stopColor={accentColor} stopOpacity="0"   />
      </linearGradient>

    </>
  );
}

// ─── ThrusterFlame ────────────────────────────────────────────────────────────
// A single centered thruster flame pointing "downward" from (cx, cy).
// For a nose-up ship, place at the bottom of the fuselage.
interface ThrusterFlameProps {
  cx: number;
  cy: number;
  accentColor: string;
  filterId: string;   // use d.thrusterGlow
  flameGradId: string; // use d.flameGrad
  outerRx?: number;
  outerRy?: number;
}

export function ThrusterFlame({
  cx, cy, accentColor, filterId, flameGradId,
  outerRx = 10, outerRy = 22,
}: ThrusterFlameProps) {
  return (
    <g>
      {/* Outer flame cone */}
      <ellipse
        cx={cx} cy={cy + outerRy * 0.7}
        rx={outerRx} ry={outerRy}
        fill={`url(#${flameGradId})`}
        filter={`url(#${filterId})`}
        opacity="0.7"
      />
      {/* Inner hot core */}
      <ellipse
        cx={cx} cy={cy + outerRy * 0.1}
        rx={outerRx * 0.5} ry={outerRy * 0.45}
        fill={`url(#${flameGradId})`}
        filter={`url(#${filterId})`}
        opacity="0.95"
      />
      {/* Animated shimmer and color*/}
      <ellipse cx={cx} cy={cy + outerRy * 0.22} rx={outerRx * 0.3} ry={outerRy * 0.28} fill="darkblue" opacity="0.6" filter={`url(#${filterId})`}>
        <animate attributeName="ry"      values={`${outerRy*0.68};${outerRy*0.42};${outerRy*0.28};${outerRy*0.35};${outerRy*0.28}`} dur="0.18s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0.9;0.5;0.8;0.6" dur="0.18s" repeatCount="indefinite" />
      </ellipse>
      {/* Nozzle ring pulsing */}
      <ellipse cx={cx} cy={cy} rx={outerRx * 0.3} ry={outerRy * 0.09} fill={accentColor} opacity="0.8" filter={`url(#${filterId})`}>
        <animate attributeName="opacity" values="0.8;1;0.6;1;0.8" dur="0.15s" repeatCount="indefinite" />
      </ellipse>
    </g>
  );
}

// ─── MotionTrail ──────────────────────────────────────────────────────────────
// A tapered trail behind the thruster exit (pointing downward).
// trailStart = Y where trail originates (just below nozzle)
// trailEnd   = Y where trail fully fades (bottom of canvas)
// cx         = horizontal center
interface MotionTrailProps {
  cx: number;
  trailStartY: number;
  trailEndY: number;
  accentColor: string;
  trailGradId: string;
  trailGlowId: string;
  halfWidth?: number;       // half-width at nozzle exit
  halfWidthEnd?: number;    // half-width at fade end
}

export function MotionTrail({
  cx, trailStartY, trailEndY, accentColor,
  trailGradId, trailGlowId,
  halfWidth = 8, halfWidthEnd = 16,
}: MotionTrailProps) {
  const x0 = cx - halfWidth;
  const x1 = cx + halfWidth;
  const x0e = cx - halfWidthEnd;
  const x1e = cx + halfWidthEnd;
  return (
    <g filter={`url(#${trailGlowId})`}>
      {/* Wide outer cone */}
      <polygon
        points={`${x0},${trailStartY} ${x1},${trailStartY} ${x1e},${trailEndY} ${x0e},${trailEndY}`}
        fill={`url(#${trailGradId})`}
        opacity="0.85"
      />
      {/* Narrow inner bright streak */}
      <polygon
        points={`${cx-3},${trailStartY} ${cx+3},${trailStartY} ${cx+5},${trailEndY} ${cx+3},${trailEndY}`}
        fill={`url(#${trailGradId})`}
        opacity="0.5"
      />
      {/* Speed lines */}
      <line x1={cx}   y1={trailStartY} x2={cx-4}  y2={trailEndY * 0.75 + trailStartY * 0.45} stroke={accentColor} strokeWidth="0.5" strokeOpacity="0.4" />
      <line x1={cx}   y1={trailStartY} x2={cx+4}  y2={trailEndY * 0.75 + trailStartY * 0.45} stroke={accentColor} strokeWidth="0.5" strokeOpacity="0.4" />
      <line x1={cx}   y1={trailStartY} x2={cx-9}  y2={trailEndY * 0.78 + trailStartY * 0.35} stroke={accentColor} strokeWidth="0.3" strokeOpacity="0.2" />
      <line x1={cx}   y1={trailStartY} x2={cx+9}  y2={trailEndY * 0.78 + trailStartY * 0.35} stroke={accentColor} strokeWidth="0.3" strokeOpacity="0.2" />
    </g>
  );
}

// ─── GlowDot ──────────────────────────────────────────────────────────────────
// A bright accent dot — used for nose tips, weapon ports, indicator lights.


// ─── AccentLine ───────────────────────────────────────────────────────────────
// A glowing accent edge line (wing trim, fuselage stripe, etc.)

/**
 * QUICK STYLE GUIDE FOR NEW ICONS
 * ─────────────────────────────────
 * 1. Body fill:         fill={`url(#${d.bodyGrad})`}
 * 2. Wing fill:         fill={`url(#${d.wingGrad})`}
 * 3. Panel fill:        fill={`url(#${d.panelGrad})`}
 * 4. Accent wing edge:  fill={`url(#${d.accentEdge})`} + filter={`url(#${d.accentGlow})`}
 * 5. Panel strokes:     stroke={METAL.trim} strokeWidth="0.5–0.8"
 * 6. Cockpit rect:      fill={METAL.cockpit}, then overlay accent fill @ opacity="0.12"
 * 7. Thruster:          <NozzleHousing> + <ThrusterFlame>
 * 8. Trail:             <MotionTrail>
 * 9. Nose tip:          <GlowDot>
 * 10. Edge accents:     <AccentLine>
 */
