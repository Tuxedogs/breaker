type EnvelopeBand = {
  label: "Optimal" | "Degraded" | "Maximum";
  start: number;
  end: number;
};

function parseEnvelopeBands(items: string[]): EnvelopeBand[] {
  const matches = items
    .map((item) => {
      const match = item.match(/(Optimal|Degraded|Maximum)\s+([0-9.]+)-([0-9.]+)\s*km/i);
      if (!match) return null;
      const [, label, start, end] = match;
      return {
        label: label as EnvelopeBand["label"],
        start: Number(start),
        end: Number(end),
      };
    })
    .filter((item): item is EnvelopeBand => item !== null);

  const order: EnvelopeBand["label"][] = ["Optimal", "Degraded", "Maximum"];
  return matches.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
}

function parseTorpedoRange(items: string[]) {
  for (const item of items) {
    const match = item.match(/Torpedo.*?([0-9.]+)-([0-9.]+)\s*km/i);
    if (!match) continue;
    return { start: Number(match[1]), end: Number(match[2]) };
  }
  return null;
}

export default function EngagementEnvelope({ items }: { items: string[] }) {
  const bands = parseEnvelopeBands(items);
  const domainStart = 0;
  const domainEnd = 5;
  const torpedoRange = parseTorpedoRange(items);
  const tickStep = 0.5;
  const ticks =
    domainEnd > 0
      ? Array.from({ length: Math.floor(domainEnd / tickStep) + 1 }, (_, idx) => Number((idx * tickStep).toFixed(1)))
      : [];
  const transitions = bands.slice(0, -1).map((band) => band.end);
  const nonBandItems = items.filter(
    (item) =>
      !/(Optimal|Degraded|Maximum)\s+[0-9.]+-[0-9.]+\s*km/i.test(item) &&
      !/Torpedo.*?[0-9.]+-[0-9.]+\s*km/i.test(item)
  );

  return (
    <section className="framework-modern-card-head doctrine-envelope rounded-xl p-4">
      <h2 className="title-font text-xl text-cyan-100">Engagement Envelope</h2>
      <div className="mt-4 doctrine-envelope-instrument">
        <div className="doctrine-envelope-track">
          {bands.map((band) => {
            const visualStart = band.label === "Optimal" ? 0 : band.start;
            const leftPercent = ((visualStart - domainStart) / (domainEnd - domainStart)) * 100;
            const widthPercent = ((Math.min(band.end, domainEnd) - visualStart) / (domainEnd - domainStart)) * 100;
            const bandClass =
              band.label === "Optimal"
                ? "doctrine-envelope-band doctrine-envelope-band-optimal"
                : band.label === "Degraded"
                  ? "doctrine-envelope-band doctrine-envelope-band-degraded"
                  : "doctrine-envelope-band doctrine-envelope-band-maximum";
            return (
              <div key={band.label} className={bandClass} style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}>
                <span className="doctrine-envelope-label">{band.label}</span>
                <span className="doctrine-envelope-range">{band.start}-{band.end} km</span>
              </div>
            );
          })}
          {transitions.map((value) => {
            const leftPercent = (value / domainEnd) * 100;
            return (
              <div key={`marker-${value}`} className="doctrine-envelope-marker" style={{ left: `${leftPercent}%` }}>
                <span className="doctrine-envelope-marker-seam" />
                <span className="doctrine-envelope-marker-line" />
              </div>
            );
          })}
        </div>
        {torpedoRange ? (
          <div className="doctrine-torpedo-shell">
            <div className="doctrine-torpedo-header">
              <span className="doctrine-torpedo-label">Torpedo Envelope</span>
              {torpedoRange.end > domainEnd ? <span className="doctrine-torpedo-continue">→ {torpedoRange.end} km</span> : null}
            </div>
            <div className="doctrine-torpedo-track">
              <div
                className="doctrine-torpedo-band"
                style={{
                  left: `${Math.max(0, ((torpedoRange.start - domainStart) / (domainEnd - domainStart)) * 100)}%`,
                  width: `${Math.max(
                    0,
                    ((Math.min(torpedoRange.end, domainEnd) - Math.max(torpedoRange.start, domainStart)) / (domainEnd - domainStart)) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        ) : null}
        <div className="doctrine-envelope-ticks" aria-hidden>
          {ticks.map((tick) => {
            const leftPercent = (tick / domainEnd) * 100;
            const major = Math.abs(tick % 1) < 0.001;
            return (
              <span
                key={`tick-${tick}`}
                className={major ? "doctrine-envelope-tick doctrine-envelope-tick-major" : "doctrine-envelope-tick"}
                style={{ left: `${leftPercent}%` }}
                title={`${tick} km`}
              />
            );
          })}
        </div>
        <p className="mt-2 text-[0.68rem] uppercase tracking-[0.14em] text-slate-400">Scale {domainStart}-{domainEnd} km</p>
      </div>
      {nonBandItems.length > 0 ? (
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-slate-200">
          {nonBandItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

