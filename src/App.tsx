import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Background from "./components/Background";
import AppShell from "./components/AppShell";
import DoctrineIndexPage from "./pages/DoctrineIndexPage";
import DoctrineFirstFramework from "./pages/DoctrineFirstFramework";
import DoctrineLanding from "./pages/DoctrineLanding";
import DoctrineModulePage from "./pages/DoctrineModulePage";
import DoctrineReferencePage from "./pages/DoctrineReferencePage";
import ModuleIndexPage from "./pages/ModuleIndexPage";
import AdditionalSettingsPage from "./pages/systems/AdditionalSettingsPage";
import GunneryWithLunaPage from "./pages/systems/GunneryWithLunaPage";
import OnboardingPage from "./pages/systems/OnboardingPage";
import TraditionalModulePage from "./pages/TraditionalModulePage";
import WipPage from "./pages/WipPage";
import { AlphaThresholdToolPage } from "./tools/alpha-threshold";
import { GunneryToolPage } from "./tools/gunnery";

const MapsPage = lazy(() => import("./tools/maps/MapsPage"));

export default function App() {
  return (
    <>
      <Background />
      <Routes>
        <Route path="doctrine-landing" element={<DoctrineLanding />} />
        <Route element={<AppShell />}>
          <Route index element={<DoctrineIndexPage />} />
          <Route path="index" element={<DoctrineIndexPage />} />
          <Route path="framework" element={<DoctrineIndexPage />} />
          <Route path="framework-legacy" element={<DoctrineFirstFramework />} />
          <Route path="modules" element={<ModuleIndexPage />} />
          <Route path="module/:id" element={<DoctrineModulePage />} />
          <Route path="refs/:type/:id" element={<DoctrineReferencePage />} />
          <Route
            path="maps"
            element={(
              <Suspense fallback={<div className="p-6 text-sm text-slate-300">Loading maps viewer…</div>}>
                <MapsPage />
              </Suspense>
            )}
          />
          <Route path="tools/alpha-threshold" element={<AlphaThresholdToolPage />} />
          <Route path="tools/gunnery" element={<GunneryToolPage />} />

<Route path="systems/sub-targeting" element={<Navigate to="/module/sub-targeting" replace />} />
          <Route path="systems/turret-keybinds" element={<Navigate to="/module/turret-keybind-baseline" replace />} />
          <Route path="systems/additional-settings-binds" element={<AdditionalSettingsPage />} />
          <Route
            path="systems/turret-keybinds/additional"
            element={<Navigate to="/module/turret-keybind-baseline" replace />}
          />
          <Route path="systems/gunnery-with-luna" element={<GunneryWithLunaPage />} />
          <Route path="systems/communications" element={<TraditionalModulePage />} />
          <Route
            path="systems/additional-resources"
            element={<WipPage section="Systems" title="Additional Resources" />}
          />
          <Route path="wip/onboarding" element={<OnboardingPage />} />
          <Route path="wip/training" element={<WipPage section="Systems" title="Training" />} />
          <Route path="wip/organization" element={<WipPage section="Systems" title="Organization" />} />
          <Route path="wip/camera-tracking" element={<WipPage section="Systems" title="Camera and Tracking" />} />
          <Route path="wip/performance" element={<WipPage section="Systems" title="Performance" />} />
          <Route
            path="anti-cap/component-sniping"
            element={<Navigate to="/module/component-sniping" replace />}
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}
