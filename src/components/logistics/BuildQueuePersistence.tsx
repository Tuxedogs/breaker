import { useEffect } from "react";

import { useAuthSession } from "../../lib/auth/useAuthSession";
import { rehydrateBuildQueueItems } from "../../lib/buildQueueRehydration";
import { getCraftingItems } from "../../lib/craftingData";
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
    Promise.all([
      fetchUserBuildQueue(accessToken),
      getCraftingItems(),
    ])
      .then(([rows, recipes]) => {
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
