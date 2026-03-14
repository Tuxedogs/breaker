import './threshold.css'
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
    attackerShip,
    attackerOptions,
    setAttackerShipName,
    attackerHardpointGroups,
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
    shipBalanceChanges,
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
            attackerShip={attackerShip}
            attackerOptions={attackerOptions}
            attackerHardpointGroups={attackerHardpointGroups}
            selectedShipNames={selectedShipNames}
            searchValue={shipSearch}
            showSelectedOnly={showSelectedOnly}
            mobileOpen={mobileSidebarOpen}
            onSearchChange={setShipSearch}
            onToggleShowSelectedOnly={toggleShowSelectedOnly}
            onToggleShipSelected={toggleShipSelected}
            onToggleGroup={toggleGroupCollapsed}
            onAttackerShipChange={setAttackerShipName}
            onSelectVisible={selectVisibleShips}
            onClearAll={clearAllShips}
          >
            <section
              className="alpha-summary-rail"
              aria-labelledby="alpha-active-weapons-title"
            >
              <header className="alpha-summary-rail-head">
                <p className="page-kicker">Weapon Summary</p>
                <h2
                  id="alpha-active-weapons-title"
                  className="surface-title mt-3"
                >
                  Active Weapons
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Configure the current loadout here while the matrix stays
                  focused on the selected ships.
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
              </header>

              {!hasSelectedWeapons ? (
                <section className="alpha-summary-empty" aria-live="polite">
                  <p className="title-font text-sm text-slate-100">
                    No weapons selected
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    Add a weapon in the comparison controls to populate this
                    section.
                  </p>
                </section>
              ) : null}

              <section aria-label="Weapon loadout">
                <ControlsPanel
                  slots={slots}
                  weapons={allWeapons}
                  onSlotChange={setSlotWeapon}
                />
              </section>
            </section>
          </ShipSelectionSidebar>
        }
      >
        <section aria-label="Threshold analysis workspace">
          <PageLayout
            title="Alpha vs Threshold"
            summary="Compare weapon alpha against ship ballistic or energy thresholds to see which ships can take hull damage."
            panelClassName="border-0 bg-transparent p-0 shadow-none sm:p-0 lg:p-0"
            contentClassName="max-w-none"
          >
            <AlphaThresholdPage
              selectedShipResults={selectedShipResults}
              shipBalanceChanges={shipBalanceChanges}
              axisScaleMode={axisScaleMode}
              globalAxisMaxByType={globalAxisMaxByType}
              onAxisScaleModeChange={setAxisScaleMode}
              shipOverrides={shipOverrides}
            />
          </PageLayout>
        </section>
      </SidebarWorkspace>
    </section>
  )
}
