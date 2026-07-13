import { useMemo } from "react";
import type { FittingComponentStats } from "../../../lib/fitting/fittingApi";
import {
  buildOffensiveGroups,
  formatNumber,
  inferDamageType,
  portShortLabel,
  type NamedGroup,
  type PortBreakdownRow,
} from "../../../lib/fitting/fittingPortGrouping";

type WeaponStatEntry = {
  portId: string;
  name: string;
  portLabel: string;
  size: string;
  type: string;
  damageType: string;
  alpha: string;
  alphaShare: string;
  stats: FittingComponentStats | null;
  loading: boolean;
};

function statOrUnavailable(value: number | null | undefined, suffix = ""): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${formatNumber(value)}${suffix}`;
}

const weaponGroupKeys = [
  "pilot-weapons",
  "remote-turrets",
  "manned-turrets",
  "installed-weapons",
  "missiles",
  "torpedoes",
  "emp-qed",
];

type WeaponStatsTabProps = {
  portRows: PortBreakdownRow[];
  totalAlpha: number | null;
  statsByComponentId: Record<string, FittingComponentStats>;
  detailsLoading?: boolean;
};

export default function WeaponStatsTab({
  portRows,
  totalAlpha,
  statsByComponentId,
  detailsLoading = false,
}: WeaponStatsTabProps) {
  const groups = useMemo(() => buildOffensiveGroups(portRows), [portRows]);
  const weaponGroups = groups.filter((group) => weaponGroupKeys.includes(group.key));

  const entries = useMemo(() => {
    const next: Record<string, WeaponStatEntry> = {};
    const weaponRows = weaponGroups
      .flatMap((group) => group.rows)
      .filter((row) => row.equippedComponentKey);

    for (const row of weaponRows) {
      const componentId = row.equippedComponentKey!;
      const hasStats = componentId in statsByComponentId;
      const stats = hasStats ? statsByComponentId[componentId] : null;
      const alpha = stats?.alphaDamage;
      const share = totalAlpha != null && alpha != null && totalAlpha > 0
        ? `${formatNumber((alpha / totalAlpha) * 100)}%`
        : "—";
      const damageType = stats ? inferDamageType(stats) ?? "—" : "—";

      next[row.portId] = {
        portId: row.portId,
        portLabel: portShortLabel(row),
        name: row.equippedComponentName ?? portShortLabel(row),
        size: row.componentSize != null ? `S${row.componentSize}` : "—",
        type: row.componentSubtype ?? row.componentCategory ?? "—",
        damageType,
        alpha: statOrUnavailable(alpha),
        alphaShare: share,
        stats,
        loading: detailsLoading || !hasStats,
      };
    }

    return next;
  }, [detailsLoading, statsByComponentId, totalAlpha, weaponGroups]);

  if (weaponGroups.every((group) => group.rows.length === 0)) {
    return <p className="fit-term-empty">No equipped weapons in the current loadout.</p>;
  }

  return (
    <div className="fit-term-weapon-stats">
      {weaponGroups.map((group) => (
        <WeaponGroupTable key={group.key} group={group} entries={entries} />
      ))}
    </div>
  );
}

function WeaponGroupTable({ group, entries }: { group: NamedGroup; entries: Record<string, WeaponStatEntry> }) {
  if (group.rows.length === 0) return null;
  const rows = group.rows.filter((row) => row.equippedComponentKey);

  return (
    <section className="fit-term-weapon-group">
      <h2>{group.label}</h2>
      <div className="fit-term-table-wrap">
        <table className="fit-term-table fit-term-table--weapons">
          <thead>
            <tr>
              <th>Hardpoint</th>
              <th>Size</th>
              <th>Weapon</th>
              <th>Type</th>
              <th>Damage</th>
              <th>Alpha</th>
              <th>Share</th>
              <th>Range</th>
              <th>Speed</th>
              <th>Lifetime</th>
              <th>Fire Rate</th>
              <th>Ammo</th>
              <th>Power</th>
              <th>Heat</th>
              <th>Coolant</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const entry = entries[row.portId];
              const stats = entry?.stats;
              return (
                <tr key={row.portId}>
                  <td>{entry?.portLabel ?? portShortLabel(row)}</td>
                  <td>{entry?.size ?? (row.componentSize != null ? `S${row.componentSize}` : "—")}</td>
                  <td>{entry?.name ?? row.equippedComponentName ?? "—"}</td>
                  <td>{entry?.type ?? "—"}</td>
                  <td>{entry?.loading || !entry ? "…" : entry.damageType}</td>
                  <td>{entry?.loading || !entry ? "…" : entry.alpha}</td>
                  <td>{entry?.alphaShare ?? "—"}</td>
                  <td>{statOrUnavailable(stats?.calculatedRange)}</td>
                  <td>{statOrUnavailable(stats?.projectileSpeed)}</td>
                  <td>{statOrUnavailable(stats?.projectileLifetime)}</td>
                  <td>{statOrUnavailable(stats?.fireRateRpm, " RPM")}</td>
                  <td>{statOrUnavailable(stats?.ammoCapacity)}</td>
                  <td>{statOrUnavailable(stats?.powerDraw, " MW")}</td>
                  <td>{statOrUnavailable(stats?.heatGenerated)}</td>
                  <td>{statOrUnavailable(stats?.coolingDraw, " kW")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
