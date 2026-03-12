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
    axisScaleMode,
    setAxisScaleMode,
    globalAxisMaxByType,
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
  } = useAlphaThresholdState()
  const hasSelectedWeapons = selectedWeapons.length > 0

  function clearAllWeaponSlots() {
    slots.forEach((slot) => setSlotWeapon(slot.id, null))
  }

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
              {hasSelectedWeapons ? (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={clearAllWeaponSlots}
                    className="alpha-action-button"
                  >
                    Clear All
                  </button>
                </div>
              ) : null}
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
          panelClassName="border-0 bg-transparent p-0 shadow-none sm:p-0 lg:p-0"
          contentClassName="max-w-none"
        >
          <AlphaThresholdPage
            selectedShipResults={selectedShipResults}
            axisScaleMode={axisScaleMode}
            globalAxisMaxByType={globalAxisMaxByType}
            onAxisScaleModeChange={setAxisScaleMode}
            shipOverrides={shipOverrides}
          />
        </PageLayout>
      </SidebarWorkspace>
    </section>
  )
}
