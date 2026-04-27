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
const LogisticsPage = lazy(() => import("./pages/logistics/LogisticsPage"));
const InventoryPage = lazy(() => import("./pages/logistics/InventoryPage"));
const LocationsPage = lazy(() => import("./pages/logistics/LocationsPage"));
const BuildQueuePage = lazy(() => import("./pages/logistics/BuildQueuePage"));

const ShipMapsPage = lazy(() => import("./pages/ships/maps/ShipMapsPage"));

const AlphaThresholdToolPage = lazy(() =>
  import("./tools/alpha-threshold").then((module) => ({
    default: module.AlphaThresholdToolPage,
  }))
);

const ComponentMappingPage = lazy(() =>
  import("./tools/gunnery/ComponentMappingPage").then((module) => ({
    default: module.ComponentMappingPage,
  }))
);

const GimbalModesPage = lazy(() => import("./pages/GimbalModesPage"));

const IndustryCraftingPage = lazy(() => import("./pages/industry/CraftingPage"));

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

      {/* Legacy redirects — preserve old standalone tool URLs */}
      <Route path="maps" element={<Navigate to="/ships/maps" replace />} />

      {/* Dashboard shell — sidebar + topbar always visible */}
      <Route element={<DashboardShell />}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="doctrine" element={<DoctrineLibraryPage />} />

        {/* Logistics */}
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

        {/* Combat tools */}
        <Route
          path="tools/alpha-threshold"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AlphaThresholdToolPage />
            </Suspense>
          }
        />
        <Route
          path="combat/component-mapping"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ComponentMappingPage />
            </Suspense>
          }
        />
        <Route
          path="doctrine/gimbal-modes"
          element={
            <Suspense fallback={<RouteFallback />}>
              <GimbalModesPage />
            </Suspense>
          }
        />
        {/* Legacy redirect — preserve old gunnery URL */}
        <Route path="tools/gunnery" element={<Navigate to="/combat/component-mapping" replace />} />
        <Route path="tools/component-mapping" element={<Navigate to="/combat/component-mapping" replace />} />

        {/* Industry */}
        <Route
          path="industry/crafting"
          element={
            <Suspense fallback={<RouteFallback />}>
              <IndustryCraftingPage />
            </Suspense>
          }
        />

        {/* Ships */}
        <Route
          path="ships/maps"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ShipMapsPage />
            </Suspense>
          }
        />
      </Route>

      {/* Main App — doctrine + legacy module pages */}
      <Route element={<AppShell />}>
        <Route path="framework-legacy" element={<DoctrineFirstFramework />} />
        <Route path="module/:id" element={<DoctrineModulePage />} />
        <Route path="refs/:type/:id" element={<DoctrineReferencePage />} />

        {/* Legacy redirects — preserve old module URLs */}
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
