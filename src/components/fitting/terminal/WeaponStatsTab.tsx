import { useEffect, useMemo, useState } from "react";
import { getFittingComponent, type FittingComponentDetail } from "../../../lib/fitting/fittingApi";
import {
  buildOffensiveGroups,
  formatNumber,
  type NamedGroup,
  type PortBreakdownRow,
} from "../../../lib/fitting/fittingPortGrouping";

type WeaponStatEntry = {
  portId: string;
  name: string;
  size: string;
  type: string;
  alpha: string;
  alphaShare: string;
  stats: FittingComponentDetail["stats"] | null;
  loading: boolean;
};

function statOrUnavailable(value: number | null | undefined, suffix = ""): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Source data unavailable";
  return `${formatNumber(value)}${suffix}`;
}

type WeaponStatsTabProps = {
  portRows: PortBreakdownRow[];
  totalAlpha: number | null;
};

export default function WeaponStatsTab({ portRows, totalAlpha }: WeaponStatsTabProps) {
  const groups = useMemo(() => buildOffensiveGroups(portRows), [portRows]);
  const weaponGroups = groups.filter((group) =>
    ["pilot-weapons", "remote-turrets", "manned-turrets", "missiles", "torpedoes", "emp-qed"].includes(group.key),
  );
  const [entries, setEntries] = useState<Record<string, WeaponStatEntry>>({});

  useEffect(() => {
    const controller = new AbortController();
    const weaponRows = weaponGroups
      .flatMap((group) => group.rows)
      .filter((row) => row.equippedComponentKey);
    const uniqueIds = [...new Set(weaponRows.map((row) => row.equippedComponentKey!))];

    void (async () => {
      for (const componentId of uniqueIds) {
        const row = weaponRows.find((entry) => entry.equippedComponentKey === componentId)!;
        try {
          const detail = await getFittingComponent(componentId, controller.signal);
          if (controller.signal.aborted) return;
          const alpha = detail.stats.alphaDamage;
          const share = totalAlpha != null && alpha != null && totalAlpha > 0
            ? `${formatNumber((alpha / totalAlpha) * 100)}%`
            : "—";
          setEntries((current) => ({
            ...current,
            [componentId]: {
              portId: row.portId,
              name: detail.displayName || detail.name,
              size: detail.size != null ? `S${detail.size}` : "—",
              type: detail.subtype ?? detail.type,
              alpha: statOrUnavailable(alpha),
              alphaShare: share,
              stats: detail.stats,
              loading: false,
            },
          }));
        } catch {
          if (controller.signal.aborted) return;
          setEntries((current) => ({
            ...current,
            [componentId]: {
              portId: row.portId,
              name: row.equippedComponentName ?? componentId,
              size: row.componentSize != null ? `S${row.componentSize}` : "—",
              type: row.componentSubtype ?? "—",
              alpha: "Requires fitting API",
              alphaShare: "—",
              stats: null,
              loading: false,
            },
          }));
        }
      }
    })();

    return () => controller.abort();
  }, [weaponGroups, totalAlpha]);

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
      <table className="fit-term-table fit-term-table--weapons">
        <thead>
          <tr>
            <th>Port</th>
            <th>Size</th>
            <th>Weapon</th>
            <th>Type</th>
            <th>Alpha</th>
            <th>Share</th>
            <th>Range</th>
            <th>Speed</th>
            <th>Fire Rate</th>
            <th>Power</th>
            <th>Heat</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const entry = row.equippedComponentKey ? entries[row.equippedComponentKey] : undefined;
            const stats = entry?.stats;
            return (
              <tr key={row.portId}>
                <td>{row.portId.split("/").pop() ?? row.portId}</td>
                <td>{entry?.size ?? (row.componentSize != null ? `S${row.componentSize}` : "—")}</td>
                <td>{entry?.name ?? row.equippedComponentName ?? "—"}</td>
                <td>{entry?.type ?? "—"}</td>
                <td>{entry?.loading || !entry ? "…" : entry.alpha}</td>
                <td>{entry?.alphaShare ?? "—"}</td>
                <td>{statOrUnavailable(stats?.calculatedRange)}</td>
                <td>{statOrUnavailable(stats?.projectileSpeed)}</td>
                <td className="fit-term-unavail">Raw stat unavailable</td>
                <td>{statOrUnavailable(stats?.powerDraw, " MW")}</td>
                <td>{statOrUnavailable(stats?.heatGenerated)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="fit-term-note">DPS and TTK are intentionally excluded. Fire rate shown only when present in source data.</p>
    </section>
  );
}
