import type { KeyboardEvent } from "react";
import type { PlanetAsset } from "../../../features/mining/planetAssets";
import { getPlanetAsset } from "../../../features/mining/planetAssets";
import {
  type JournalHabitatReport,
  type ReportedHabitatLocation,
} from "../../../features/source/sourceResources";

export function SourceReportedBadges({ reports }: { reports: readonly JournalHabitatReport[] }) {
  const names = [...new Set(reports.map((report) => report.name))].sort((a, b) => a.localeCompare(b));
  if (!names.length) return null;
  return (
    <div className="source-location-badges" aria-label="Selected resources with reported Journal habitat evidence">
      {names.map((name) => (
        <span key={name} className="source-location-badge"
          title={name + ": reported in the in-game Journal; spawn frequency unknown"}>
          {name}
        </span>
      ))}
    </div>
  );
}

export function JournalLocationListItem({
  location,
  planetAssetMap,
  selected,
  onSelect,
}: {
  location: ReportedHabitatLocation;
  planetAssetMap: Map<string, PlanetAsset> | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const asset = getPlanetAsset(planetAssetMap, location.body);
  const habitat = [...new Set(location.reports.map((row) => row.biome).filter((name): name is string => Boolean(name)))];
  const activate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(); }
  };
  return (
    <div className={"mlist-item source-journal-location" + (selected ? " mlist-item--selected" : "")}
      role="button" tabIndex={0} aria-pressed={selected}
      aria-label={location.body + " reported habitat location; unranked"}
      onClick={onSelect} onKeyDown={activate}>
      <span className="mlist-item-rank source-journal-unranked" aria-label="Unranked">·</span>
      <div className="mlist-item-thumb" aria-hidden="true">
        {asset ? <img src={asset.thumbnail} srcSet={asset.thumbnail2x + " 2x"}
          alt="" className="mlist-item-thumb-img" />
          : <span className="mlist-item-thumb-fallback">{location.body.charAt(0).toUpperCase()}</span>}
      </div>
      <div className="mlist-item-body">
        <div className="mlist-item-head"><span className="mlist-item-name">{location.body}</span></div>
        <div className="mlist-item-sub">
          <span className="mlist-system-badge">{location.system}</span>
          {habitat.length > 0 && <span className="source-journal-biome">{habitat.join(" / ")}</span>}
        </div>
      </div>
      <div className="mlist-item-coverage"><SourceReportedBadges reports={location.reports} /></div>
    </div>
  );
}

const scopeLabels: Record<JournalHabitatReport["scope"], string> = {
  named_body: "Named body",
  named_body_and_moons: "Body and moons",
  named_place: "Named place",
  system_caves_unexpanded: "System-wide caves",
};

export function JournalEvidenceSection({ reports }: { reports: readonly JournalHabitatReport[] }) {
  if (!reports.length) return null;
  return (
    <section className="source-journal-evidence-panel" aria-label="Reported habitat evidence">
      <div className="mdet-section-label">Reported habitat</div>
      <SourceReportedBadges reports={reports} />
      <p>In-game Journal association only. No verified spawn probability, mining competition,
        harvest interaction, or exact spawn position.</p>
      <div className="source-journal-biomes">
        {[...new Set(reports.map((report) => report.biome).filter((name): name is string => Boolean(name)))].map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
    </section>
  );
}

export function JournalLocationDetail({ location }: { location: ReportedHabitatLocation }) {
  return (
    <div className="mdet-panel source-journal-detail">
      <div className="source-journal-profile-banner">
        <div className="mdet-label">Selected source / <span className="mdet-label-system">{location.system}</span></div>
        <div className="mdet-name">{location.body}</div>
        <div className="source-journal-subtitle">Reported habitats · unranked</div>
      </div>
      <div className="source-journal-status"><strong>In-game Journal</strong> · Reported habitat evidence, not measured spawn frequency</div>
      <div className="source-journal-metrics">
        <div><small>Matching resources</small><strong>{new Set(location.reports.map((row) => row.name)).size} reported</strong></div>
        <div><small>Evidence type</small><strong>Journal association</strong></div>
        <div><small>Spawn frequency</small><strong>Unknown</strong></div>
      </div>
      <JournalEvidenceSection reports={location.reports} />
      <div className="source-journal-table-wrap">
        <table className="source-journal-table">
          <thead><tr><th>Resource</th><th>Biome</th><th>Scope</th></tr></thead>
          <tbody>{location.reports.map((report, i) => (
            <tr key={report.name + ":" + report.scope + ":" + (report.biome ?? "") + ":" + i}>
              <td>{report.name}</td><td>{report.biome ?? "Not specified"}</td><td>{scopeLabels[report.scope]}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="source-journal-disclaimer">
        Reported associations are not guaranteed encounters. Unlisted resources are not proven absent.
        Broad cave reports are not assigned to specific moons.
      </p>
    </div>
  );
}
