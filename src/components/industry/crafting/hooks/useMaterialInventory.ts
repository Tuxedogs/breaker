import { useState, useCallback } from "react";
import type { MaterialInventory } from "../utils/craftingTypes";
import { loadMaterialInventory, saveMaterialInventory } from "../utils/craftingStorage";

export function useMaterialInventory() {
  const [inventory, setInventory] = useState<MaterialInventory>(loadMaterialInventory);

  const setAmount = useCallback((key: string, amount: number) => {
    setInventory((prev) => {
      const next = { ...prev, [key]: Math.max(0, amount) };
      saveMaterialInventory(next);
      return next;
    });
  }, []);

  const clearInventory = useCallback(() => {
    setInventory({});
    saveMaterialInventory({});
  }, []);

  return { inventory, setAmount, clearInventory };
}
