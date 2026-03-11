import { ControlsPanel } from './components/ControlsPanel'
import PageLayout from '../../components/PageLayout'
import { AlphaThresholdPage } from './components/AlphaThresholdPage'
import { ShipSelectionSidebar } from './components/ShipSelectionSidebar'
import { useAlphaThresholdState } from './hooks/useAlphaThresholdState'

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
    visibleShipCount,
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
      <div className="alpha-tool-workspace">
        <ShipSelectionSidebar
          groups={sidebarGroups}
          selectedShipNames={selectedShipNames}
          searchValue={shipSearch}
          showSelectedOnly={showSelectedOnly}
          selectedShipCount={selectedShipCount}
          visibleShipCount={visibleShipCount}
          mobileOpen={mobileSidebarOpen}
          onSearchChange={setShipSearch}
          onToggleShowSelectedOnly={toggleShowSelectedOnly}
          onToggleShipSelected={toggleShipSelected}
          onToggleGroup={toggleGroupCollapsed}
          onSelectVisible={selectVisibleShips}
          onClearAll={clearAllShips}
        />

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
              selectedWeapons={selectedWeapons}
              selectedShipResults={selectedShipResults}
              axisMaxByType={axisMaxByType}
              shipOverrides={shipOverrides}
              weaponOverrides={weaponOverrides}
              onSaveShipOverride={setShipOverride}
              onResetShipOverride={resetShipOverride}
              onSaveWeaponOverride={setWeaponOverride}
              onResetWeaponOverride={resetWeaponOverride}
            />
          </div>
        </PageLayout>
      </div>
    </section>
  )
}
