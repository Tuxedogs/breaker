type DonutChartProps = {
  owned: number;
  needed: number;
  shortage: number;
  size?: number;
  strokeWidth?: number;
};

export default function DonutChart({
  owned,
  needed,
  shortage,
  size = 140,
  strokeWidth = 13,
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ownedPct = needed > 0 ? owned / needed : 0;
  const shortagePct = needed > 0 ? shortage / needed : 0;
  const center = size / 2;

  // Arcs start at 12 o'clock (rotate -90deg)
  const ownedDash = ownedPct * circumference;
  const shortageDash = shortagePct * circumference;
  const shortageOffset = -(ownedPct * circumference);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`Inventory: ${Math.round(ownedPct * 100)}% owned`}
    >
      {/* Track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
      />
      {/* Shortage arc (red) */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="#f87171"
        strokeWidth={strokeWidth}
        strokeDasharray={`${shortageDash} ${circumference}`}
        strokeDashoffset={shortageOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
        style={{ opacity: 0.75 }}
      />
      {/* Owned arc (purple → teal gradient via two stops) */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="url(#donut-owned-grad)"
        strokeWidth={strokeWidth}
        strokeDasharray={`${ownedDash} ${circumference}`}
        strokeDashoffset={0}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
      <defs>
        <linearGradient id="donut-owned-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#4ade80" />
        </linearGradient>
      </defs>
    </svg>
  );
}
