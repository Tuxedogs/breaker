import { Suspense, lazy, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";

import DashboardShell from "./components/dashboard/DashboardShell";
import AppPageShell from "./components/shared/AppPageShell";
import SignatureDock from "./components/SignatureDock";
import { SignatureDockProvider } from "./lib/SignatureDockProvider";
import OnlinePersistenceCoordinator from "./components/logistics/OnlinePersistenceCoordinator";
import { AuthSessionProvider } from "./lib/auth/useAuthSession";

import BreakerHomePage from "./pages/BreakerHomePage";
import ModuleIndexPage from "./pages/ModuleIndexPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import { loadBuildQueuePage } from "./pages/logistics/buildQueueRoute";

/* Lazy loaded tools because shipping everything up front is a cry for help */
const LogisticsPage = lazy(() => import("./pages/logistics/LogisticsPage"));
const InventoryPage = lazy(() => import("./pages/logistics/InventoryPage"));
const InventoryFixturePage = lazy(() => import("./pages/logistics/InventoryFixturePage"));
const BuildQueuePage = lazy(loadBuildQueuePage);
const BuildQueueFixturePage = lazy(() => import("./pages/logistics/BuildQueueFixturePage"));
const InventoryAddModalFixturePage = lazy(() => import("./pages/logistics/InventoryAddModalFixturePage"));
const CarrierLogisticsPage = lazy(() => import("./pages/logistics/CarrierLogisticsPage"));
const FittingPage = lazy(() => import("./pages/FittingPage"));
const FittingMockupPage = lazy(() => import("./pages/FittingMockupPage"));
const FittingV2Page = lazy(() => import("./pages/FittingV2Page"));
const FittingFixturePage = import.meta.env.DEV
  ? lazy(() => import("./pages/FittingFixturePage"))
  : null;
const FittingV2PowerFixturePage = import.meta.env.DEV
  ? lazy(() => import("./pages/FittingV2PowerFixturePage"))
  : null;

const IndustryCraftingPage = lazy(() => import("./pages/industry/CraftingPage"));
const CraftingTargetSliderFixturePage = lazy(() => import("./pages/industry/CraftingTargetSliderFixturePage"));
const CraftingDesignPreviewPage = lazy(() => import("./pages/industry/CraftingDesignPreviewPage"));
const IndustryCraftingLayout = lazy(() =>
  import("./components/industry/crafting/CraftingLayout").then((m) => ({ default: m.default }))
);
const IndustryMiningPage = lazy(() => import("./pages/industry/MiningPage"));
const IndustryMissionBrowserPage = lazy(() => import("./pages/industry/MissionBrowserPage"));
const WikeloPage = lazy(() => import("./pages/industry/WikeloPage"));
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

function RedirectToActivePage({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

function RedirectToCrafting() {
  const location = useLocation();
  return <Navigate to={`/industry/crafting${location.search}`} replace />;
}

function RedirectCraftingDetailToBrowser() {
  const location = useLocation();
  const { blueprintId } = useParams<{ blueprintId: string }>();
  const search = new URLSearchParams(location.search);
  if (blueprintId) search.set("preview", blueprintId);
  return <Navigate to={`/industry/crafting?${search.toString()}`} replace />;
}

function LegacyFittingRoute() {
  return (
    <ShellRoute title="Fitting" fullBleed>
      <FittingPage />
    </ShellRoute>
  );
}

function ShellRoute({ title, children, fullBleed = false }: { title: string; children: ReactNode; fullBleed?: boolean }) {
  return (
    <AppPageShell title={title} fullBleed={fullBleed}>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </AppPageShell>
  );
}

export default function App() {
  return (
    <AuthSessionProvider>
      <OnlinePersistenceCoordinator />
      <SignatureDockProvider>
        <SignatureDock />
        <Routes>
        <Route path="/" element={<RedirectToDashboard />} />
        <Route path="dashboard" element={<BreakerHomePage />} />
        <Route path="home" element={<RedirectToDashboard />} />
        <Route path="index" element={<RedirectToDashboard />} />
        <Route path="framework" element={<RedirectToDashboard />} />
        <Route path="modules" element={<ModuleIndexPage />} />
        <Route path="doctrine" element={<RedirectToActivePage to="/dashboard" />} />
        <Route path="doctrine/library" element={<RedirectToActivePage to="/dashboard" />} />
        <Route path="dashboard/doctrine" element={<RedirectToActivePage to="/dashboard" />} />
        <Route path="dashboard/doctrine/library" element={<RedirectToActivePage to="/dashboard" />} />
        <Route path="dashboard/doctrine/module/:id" element={<RedirectToActivePage to="/dashboard" />} />
        <Route path="doctrine/armor-threshold" element={<RedirectToActivePage to="/dashboard" />} />
        <Route path="module/:id" element={<RedirectToActivePage to="/dashboard" />} />
        <Route path="refs/:type/:id" element={<RedirectToActivePage to="/dashboard" />} />
        <Route path="framework-legacy" element={<RedirectToActivePage to="/dashboard" />} />
        <Route path="auth/callback" element={<AuthCallbackPage />} />
        <Route
          path="systems/sub-targeting"
          element={<RedirectToActivePage to="/dashboard" />}
        />
        <Route
          path="systems/turret-keybinds"
          element={<RedirectToActivePage to="/dashboard" />}
        />
        <Route
          path="systems/turret-keybinds/additional"
          element={<RedirectToActivePage to="/dashboard" />}
        />
        <Route
          path="anti-cap/component-sniping"
          element={<RedirectToActivePage to="/dashboard" />}
        />

      {/* Operational workspaces retain their existing shell. Home is a standalone gateway. */}
      <Route element={<DashboardShell />}>



        <Route
          path="dashboard/doctrine/armor-threshold"
          element={<RedirectToActivePage to="/dashboard" />}
        />

        {/* Logistics */}
        <Route
          path="logistics"
          element={<ShellRoute title="Logistics Hub"><LogisticsPage /></ShellRoute>}
        />
        <Route
          path="logistics/inventory"
          element={<ShellRoute title="Inventory" fullBleed><InventoryPage /></ShellRoute>}
        />
        {import.meta.env.DEV ? (
          <Route
            path="logistics/inventory/__fixture/layout"
            element={<ShellRoute title="Inventory" fullBleed><InventoryFixturePage /></ShellRoute>}
          />
        ) : null}
        <Route path="logistics/inventory/refinery-import" element={<RedirectToActivePage to="/logistics/inventory" />} />
        <Route
          path="logistics/refinery-import"
          element={<RedirectToActivePage to="/logistics/inventory" />}
        />
        <Route
          path="logistics/carrier-logistics"
          element={<ShellRoute title="Carrier Logistics"><CarrierLogisticsPage /></ShellRoute>}
        />
        <Route
          path="logistics/build-queue"
          element={<ShellRoute title="Build Queue" fullBleed><BuildQueuePage /></ShellRoute>}
        />
        {(import.meta.env.DEV || (import.meta.env.MODE === 'fixtures' && import.meta.env.VITE_LOCAL_COMPILED_FIXTURE)) ? (
          <>
            <Route
              path="logistics/build-queue/__fixture/stats"
              element={<ShellRoute title="Build Queue" fullBleed><BuildQueueFixturePage /></ShellRoute>}
            />
            <Route
              path="logistics/build-queue/__fixture/add-inventory"
              element={<ShellRoute title="Build Queue" fullBleed><InventoryAddModalFixturePage /></ShellRoute>}
            />
          </>
        ) : null}

        {/* Combat tools */}
        <Route
          path="tools/alpha-threshold"
          element={<RedirectToActivePage to="/dashboard" />}
        />
        <Route
          path="combat/component-mapping"
          element={<RedirectToActivePage to="/fitting" />}
        />
        <Route path="fitting-legacy" element={<LegacyFittingRoute />} />
        <Route path="fitting-legacy/:shipKey" element={<LegacyFittingRoute />} />
        <Route
          path="fitting-v2"
          element={<ShellRoute title="Fitting" fullBleed><FittingV2Page /></ShellRoute>}
        />
        <Route
          path="fitting-v2/:shipKey"
          element={<ShellRoute title="Fitting" fullBleed><FittingV2Page /></ShellRoute>}
        />
        {FittingV2PowerFixturePage ? (
          <Route
            path="fitting-v2/__fixture/power"
            element={<ShellRoute title="Fitting" fullBleed><FittingV2PowerFixturePage /></ShellRoute>}
          />
        ) : null}
        {/* Legacy redirect — preserve old gunnery URL */}
        <Route path="tools/gunnery" element={<RedirectToActivePage to="/fitting" />} />
        <Route path="tools/component-mapping" element={<RedirectToActivePage to="/fitting" />} />

        {/* Industry */}
        <Route
          path="industry/crafting"
          element={
            <ShellRoute title="Crafting" fullBleed>
              <IndustryCraftingLayout />
            </ShellRoute>
          }
        >
          {import.meta.env.DEV ? (
            <Route
              path="__fixture/target-slider"
              element={<Suspense fallback={<RouteFallback />}><CraftingTargetSliderFixturePage /></Suspense>}
            />
          ) : null}
          <Route
            path="design-preview"
            element={
              <Suspense fallback={<RouteFallback />}>
                <CraftingDesignPreviewPage />
              </Suspense>
            }
          />
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
            element={<RedirectCraftingDetailToBrowser />}
          />
        </Route>
        <Route
          path="industry/mining"
          element={
            <ShellRoute title="Mining" fullBleed>
              <IndustryMiningPage />
            </ShellRoute>
          }
        />
        <Route
          path="industry/blueprint-tracker"
          element={<RedirectToCrafting />}
        />
        <Route
          path="industry/missions"
          element={
            <ShellRoute title="Missions">
              <IndustryMissionBrowserPage />
            </ShellRoute>
          }
        />
        <Route path="industry/wikelo" element={<ShellRoute title="Wikelo"><WikeloPage /></ShellRoute>} />
        {import.meta.env.DEV && <Route path="industry/wikelo/__fixture" element={<ShellRoute title="Wikelo"><WikeloPage fixture /></ShellRoute>} />}
        <Route
          path="industry/missions/:missionSlug"
          element={
            <ShellRoute title="Missions">
              <IndustryMissionBrowserPage />
            </ShellRoute>
          }
        />
        <Route
          path="industry/refinery"
          element={
            <ShellRoute title="Refinery Planner" fullBleed>
              <IndustryRefineryPlannerPage />
            </ShellRoute>
          }
        />

        {/* Fitting shares the global Breaker shell and navigation. */}
        <Route
          path="fitting"
          element={
            <ShellRoute title="Fitting" fullBleed>
              <FittingMockupPage />
            </ShellRoute>
          }
        />
        {FittingFixturePage ? (
          <Route
            path="fitting/__fixture/:scenario"
            element={
              <ShellRoute title="Fitting" fullBleed>
                <FittingFixturePage />
              </ShellRoute>
            }
          />
        ) : null}
        <Route
          path="fitting/:shipKey"
          element={
            <ShellRoute title="Fitting" fullBleed>
              <FittingMockupPage />
            </ShellRoute>
          }
        />
        <Route
          path="fitting-mockup"
          element={
            <ShellRoute title="Fitting" fullBleed>
              <FittingMockupPage />
            </ShellRoute>
          }
        />

      </Route>

        <Route path="*" element={<RedirectToDashboard />} />

        </Routes>
      </SignatureDockProvider>
    </AuthSessionProvider>
  );
}
