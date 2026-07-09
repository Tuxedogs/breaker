import { useEffect, useMemo, useState } from "react";
import { getFittingComponent } from "./fittingApi";
import {
  buildOffensiveGroups,
  formatNumber,
  inferDamageType,
  type PortBreakdownRow,
} from "./fittingPortGrouping";
import { resolveWeaponDps } from "./fittingWeaponStats";

export type MockupCombatStats = {
  pilotAlpha: number | null;
  pilotDps: number | null;
  turretAlpha: number | null;
  turretDps: number | null;
  crewAlpha: number | null;
  crewDps: number | null;
  statsByComponentId: Record<string, Record<string, number | null>>;
  loading: boolean;
};

function sumValues(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (nums.length === 0) return null;
  return nums.reduce((sum, value) => sum + value, 0);
}

function alphaForRows(
  rows: PortBreakdownRow[],
  statsByComponentId: Record<string, Record<string, number | null>>,
): number | null {
  return sumValues(rows.map((row) => (
    row.equippedComponentKey ? statsByComponentId[row.equippedComponentKey]?.alphaDamage : null
  )));
}

function dpsForRows(
  rows: PortBreakdownRow[],
  statsByComponentId: Record<string, Record<string, number | null>>,
): number | null {
  return sumValues(rows.map((row) => {
    if (!row.equippedComponentKey) return null;
    const stats = statsByComponentId[row.equippedComponentKey];
    return resolveWeaponDps(stats).dps;
  }));
}

export function useFittingMockupCombatStats(portRows: PortBreakdownRow[]): MockupCombatStats {
  const [statsByComponentId, setStatsByComponentId] = useState<Record<string, Record<string, number | null>>>({});
  const [loading, setLoading] = useState(false);

  const weaponRows = useMemo(() => {
    const groups = buildOffensiveGroups(portRows);
    return groups
      .filter((group) => [
        "pilot-weapons",
        "installed-weapons",
        "remote-turrets",
        "manned-turrets",
      ].includes(group.key))
      .flatMap((group) => group.rows)
      .filter((row) => row.equippedComponentKey);
  }, [portRows]);

  const componentIds = useMemo(
    () => [...new Set(weaponRows.map((row) => row.equippedComponentKey!))],
    [weaponRows],
  );

  useEffect(() => {
    if (componentIds.length === 0) {
      queueMicrotask(() => {
        setStatsByComponentId({});
        setLoading(false);
      });
      return;
    }

    const controller = new AbortController();
    queueMicrotask(() => setLoading(true));

    void (async () => {
      const next: Record<string, Record<string, number | null>> = {};
      for (const componentId of componentIds) {
        try {
          const detail = await getFittingComponent(componentId, controller.signal);
          if (controller.signal.aborted) return;
          next[componentId] = detail.stats;
        } catch {
          if (controller.signal.aborted) return;
          next[componentId] = {};
        }
      }
      if (!controller.signal.aborted) {
        setStatsByComponentId(next);
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [componentIds]);

  return useMemo(() => {
    const groups = buildOffensiveGroups(portRows);
    const pilotRows = groups.find((group) => group.key === "pilot-weapons")?.rows ?? [];
    const crewRows = groups.find((group) => group.key === "installed-weapons")?.rows ?? [];
    const turretRows = [
      ...(groups.find((group) => group.key === "remote-turrets")?.rows ?? []),
      ...(groups.find((group) => group.key === "manned-turrets")?.rows ?? []),
    ];

    return {
      pilotAlpha: alphaForRows(pilotRows, statsByComponentId),
      pilotDps: dpsForRows(pilotRows, statsByComponentId),
      turretAlpha: alphaForRows(turretRows, statsByComponentId),
      turretDps: dpsForRows(turretRows, statsByComponentId),
      crewAlpha: alphaForRows(crewRows, statsByComponentId),
      crewDps: dpsForRows(crewRows, statsByComponentId),
      statsByComponentId,
      loading,
    };
  }, [loading, portRows, statsByComponentId]);
}

export function formatCombatValue(value: number | null | undefined, loading = false): string {
  if (loading) return "...";
  if (typeof value === "number" && Number.isFinite(value)) return formatNumber(value);
  return "Not calculated yet";
}

export function formatAlphaWithDps(alpha: number | null, dps: number | null, loading = false): string {
  const alphaText = formatCombatValue(alpha, loading);
  const dpsText = formatCombatValue(dps, loading);
  if (alphaText === "Not calculated yet" && dpsText === "Not calculated yet") return "Not calculated yet";
  if (dpsText === "Not calculated yet") return alphaText;
  return `${alphaText} · ${dpsText} DPS`;
}

export function damageFamilyForRow(
  row: PortBreakdownRow,
  statsByComponentId: Record<string, Record<string, number | null>>,
): string | null {
  const stats = row.equippedComponentKey ? statsByComponentId[row.equippedComponentKey] : null;
  if (!stats) return null;
  return inferDamageType(stats);
}

export function statText(
  value: number | null | undefined,
  unit = "",
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not calculated yet";
  return `${formatNumber(value)}${unit}`;
}

export function resolveDrawerWeaponDps(
  stats: Record<string, number | null | undefined> | null | undefined,
): number | null {
  return resolveWeaponDps(stats).dps;
}
