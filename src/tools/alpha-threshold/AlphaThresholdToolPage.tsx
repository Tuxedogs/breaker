import { ControlsPanel } from './components/ControlsPanel'
import PageLayout from '../../components/PageLayout'
import SidebarWorkspace from '../../components/SidebarWorkspace'
import { AlphaThresholdPage } from './components/AlphaThresholdPage'
import { ShipSelectionSidebar } from './components/ShipSelectionSidebar'
import { useAlphaThresholdState } from './hooks/useAlphaThresholdState'

export default function AlphaThresholdToolPage() {
  const {
    slots,
    setSlotWeapon,
    allWeapons,
    selectedWeapons,
    axisMaxByType,
    sidebarGroups,
    selectedShipNames,
    toggleShipSelected,
    clearAllShips,
    selectVisibleShips,
    shipSearch,
    setShipSearch,
    showSelectedOnly,
    toggleShowSelectedOnly,
    mobileSidebarOpen,
    toggleGroupCollapsed,
    selectedShipResults,
    shipOverrides,
    setShipOverride,
    resetShipOverride,
  } = useAlphaThresholdState()
  const hasSelectedWeapons = selectedWeapons.length > 0

  return (
    <section className="alpha-tool-route">
      <SidebarWorkspace
        className="alpha-sidebar-workspace"
        leftSidebar={
          <ShipSelectionSidebar
            groups={sidebarGroups}
            selectedShipNames={selectedShipNames}
            searchValue={shipSearch}
            showSelectedOnly={showSelectedOnly}
            mobileOpen={mobileSidebarOpen}
            onSearchChange={setShipSearch}
            onToggleShowSelectedOnly={toggleShowSelectedOnly}
            onToggleShipSelected={toggleShipSelected}
            onToggleGroup={toggleGroupCollapsed}
            onSelectVisible={selectVisibleShips}
            onClearAll={clearAllShips}
          />
        }
        rightSidebar={
          <section className="alpha-summary-rail">
            <div className="alpha-summary-rail-head">
              <p className="page-kicker">Weapon Summary</p>
              <h2 className="surface-title mt-3">Active Weapons</h2>
              <p className="mt-2 text-sm text-slate-400">
                Selected weapons stay visible here while the threshold matrix
                remains the dominant workspace.
              </p>
            </div>

            {!hasSelectedWeapons ? (
              <div className="alpha-summary-empty">
                <p className="title-font text-sm text-slate-100">
                  No weapons selected
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Add a weapon in the comparison controls to populate this
                  rail.
                </p>
              </div>
            ) : null}

            <ControlsPanel
              slots={slots}
              weapons={allWeapons}
              onSlotChange={setSlotWeapon}
            />
          </section>
        }
      >
        <PageLayout
          title="Alpha vs Threshold"
          summary="Compare weapon alpha against ship ballistic or energy thresholds to see which ships can take hull damage."
          contentClassName="max-w-none"
        >
          <AlphaThresholdPage
            selectedShipResults={selectedShipResults}
            axisMaxByType={axisMaxByType}
            shipOverrides={shipOverrides}
            onSaveShipOverride={setShipOverride}
            onResetShipOverride={resetShipOverride}
          />
        </PageLayout>
      </SidebarWorkspace>
    </section>
  )
}
