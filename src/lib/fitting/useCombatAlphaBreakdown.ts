import { useEffect, useMemo, useState } from "react";
import { loadVehicleFittingComponent } from "./fittingComponentStore";
import {
  aggregateDamageAlpha,
  buildOffensiveGroups,
  type PortBreakdownRow,
} from "./fittingPortGrouping";

export type CombatAlphaBreakdown = {
  gunAlpha: number | null;
  pilotAlpha: number | null;
  crewAlpha: number | null;
  missileAlpha: number | null;
  torpedoAlpha: number | null;
  byDamageType: Record<string, number | null>;
  loading: boolean;
};

const gunGroupKeys = new Set(["pilot-weapons", "remote-turrets", "manned-turrets", "installed-weapons"]);
const pilotGroupKeys = new Set(["pilot-weapons", "installed-weapons"]);
const crewGroupKeys = new Set(["remote-turrets", "manned-turrets"]);

function sumAlphas(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (nums.length === 0) return null;
  return nums.reduce((sum, value) => sum + value, 0);
}

export function useCombatAlphaBreakdown(portRows: PortBreakdownRow[]): CombatAlphaBreakdown {
  const [statsByComponentId, setStatsByComponentId] = useState<Record<string, Record<string, number | null>>>({});
  const [loading, setLoading] = useState(false);

  const weaponRows = useMemo(() => {
    const groups = buildOffensiveGroups(portRows);
    return groups
      .filter((group) => gunGroupKeys.has(group.key) || group.key === "missiles" || group.key === "torpedoes")
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

    let cancelled = false;
    queueMicrotask(() => setLoading(true));

    void (async () => {
      const next: Record<string, Record<string, number | null>> = {};
      for (const componentId of componentIds) {
        try {
          const detail = await loadVehicleFittingComponent(componentId);
          if (cancelled) return;
          next[componentId] = detail.stats;
        } catch {
          if (cancelled) return;
          next[componentId] = {};
        }
      }
      if (!cancelled) {
        setStatsByComponentId(next);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [componentIds]);

  return useMemo(() => {
    const groups = buildOffensiveGroups(portRows);
    const alphaForGroup = (key: string) => {
      const rows = groups.find((group) => group.key === key)?.rows ?? [];
      return sumAlphas(rows.map((row) => (row.equippedComponentKey ? statsByComponentId[row.equippedComponentKey]?.alphaDamage : null)));
    };

    const gunStats = groups
      .filter((group) => gunGroupKeys.has(group.key))
      .flatMap((group) => group.rows)
      .map((row) => (row.equippedComponentKey ? statsByComponentId[row.equippedComponentKey] : null))
      .filter((stats): stats is Record<string, number | null> => !!stats);

    const damageTotals = aggregateDamageAlpha(gunStats);
    const byDamageType: Record<string, number | null> = {};
    for (const [type, value] of Object.entries(damageTotals)) {
      byDamageType[type] = value;
    }

    const alphaForGroups = (keys: Set<string>) => sumAlphas(
      groups
        .filter((group) => keys.has(group.key))
        .flatMap((group) => group.rows)
        .map((row) => (row.equippedComponentKey ? statsByComponentId[row.equippedComponentKey]?.alphaDamage : null)),
    );

    return {
      gunAlpha: alphaForGroups(gunGroupKeys),
      pilotAlpha: alphaForGroups(pilotGroupKeys),
      crewAlpha: alphaForGroups(crewGroupKeys),
      missileAlpha: alphaForGroup("missiles"),
      torpedoAlpha: alphaForGroup("torpedoes"),
      byDamageType,
      loading,
    };
  }, [loading, portRows, statsByComponentId]);
}
