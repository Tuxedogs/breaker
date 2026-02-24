import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import DoctrineFirstFramework from "./pages/DoctrineFirstFramework";
import DoctrineLanding from "./pages/DoctrineLanding";
import HeroOpening from "./pages/HeroOpening";
import MapsPage from "./pages/MapsPage";
import PerseusPage from "./pages/ships/PerseusPage";
import AdditionalSettingsPage from "./pages/systems/AdditionalSettingsPage";
import GunneryWithLunaPage from "./pages/systems/GunneryWithLunaPage";
import SubTargetingPage from "./pages/systems/SubTargetingPage";
import TurretKeybindsPage from "./pages/systems/TurretKeybindsPage";
import WipPage from "./pages/WipPage";

const ENTRY_STORAGE_KEY = "ares:entered-framework";

function EntryGate() {
  const hasEntered = sessionStorage.getItem(ENTRY_STORAGE_KEY) === "true";
  if (hasEntered) {
    return <Navigate to="/framework" replace />;
  }

  return <HeroOpening />;
}

export default function App() {
  return (
    <Routes>
      <Route path="doctrine-landing" element={<DoctrineLanding />} />
      <Route element={<AppShell />}>
        <Route index element={<EntryGate />} />
        <Route path="framework" element={<DoctrineFirstFramework />} />
        <Route path="maps" element={<MapsPage />} />

        <Route path="ships/perseus" element={<PerseusPage />} />
        <Route path="ships/polaris" element={<WipPage section="Ships" title="Polaris" />} />
        <Route path="ships/idris" element={<WipPage section="Ships" title="Idris" />} />

        <Route path="systems/sub-targeting" element={<SubTargetingPage />} />
        <Route path="systems/turret-keybinds" element={<TurretKeybindsPage />} />
        <Route path="systems/additional-settings-binds" element={<AdditionalSettingsPage />} />
        <Route
          path="systems/turret-keybinds/additional"
          element={<Navigate to="/systems/additional-settings-binds" replace />}
        />
        <Route path="systems/gunnery-with-luna" element={<GunneryWithLunaPage />} />
        <Route path="systems/communications" element={<WipPage section="Systems" title="Communications" />} />
        <Route
          path="systems/additional-resources"
          element={<WipPage section="Systems" title="Additional Resources" />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
