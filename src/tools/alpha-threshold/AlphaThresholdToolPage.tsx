import { ControlsPanel } from './components/ControlsPanel'
import PageLayout from '../../components/PageLayout'
import SidebarWorkspace from '../../components/SidebarWorkspace'
import { AlphaThresholdPage } from './components/AlphaThresholdPage'
import { ShipSelectionSidebar } from './components/ShipSelectionSidebar'
import { WeaponCard } from './components/WeaponCard'
import { useAlphaThresholdState } from './hooks/useAlphaThresholdState'
import { getWeaponKey } from './lib/calculations'

export default function AlphaThresholdToolPage() {
  const {
    sortKey,
    setSortKey,
    visibleSlots,
    activeSlotCount,
    setSlotCount,
    setSlotWeapon,
    allWeapons,
    selectedWeapons,
    axisMaxByType,
    sidebarGroups,
    selectedShipNames,
    selectedShipCount,
    toggleShipSelected,
    clearAllShips,
    selectVisibleShips,
    shipSearch,
    setShipSearch,
    showSelectedOnly,
    toggleShowSelectedOnly,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    toggleGroupCollapsed,
    selectedShipResults,
    shipOverrides,
    weaponOverrides,
    setShipOverride,
    resetShipOverride,
    setWeaponOverride,
    resetWeaponOverride,
    resetAllOverrides,
  } = useAlphaThresholdState()

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
              <h2 className="surface-title mt-3">Comparison Loadout</h2>
              <p className="mt-2 text-sm text-slate-400">
                Selected weapons stay visible here while the threshold matrix remains the dominant workspace.
              </p>
            </div>

            {selectedWeapons.length > 0 ? (
              <div className="alpha-summary-rail-cards">
                {selectedWeapons.map((selectedWeapon) => {
                  const weaponKey = getWeaponKey(selectedWeapon.weapon)

                  return (
                    <WeaponCard
                      key={selectedWeapon.slotId}
                      label={selectedWeapon.slotLabel}
                      tone={selectedWeapon.tone}
                      weapon={selectedWeapon.weapon}
                      override={weaponOverrides[weaponKey]}
                      onSaveOverride={(patch) =>
                        setWeaponOverride(weaponKey, patch)
                      }
                      onResetOverride={() => resetWeaponOverride(weaponKey)}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="alpha-summary-empty">
                <p className="title-font text-sm text-slate-100">
                  No weapons selected
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Add a weapon in the comparison controls to populate this rail.
                </p>
              </div>
            )}
          </section>
        }
      >
        <PageLayout
          title="Alpha vs Threshold"
          summary="Compare weapon alpha against ship ballistic or energy thresholds to see which ships can take hull damage."
          contentClassName="max-w-none"
        >
          <div className="alpha-tool-layout">
            <ControlsPanel
              sortKey={sortKey}
              slots={visibleSlots}
              activeSlotCount={activeSlotCount}
              weapons={allWeapons}
              selectedShipCount={selectedShipCount}
              mobileSidebarOpen={mobileSidebarOpen}
              onSortChange={setSortKey}
              onSlotCountChange={setSlotCount}
              onSlotChange={setSlotWeapon}
              onResetAllOverrides={resetAllOverrides}
              onToggleMobileSidebar={() =>
                setMobileSidebarOpen((prev) => !prev)
              }
            />

            <AlphaThresholdPage
              selectedShipResults={selectedShipResults}
              axisMaxByType={axisMaxByType}
              shipOverrides={shipOverrides}
              onSaveShipOverride={setShipOverride}
              onResetShipOverride={resetShipOverride}
            />
          </div>
        </PageLayout>
      </SidebarWorkspace>
    </section>
  )
}
