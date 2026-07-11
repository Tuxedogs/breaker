import { Navigate } from "react-router-dom";

import InventoryPage from "./InventoryPage";
import { inventoryLayoutFixture } from "./inventoryLayoutFixture";

export default function InventoryFixturePage() {
  if (!import.meta.env.DEV) {
    return <Navigate to="/logistics/inventory" replace />;
  }

  return <InventoryPage fixture={inventoryLayoutFixture} />;
}
