import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Background from "./components/Background";
import AppShell from "./components/AppShell";
import DashboardShell from "./components/dashboard/DashboardShell";
import DashboardPage from "./pages/DashboardPage";
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

const ViewerPage = lazy(() => import("./tools/viewer/ViewerPage"));

function ViewerRouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 text-center">
      <p className="base-card-kicker">Loading viewer...</p>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Background />
      <Routes>
        <Route path="doctrine-landing" element={<DoctrineLanding />} />

        {/* Dashboard — own shell (sidebar + topbar) */}
        <Route element={<DashboardShell />}>
          <Route path="dashboard" element={<DashboardPage />} />
        </Route>

        <Route element={<AppShell />}>
          {/* Doctrine */}
          <Route index element={<DoctrineIndexPage />} />
          <Route path="index" element={<DoctrineIndexPage />} />
          <Route path="framework" element={<DoctrineIndexPage />} />
          <Route path="framework-legacy" element={<DoctrineFirstFramework />} />
          <Route path="modules" element={<ModuleIndexPage />} />
          <Route path="module/:id" element={<DoctrineModulePage />} />
          <Route path="refs/:type/:id" element={<DoctrineReferencePage />} />

          {/* Tools */}
          <Route
            path="maps"
            element={(
              <Suspense fallback={<ViewerRouteFallback />}>
                <ViewerPage />
              </Suspense>
            )}
          />
          <Route path="tools/alpha-threshold" element={<AlphaThresholdToolPage />} />
          <Route path="tools/gunnery" element={<GunneryToolPage />} />

          {/* Redirects */}
          <Route path="systems/sub-targeting" element={<Navigate to="/module/sub-targeting" replace />} />
          <Route path="systems/turret-keybinds" element={<Navigate to="/module/turret-keybind-baseline" replace />} />
          <Route
            path="systems/turret-keybinds/additional"
            element={<Navigate to="/module/turret-keybind-baseline" replace />}
          />
          <Route
            path="anti-cap/component-sniping"
            element={<Navigate to="/module/component-sniping" replace />}
          />

          {/* Legacy/WIP pages */}
          <Route path="systems/additional-settings-binds" element={<AdditionalSettingsPage />} />
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}
