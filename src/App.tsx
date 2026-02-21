import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import DoctrineFirstFramework from "./pages/DoctrineFirstFramework";
import HeroOpening from "./pages/HeroOpening";
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
      <Route element={<AppShell />}>
        <Route index element={<EntryGate />} />
        <Route path="framework" element={<DoctrineFirstFramework />} />

        <Route path="ships/perseus" element={<WipPage section="Ships" title="Perseus" />} />
        <Route path="ships/polaris" element={<WipPage section="Ships" title="Polaris" />} />
        <Route path="ships/idris" element={<WipPage section="Ships" title="Idris" />} />

        <Route path="systems/sub-targeting" element={<WipPage section="Systems" title="Sub Targeting" />} />
        <Route path="systems/turret-keybinds" element={<WipPage section="Systems" title="Turret Keybinds" />} />
        <Route
          path="systems/turret-keybinds/additional"
          element={<WipPage section="Systems" title="Additional Settings & Binds" />}
        />
        <Route path="systems/gunnery-with-luna" element={<WipPage section="Systems" title="Gunnery with Luna" />} />
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
