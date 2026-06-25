import { useEffect, useMemo, useState } from "react";
import { getFittingComponent } from "./fittingApi";
import {
  buildOffensiveGroups,
  type PortBreakdownRow,
} from "./fittingPortGrouping";

export type CombatAlphaBreakdown = {
  gunAlpha: number | null;
  missileAlpha: number | null;
  torpedoAlpha: number | null;
  byDamageType: Record<string, number | null>;
  loading: boolean;
};

const gunGroupKeys = new Set(["pilot-weapons", "remote-turrets", "manned-turrets", "installed-weapons"]);

function sumAlphas(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (nums.length === 0) return null;
  return nums.reduce((sum, value) => sum + value, 0);
}

export function useCombatAlphaBreakdown(portRows: PortBreakdownRow[]): CombatAlphaBreakdown {
  const [alphaByComponentId, setAlphaByComponentId] = useState<Record<string, number | null>>({});
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
        setAlphaByComponentId({});
        setLoading(false);
      });
      return;
    }

    const controller = new AbortController();
    queueMicrotask(() => setLoading(true));

    void (async () => {
      const next: Record<string, number | null> = {};
      for (const componentId of componentIds) {
        try {
          const detail = await getFittingComponent(componentId, controller.signal);
          if (controller.signal.aborted) return;
          next[componentId] = detail.stats.alphaDamage ?? null;
        } catch {
          if (controller.signal.aborted) return;
          next[componentId] = null;
        }
      }
      if (!controller.signal.aborted) {
        setAlphaByComponentId(next);
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [componentIds]);

  return useMemo(() => {
    const groups = buildOffensiveGroups(portRows);
    const alphaForGroup = (key: string) => {
      const rows = groups.find((group) => group.key === key)?.rows ?? [];
      return sumAlphas(rows.map((row) => (row.equippedComponentKey ? alphaByComponentId[row.equippedComponentKey] : null)));
    };

    return {
      gunAlpha: sumAlphas(
        groups
          .filter((group) => gunGroupKeys.has(group.key))
          .flatMap((group) => group.rows)
          .map((row) => (row.equippedComponentKey ? alphaByComponentId[row.equippedComponentKey] : null)),
      ),
      missileAlpha: alphaForGroup("missiles"),
      torpedoAlpha: alphaForGroup("torpedoes"),
      byDamageType: {},
      loading,
    };
  }, [alphaByComponentId, loading, portRows]);
}
