import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import DashboardShell from "./components/dashboard/DashboardShell";

import DashboardPage from "./pages/DashboardPage";
import DoctrineLibraryPage from "./pages/DoctrineLibraryPage";
import DoctrineModulePage from "./pages/DoctrineModulePage";
import ModuleIndexPage from "./pages/ModuleIndexPage";

/* Lazy loaded tools because shipping everything up front is a cry for help */
const LogisticsPage = lazy(() => import("./pages/logistics/LogisticsPage"));
const InventoryPage = lazy(() => import("./pages/logistics/InventoryPage"));
const LocationsPage = lazy(() => import("./pages/logistics/LocationsPage"));
const BuildQueuePage = lazy(() => import("./pages/logistics/BuildQueuePage"));
const RefineryImportPage = lazy(() => import("./pages/logistics/RefineryImportPage"));

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

function RedirectToDashboardDoctrine() {
  const location = useLocation();
  return <Navigate to={`/dashboard/doctrine${location.search}`} replace />;
}

function RedirectToDashboardDoctrineLibrary() {
  const location = useLocation();
  return <Navigate to={`/dashboard/doctrine/library${location.search}`} replace />;
}

function RedirectLegacyDoctrineModule() {
  const location = useLocation();
  return <Navigate to={`/dashboard/doctrine/module/${location.pathname.split("/").pop() ?? ""}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route index element={<RedirectToDashboard />} />
      <Route path="index" element={<RedirectToDashboard />} />
      <Route path="framework" element={<RedirectToDashboard />} />
      <Route path="modules" element={<ModuleIndexPage />} />
      <Route path="doctrine" element={<RedirectToDashboardDoctrine />} />
      <Route path="doctrine/library" element={<RedirectToDashboardDoctrineLibrary />} />
      <Route path="doctrine/weapons-matrix" element={<Navigate to="/dashboard/doctrine/weapons-matrix" replace />} />
      <Route path="doctrine/armor-threshold" element={<Navigate to="/dashboard/doctrine/armor-threshold" replace />} />
      <Route path="module/:id" element={<RedirectLegacyDoctrineModule />} />
      <Route path="refs/:type/:id" element={<Navigate to="/dashboard/doctrine/library" replace />} />
      <Route path="framework-legacy" element={<Navigate to="/dashboard/doctrine/library" replace />} />
      <Route
        path="systems/sub-targeting"
        element={<Navigate to="/dashboard/doctrine/module/sub-targeting" replace />}
      />
      <Route
        path="systems/turret-keybinds"
        element={<Navigate to="/dashboard/doctrine/module/turret-keybind-baseline" replace />}
      />
      <Route
        path="systems/turret-keybinds/additional"
        element={<Navigate to="/dashboard/doctrine/module/turret-keybind-baseline" replace />}
      />
      <Route
        path="anti-cap/component-sniping"
        element={<Navigate to="/dashboard/doctrine/module/component-sniping" replace />}
      />

      {/* Legacy redirects — preserve old standalone tool URLs */}
      <Route path="maps" element={<Navigate to="/ships/maps" replace />} />

      {/* Dashboard shell — sidebar + topbar always visible */}
      <Route element={<DashboardShell />}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="dashboard/doctrine" element={<DoctrineLibraryPage />} />
        <Route path="dashboard/doctrine/library" element={<DoctrineLibraryPage />} />
        <Route path="dashboard/doctrine/module/:id" element={<DoctrineModulePage />} />
        <Route
          path="dashboard/doctrine/weapons-matrix"
          element={<Suspense fallback={<RouteFallback />}><AlphaThresholdToolPage /></Suspense>}
        />
        <Route
          path="dashboard/doctrine/armor-threshold"
          element={<Suspense fallback={<RouteFallback />}><AlphaThresholdToolPage /></Suspense>}
        />

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
          path="logistics/locations/:locationId"
          element={<Suspense fallback={<RouteFallback />}><LocationsPage /></Suspense>}
        />
        <Route
          path="logistics/build-queue"
          element={<Suspense fallback={<RouteFallback />}><BuildQueuePage /></Suspense>}
        />
        <Route
          path="logistics/refinery-import"
          element={<Suspense fallback={<RouteFallback />}><RefineryImportPage /></Suspense>}
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

      <Route path="*" element={<RedirectToDashboard />} />

    </Routes>
  );
}
