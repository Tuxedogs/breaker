import { useEffect } from "react";

import { useAuthSession } from "../../lib/auth/useAuthSession";
import { rehydrateBuildQueueItems } from "../../lib/buildQueueRehydration";
import { getCraftingItemsByBlueprintGuids } from "../../lib/craftingData";
import { fetchUserBuildQueue } from "../../lib/userBuildQueue";
import { setBuildQueueAccessToken } from "../../lib/userBuildQueuePersistence";
import { useLogisticsStore } from "../../stores/logisticsStore";

export default function BuildQueuePersistence() {
  const { session } = useAuthSession();
  const accessToken = session?.access_token ?? null;
  const materialTemplates = useLogisticsStore((state) => state.materialTemplates);
  const replaceBuildQueueFromRemote = useLogisticsStore((state) => state.replaceBuildQueueFromRemote);

  useEffect(() => {
    setBuildQueueAccessToken(accessToken);
    if (!accessToken) return;

    let cancelled = false;
    fetchUserBuildQueue(accessToken)
      .then(async (rows) => {
        const blueprintGuids = rows.map((row) => (
          row.recipeId.startsWith("craft-") ? row.recipeId.slice("craft-".length) : row.recipeId
        ));
        const recipes = await getCraftingItemsByBlueprintGuids(blueprintGuids);
        return { rows, recipes };
      })
      .then(({ rows, recipes }) => {
        if (cancelled) return;
        const hydrated = rehydrateBuildQueueItems(rows, recipes, materialTemplates);
        replaceBuildQueueFromRemote(hydrated.buildQueue, {
          recipeTemplates: hydrated.recipeTemplates,
          recipeInputTemplates: hydrated.recipeInputTemplates,
        });
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) {
          console.warn("[build-queue] failed to hydrate user queue", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, materialTemplates, replaceBuildQueueFromRemote]);

  return null;
}
