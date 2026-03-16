import './threshold.css'
import { ControlsPanel } from './components/ControlsPanel'
import PageLayout from '../../components/PageLayout'
import SidebarWorkspace from '../../components/SidebarWorkspace'
import { AlphaThresholdPage } from './components/AlphaThresholdPage'
import { ShipBalanceChangelogPanel } from './components/ShipBalanceChangelogPanel'
import { ShipSelectionSidebar } from './components/ShipSelectionSidebar'
import { DataSourceSelector } from './components/DataSourceSelector'
import { thresholdDataSourceOptions } from './data/sourceOptions'
import { useAlphaThresholdState } from './hooks/useAlphaThresholdState'

export default function AlphaThresholdToolPage() {
  const {
    activeSource,
    setActiveSource,
    slots,
    setSlotWeapon,
    allWeapons,
    allShips,
    selectedWeapons,
    axisScaleMode,
    setAxisScaleMode,
    globalAxisMaxByType,
    mobileSidebarOpen,
    selectedShipResults,
    shipBalanceChanges,
    victimSlotShipNames,
    setVictimShipAt,
    clearAllShips,
    shipOverrides,
  } = useAlphaThresholdState()
  const hasSelectedWeapons = selectedWeapons.length > 0

  function clearAllWeaponSlots() {
    slots.forEach((slot) => setSlotWeapon(slot.id, null))
  }

  return (
    <main className="alpha-tool-route" aria-label="Alpha threshold tool">
      <SidebarWorkspace
        className="alpha-sidebar-workspace"
        leftSidebar={
          <ShipSelectionSidebar
            mobileOpen={mobileSidebarOpen}
          >
            <section
              className="alpha-summary-rail"
              aria-labelledby="alpha-active-weapons-title"
            >
              <DataSourceSelector
                activeSource={activeSource}
                sourceOptions={thresholdDataSourceOptions}
                onSourceChange={setActiveSource}
              />

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
                  <p className="alpha-summary-rail-clear">
                    <button
                      type="button"
                      onClick={clearAllWeaponSlots}
                      className="alpha-action-button"
                    >
                      Clear All
                    </button>
                  </p>
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
        rightSidebar={
          <section className="alpha-changelog-rail" aria-label="Stat changelog">
            <ShipBalanceChangelogPanel entries={shipBalanceChanges} />
          </section>
        }
      >
        <section aria-label="Threshold analysis workspace">
          <PageLayout
            title="Alpha vs Threshold"
            summary="Compare weapon alpha against ship ballistic or energy thresholds to see which ships can take hull damage."
            panelClassName="alpha-page-layout-panel"
            contentClassName="max-w-none"
          >
            <AlphaThresholdPage
              selectedShipResults={selectedShipResults}
              selectedWeapons={selectedWeapons}
              allShips={allShips}
              victimSlotShipNames={victimSlotShipNames}
              axisScaleMode={axisScaleMode}
              globalAxisMaxByType={globalAxisMaxByType}
              onAxisScaleModeChange={setAxisScaleMode}
              onVictimShipChange={setVictimShipAt}
              onClearAllShips={clearAllShips}
              shipOverrides={shipOverrides}
            />
          </PageLayout>
        </section>
      </SidebarWorkspace>
    </main>
  )
}
