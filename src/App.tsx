import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import AppShell from "./components/AppShell";
import DashboardShell from "./components/dashboard/DashboardShell";

import DashboardPage from "./pages/DashboardPage";
import DoctrineFirstFramework from "./pages/DoctrineFirstFramework";
import DoctrineLibraryPage from "./pages/DoctrineLibraryPage";
import DoctrineModulePage from "./pages/DoctrineModulePage";
import DoctrineReferencePage from "./pages/DoctrineReferencePage";
import ModuleIndexPage from "./pages/ModuleIndexPage";

/* Lazy loaded tools because shipping everything up front is a cry for help */
const ViewerPage = lazy(() => import("./tools/viewer/ViewerPage"));

const LogisticsPage = lazy(() => import("./pages/logistics/LogisticsPage"));
const InventoryPage = lazy(() => import("./pages/logistics/InventoryPage"));
const LocationsPage = lazy(() => import("./pages/logistics/LocationsPage"));
const BuildQueuePage = lazy(() => import("./pages/logistics/BuildQueuePage"));

const AlphaThresholdToolPage = lazy(() =>
  import("./tools/alpha-threshold").then((module) => ({
    default: module.AlphaThresholdToolPage,
  }))
);

const GunneryToolPage = lazy(() =>
  import("./tools/gunnery").then((module) => ({
    default: module.GunneryToolPage,
  }))
);

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 text-center">
      <p className="base-card-kicker">Loading...</p>
    </div>
  );
}

function RedirectToDashboard() {
  const location = useLocation();
  return <Navigate to={`/dashboard${location.search}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route index element={<RedirectToDashboard />} />
      <Route path="index" element={<RedirectToDashboard />} />
      <Route path="framework" element={<RedirectToDashboard />} />
      <Route path="modules" element={<ModuleIndexPage />} />

      {/* Dashboard + Logistics share the same shell */}
      <Route element={<DashboardShell />}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="doctrine" element={<DoctrineLibraryPage />} />
        <Route
          path="logistics"
          element={<Suspense fallback={<RouteFallback />}><LogisticsPage /></Suspense>}
        />
        <Route
          path="logistics/inventory"
          element={<Suspense fallback={<RouteFallback />}><InventoryPage /></Suspense>}
        />
        <Route
          path="logistics/locations"
          element={<Suspense fallback={<RouteFallback />}><LocationsPage /></Suspense>}
        />
        <Route
          path="logistics/build-queue"
          element={<Suspense fallback={<RouteFallback />}><BuildQueuePage /></Suspense>}
        />
      </Route>

      {/* Main App */}
      <Route element={<AppShell />}>
        {/* Doctrine */}
        <Route path="framework-legacy" element={<DoctrineFirstFramework />} />
        <Route path="module/:id" element={<DoctrineModulePage />} />
        <Route path="refs/:type/:id" element={<DoctrineReferencePage />} />

        {/* Tools */}
        <Route
          path="maps"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ViewerPage />
            </Suspense>
          }
        />

        <Route
          path="tools/alpha-threshold"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AlphaThresholdToolPage />
            </Suspense>
          }
        />

        <Route
          path="tools/gunnery"
          element={
            <Suspense fallback={<RouteFallback />}>
              <GunneryToolPage />
            </Suspense>
          }
        />

        {/* Legacy redirects — preserve old URLs */}
        <Route
          path="systems/sub-targeting"
          element={<Navigate to="/module/sub-targeting" replace />}
        />

        <Route
          path="systems/turret-keybinds"
          element={<Navigate to="/module/turret-keybind-baseline" replace />}
        />

        <Route
          path="systems/turret-keybinds/additional"
          element={<Navigate to="/module/turret-keybind-baseline" replace />}
        />

        <Route
          path="anti-cap/component-sniping"
          element={<Navigate to="/module/component-sniping" replace />}
        />

        {/* Catch all */}
        <Route path="*" element={<RedirectToDashboard />} />
      </Route>
    </Routes>
  );
}
