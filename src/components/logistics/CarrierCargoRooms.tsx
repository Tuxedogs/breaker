import type { CargoRoomPlan, CommodityKey } from "./carrierLogisticsData";

interface CarrierCargoRoomsProps {
  roomPlans: CargoRoomPlan[];
  overloadedScu: number;
}

const COMMODITY_FILL_COLOR: Record<CommodityKey, string> = {
  ammoS2: "rgba(100,160,255,0.78)",
  ammoS3: "rgba(80,200,220,0.78)",
  ammoS4: "rgba(130,100,240,0.78)",
  noise:  "rgba(255,200,60,0.78)",
  decoy:  "rgba(255,140,40,0.78)",
  rmc:    "rgba(80,210,140,0.78)",
};

const COMMODITY_CSS_KEY: Record<CommodityKey, string> = {
  ammoS2: "ammo-s2",
  ammoS3: "ammo-s3",
  ammoS4: "ammo-s4",
  noise:  "noise",
  decoy:  "decoy",
  rmc:    "rmc",
};

// Target: ~80 cells max for readability; scale for large rooms
const MAX_GRID_CELLS = 80;

interface RoomCardProps {
  plan: CargoRoomPlan;
}

function RoomCard({ plan }: RoomCardProps) {
  const isEmpty = plan.usedScu === 0;
  const isFull = plan.remainingScu <= 0.001;

  // Scale so total cells <= MAX_GRID_CELLS
  const scaleFactor = plan.capacityScu > MAX_GRID_CELLS
    ? Math.ceil(plan.capacityScu / MAX_GRID_CELLS)
    : 1;
  const totalCells = Math.ceil(plan.capacityScu / scaleFactor);

  // Assign commodity to each cell proportionally
  const cellCommodity: (CommodityKey | null)[] = new Array(totalCells).fill(null);
  let cursor = 0;
  for (const seg of plan.segments) {
    const segCells = Math.round((seg.scu / plan.capacityScu) * totalCells);
    for (let i = 0; i < segCells && cursor < totalCells; i++, cursor++) {
      cellCommodity[cursor] = seg.commodity;
    }
  }
  // Clamp trailing cells to empty (rounding drift fix)
  const usedCells = Math.round((plan.usedScu / plan.capacityScu) * totalCells);
  for (let i = usedCells; i < totalCells; i++) cellCommodity[i] = null;

  // Grid columns: up to 16 wide for large rooms, fewer for tiny rooms
  const cols = totalCells <= 4 ? totalCells : totalCells <= 16 ? 8 : 16;

  return (
    <div className={`clog-room-card${isFull ? " clog-room-card--full" : ""}${isEmpty ? " clog-room-card--empty" : ""}`}>
      <div className="clog-room-header">
        <span className="clog-room-label">{plan.roomLabel}</span>
        <span className="clog-room-capacity">{plan.capacityScu} SCU</span>
      </div>

      {/* Segmented fill bar */}
      <div className="clog-room-bar-wrap" title={`${plan.usedScu.toFixed(2)} / ${plan.capacityScu} SCU`}>
        {plan.segments.map((seg, i) => (
          <div key={i} className="clog-room-bar-seg"
            style={{
              width: `${Math.min(seg.percentOfRoom, 100)}%`,
              background: COMMODITY_FILL_COLOR[seg.commodity],
            }}
            title={`${COMMODITY_CSS_KEY[seg.commodity]}: ${seg.scu.toFixed(2)} SCU`}
          />
        ))}
      </div>

      {/* Mini grid */}
      <div
        className="clog-room-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {cellCommodity.map((commodity, i) => (
          <div
            key={i}
            className="clog-room-cell"
            style={commodity ? { background: COMMODITY_FILL_COLOR[commodity] } : undefined}
          />
        ))}
      </div>

      {/* Stats */}
      <div className="clog-room-stats">
        <span className="clog-room-stat">
          <span className="clog-room-stat-label">Used</span>
          <span className="clog-room-stat-value">{plan.usedScu.toFixed(1)}</span>
        </span>
        <span className="clog-room-stat">
          <span className="clog-room-stat-label">Free</span>
          <span className={`clog-room-stat-value${isFull ? " clog-room-stat-value--full" : plan.usedScu > 0 ? " clog-room-stat-value--ok" : ""}`}>
            {Math.max(0, plan.remainingScu).toFixed(1)}
          </span>
        </span>
        <span className="clog-room-stat">
          <span className="clog-room-stat-label">Fill</span>
          <span className={`clog-room-stat-value${isFull ? " clog-room-stat-value--full" : plan.fillPercent > 0 ? " clog-room-stat-value--loaded" : ""}`}>
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
      {overloadedScu > 0.01 && (
        <div className="clog-overflow-strip">
          <span>⚠</span>
          <span>Over capacity by <strong>{overloadedScu.toFixed(1)} SCU</strong> — reduce a resource or adjust carrier mode.</span>
        </div>
      )}
    </div>
  );
}
