import { useEffect, useState } from "react";

import type { InventoryUnitType } from "../../types/logistics";
import { getMaterialIdentityIndexFromApi } from "@/lib/craftingReferenceApi";

export interface MaterialIdentity {
  materialKey: string;
  canonicalName?: string;
  displayName: string;
  rawName?: string;
  refinedName?: string;
  commodityName?: string;
  materialForm: string;
  unitType: InventoryUnitType;
  isRefinable?: boolean;
  refinesToMaterialKey?: string | null;
  aliases?: Record<string, string[]> | string[];
}

let cachedMaterials: MaterialIdentity[] | null = null;
let loadPromise: Promise<MaterialIdentity[]> | null = null;

function isMaterialIdentity(value: unknown): value is MaterialIdentity {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.materialKey === "string"
    && typeof record.displayName === "string"
    && typeof record.materialForm === "string"
    && (record.unitType === "scu" || record.unitType === "unit");
}

function loadMaterialIdentities(): Promise<MaterialIdentity[]> {
  if (cachedMaterials) return Promise.resolve(cachedMaterials);
  if (loadPromise) return loadPromise;

  loadPromise = getMaterialIdentityIndexFromApi()
    .then((payload) => {
      const materials = Array.isArray(payload.materials) ? payload.materials.filter(isMaterialIdentity) : [];
      cachedMaterials = materials;
      return materials;
    })
    .catch((error) => {
      loadPromise = null;
      if (import.meta.env.DEV) console.warn("[inventory] material identity index unavailable", error);
      return [];
    });

  return loadPromise;
}

export function useMaterialIdentityIndex(): MaterialIdentity[] {
  const [materials, setMaterials] = useState<MaterialIdentity[]>(cachedMaterials ?? []);

  useEffect(() => {
    let cancelled = false;
    void loadMaterialIdentities().then((loaded) => {
      if (!cancelled) setMaterials(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return materials;
}
