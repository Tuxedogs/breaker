import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import DashboardShell from "./components/dashboard/DashboardShell";
import SignatureDock from "./components/SignatureDock";
import { SignatureDockProvider } from "./lib/SignatureDockProvider";
import OnlinePersistenceCoordinator from "./components/logistics/OnlinePersistenceCoordinator";
import { AuthSessionProvider } from "./lib/auth/useAuthSession";

import DashboardPage from "./pages/DashboardPage";
import ModuleIndexPage from "./pages/ModuleIndexPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";

/* Lazy loaded tools because shipping everything up front is a cry for help */
const DoctrineLibraryPage = lazy(() => import("./pages/DoctrineLibraryPage"));
const DoctrineModulePage = lazy(() => import("./pages/DoctrineModulePage"));
const LogisticsPage = lazy(() => import("./pages/logistics/LogisticsPage"));
const InventoryPage = lazy(() => import("./pages/logistics/InventoryPage"));
const InventoryFixturePage = lazy(() => import("./pages/logistics/InventoryFixturePage"));
const RefineryImportPage = lazy(() => import("./pages/logistics/RefineryImportPage"));
const BuildQueuePage = lazy(() => import("./pages/logistics/BuildQueuePage"));
const BuildQueueFixturePage = lazy(() => import("./pages/logistics/BuildQueueFixturePage"));
const CarrierLogisticsPage = lazy(() => import("./pages/logistics/CarrierLogisticsPage"));
const FittingPage = lazy(() => import("./pages/FittingPage"));
const FittingMockupPage = lazy(() => import("./pages/FittingMockupPage"));

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
const IndustryCraftingLayout = lazy(() =>
  import("./components/industry/crafting/CraftingLayout").then((m) => ({ default: m.default }))
);
const IndustryMiningPage = lazy(() => import("./pages/industry/MiningPage"));
const IndustryBlueprintTrackerPage = lazy(() => import("./pages/industry/BlueprintTrackerPage"));
const IndustryMissionBrowserPage = lazy(() => import("./pages/industry/MissionBrowserPage"));
const IndustryRefineryPlannerPage = lazy(() => import("./pages/industry/RefineryPlannerPage"));

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

function FittingRoute() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <FittingPage />
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthSessionProvider>
      <OnlinePersistenceCoordinator />
      <SignatureDockProvider>
        <SignatureDock />
        <Routes>
        <Route index element={<RedirectToDashboard />} />
        <Route path="home" element={<RedirectToDashboard />} />
        <Route path="index" element={<RedirectToDashboard />} />
        <Route path="framework" element={<RedirectToDashboard />} />
        <Route path="modules" element={<ModuleIndexPage />} />
        <Route path="doctrine" element={<RedirectToDashboardDoctrine />} />
        <Route path="doctrine/library" element={<RedirectToDashboardDoctrineLibrary />} />
        <Route path="doctrine/armor-threshold" element={<Navigate to="/dashboard/doctrine/armor-threshold" replace />} />
        <Route path="module/:id" element={<RedirectLegacyDoctrineModule />} />
        <Route path="refs/:type/:id" element={<Navigate to="/dashboard/doctrine/library" replace />} />
        <Route path="framework-legacy" element={<Navigate to="/dashboard/doctrine/library" replace />} />
        <Route path="auth/callback" element={<AuthCallbackPage />} />
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

      {/* Dashboard shell — sidebar + topbar always visible */}
      <Route element={<DashboardShell />}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route
          path="dashboard/doctrine"
          element={<Suspense fallback={<RouteFallback />}><DoctrineLibraryPage /></Suspense>}
        />
        <Route
          path="dashboard/doctrine/library"
          element={<Suspense fallback={<RouteFallback />}><DoctrineLibraryPage /></Suspense>}
        />
        <Route
          path="dashboard/doctrine/module/:id"
          element={<Suspense fallback={<RouteFallback />}><DoctrineModulePage /></Suspense>}
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
        {import.meta.env.DEV ? (
          <Route
            path="logistics/inventory/__fixture/layout"
            element={<Suspense fallback={<RouteFallback />}><InventoryFixturePage /></Suspense>}
          />
        ) : null}
        <Route
          path="logistics/inventory/refinery-import"
          element={<Suspense fallback={<RouteFallback />}><RefineryImportPage /></Suspense>}
        />
        <Route
          path="logistics/refinery-import"
          element={<Navigate to="/logistics/inventory/refinery-import" replace />}
        />
        <Route
          path="logistics/carrier-logistics"
          element={<Suspense fallback={<RouteFallback />}><CarrierLogisticsPage /></Suspense>}
        />
        <Route
          path="logistics/build-queue"
          element={<Suspense fallback={<RouteFallback />}><BuildQueuePage /></Suspense>}
        />
        {import.meta.env.DEV ? (
          <Route
            path="logistics/build-queue/__fixture/stats"
            element={<Suspense fallback={<RouteFallback />}><BuildQueueFixturePage /></Suspense>}
          />
        ) : null}

        {/* Combat tools */}
        <Route
          path="tools/alpha-threshold"
          element={<Navigate to="/dashboard/doctrine/armor-threshold" replace />}
        />
        <Route
          path="combat/component-mapping"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ComponentMappingPage />
            </Suspense>
          }
        />
        <Route path="fitting" element={<FittingRoute />} />
        <Route path="fitting/:shipKey" element={<FittingRoute />} />
        {/* Legacy redirect — preserve old gunnery URL */}
        <Route path="tools/gunnery" element={<Navigate to="/combat/component-mapping" replace />} />
        <Route path="tools/component-mapping" element={<Navigate to="/combat/component-mapping" replace />} />

        {/* Industry */}
        <Route
          path="industry/crafting"
          element={
            <Suspense fallback={<RouteFallback />}>
              <IndustryCraftingLayout />
            </Suspense>
          }
        >
          <Route
            index
            element={
              <Suspense fallback={<RouteFallback />}>
                <IndustryCraftingPage />
              </Suspense>
            }
          />
          <Route
            path=":blueprintId"
            element={
              <Suspense fallback={<RouteFallback />}>
                <IndustryCraftingPage />
              </Suspense>
            }
          />
        </Route>
        <Route
          path="industry/mining"
          element={
            <Suspense fallback={<RouteFallback />}>
              <IndustryMiningPage />
            </Suspense>
          }
        />
        <Route
          path="industry/blueprint-tracker"
          element={
            <Suspense fallback={<RouteFallback />}>
              <IndustryBlueprintTrackerPage />
            </Suspense>
          }
        />
        <Route
          path="industry/missions"
          element={
            <Suspense fallback={<RouteFallback />}>
              <IndustryMissionBrowserPage />
            </Suspense>
          }
        />
        <Route
          path="industry/refinery"
          element={
            <Suspense fallback={<RouteFallback />}>
              <IndustryRefineryPlannerPage />
            </Suspense>
          }
        />

      </Route>

        {/* Full-viewport fitting mockup — outside dashboard shell */}
        <Route
          path="fitting-mockup"
          element={
            <Suspense fallback={<RouteFallback />}>
              <FittingMockupPage />
            </Suspense>
          }
        />

        <Route path="*" element={<RedirectToDashboard />} />

        </Routes>
      </SignatureDockProvider>
    </AuthSessionProvider>
  );
}
