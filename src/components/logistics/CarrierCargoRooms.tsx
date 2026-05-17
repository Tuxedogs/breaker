import type { CargoRoomPlan, CommodityKey } from "./carrierLogisticsData";

interface CarrierCargoRoomsProps {
  roomPlans: CargoRoomPlan[];
  overloadedScu: number;
}

const COMMODITY_CSS_KEY: Record<CommodityKey, string> = {
  ammoS2: "ammo-s2",
  ammoS3: "ammo-s3",
  ammoS4: "ammo-s4",
  noise:  "noise",
  decoy:  "decoy",
  rmc:    "rmc",
};

const COMMODITY_FILL_COLOR: Record<CommodityKey, string> = {
  ammoS2: "rgba(100,160,255,0.75)",
  ammoS3: "rgba(80,200,220,0.75)",
  ammoS4: "rgba(130,100,240,0.75)",
  noise:  "rgba(255,200,60,0.75)",
  decoy:  "rgba(255,140,40,0.75)",
  rmc:    "rgba(80,210,140,0.75)",
};

const MINI_GRID_MAX_CELLS = 64;

interface RoomCardProps {
  plan: CargoRoomPlan;
}

function RoomCard({ plan }: RoomCardProps) {
  const isEmpty = plan.usedScu === 0;
  const isFull = plan.remainingScu <= 0;

  // Mini grid: scale cells so we never exceed MINI_GRID_MAX_CELLS visual cells
  const scaleFactor = plan.capacityScu > MINI_GRID_MAX_CELLS
    ? Math.ceil(plan.capacityScu / MINI_GRID_MAX_CELLS)
    : 1;
  const totalCells = Math.ceil(plan.capacityScu / scaleFactor);
  const usedCells = Math.round((plan.usedScu / plan.capacityScu) * totalCells);

  // Build per-cell commodity assignments
  const cellCommodity: (CommodityKey | null)[] = new Array(totalCells).fill(null);
  let cellCursor = 0;
  for (const seg of plan.segments) {
    const segCells = Math.round((seg.scu / plan.capacityScu) * totalCells);
    for (let i = 0; i < segCells && cellCursor < totalCells; i++, cellCursor++) {
      cellCommodity[cellCursor] = seg.commodity;
    }
  }
  // Clamp to actual used cells to avoid rounding drift
  for (let i = usedCells; i < totalCells; i++) cellCommodity[i] = null;

  const cols = Math.min(totalCells, 16);

  return (
    <div className={`clog-room-card${isFull ? " clog-room-card--full" : ""}${isEmpty ? " clog-room-card--empty" : ""}`}>
      <div className="clog-room-header">
        <span className="clog-room-label">{plan.roomLabel}</span>
        <span className="clog-room-capacity">{plan.capacityScu} SCU</span>
      </div>

      {/* Mini grid */}
      <div
        className="clog-room-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        title={`${plan.usedScu.toFixed(1)} / ${plan.capacityScu} SCU used`}
      >
        {cellCommodity.map((commodity, i) => (
          <div
            key={i}
            className={`clog-room-cell${commodity ? ` clog-room-cell--${COMMODITY_CSS_KEY[commodity]}` : ""}`}
            style={commodity ? { background: COMMODITY_FILL_COLOR[commodity] } : undefined}
          />
        ))}
      </div>

      {/* Fill bar */}
      <div className="clog-room-bar-wrap">
        {plan.segments.map((seg, i) => (
          <div
            key={i}
            className="clog-room-bar-seg"
            style={{
              width: `${Math.min(seg.percentOfRoom, 100)}%`,
              background: COMMODITY_FILL_COLOR[seg.commodity],
            }}
            title={`${seg.scu.toFixed(2)} SCU`}
          />
        ))}
      </div>

      {/* Stats row */}
      <div className="clog-room-stats">
        <span className="clog-room-stat">
          <span className="clog-room-stat-label">Used</span>
          <span className="clog-room-stat-value">{plan.usedScu.toFixed(1)}</span>
        </span>
        <span className="clog-room-stat">
          <span className="clog-room-stat-label">Free</span>
          <span className={`clog-room-stat-value${plan.remainingScu <= 0 ? " clog-room-stat-value--full" : " clog-room-stat-value--ok"}`}>
            {plan.remainingScu.toFixed(1)}
          </span>
        </span>
        <span className="clog-room-stat">
          <span className="clog-room-stat-label">Fill</span>
          <span className={`clog-room-stat-value${plan.fillPercent >= 100 ? " clog-room-stat-value--full" : plan.fillPercent > 0 ? " clog-room-stat-value--warn" : ""}`}>
            {plan.fillPercent.toFixed(0)}%
          </span>
        </span>
      </div>
    </div>
  );
}

export default function CarrierCargoRooms({ roomPlans, overloadedScu }: CarrierCargoRoomsProps) {
  return (
    <div className="clog-rooms-wrap">
      <div className="clog-rooms-grid">
        {roomPlans.map((plan) => (
          <RoomCard key={plan.roomId} plan={plan} />
        ))}
      </div>

      {overloadedScu > 0 && (
        <div className="clog-overflow-strip">
          <span className="clog-overflow-icon">⚠</span>
          <span>
            Over capacity by <strong>{overloadedScu.toFixed(1)} SCU</strong> — reduce loaded resources or enable a larger cargo mode.
          </span>
        </div>
      )}
    </div>
  );
}
