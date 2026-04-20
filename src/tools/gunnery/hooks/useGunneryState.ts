import { useMemo, useState } from 'react'
import type {
  ComponentZone,
  DiagnosisEntry,
  GunnerySection,
  SubTargetShip,
  ViewId,
  VisualToggles,
} from '../types'
import { DIAGNOSIS } from '../data/diagnosis'
import { SHIPS } from '../data/ships'

export type GunneryState = ReturnType<typeof useGunneryState>

export function useGunneryState() {
  const [activeSection, setActiveSection] = useState<GunnerySection>('sub-targeting')

  const [selectedShipId, setSelectedShipId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<ViewId>('top')
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null)

  const selectedShip = useMemo<SubTargetShip | null>(
    () => SHIPS.find((ship) => ship.id === selectedShipId) ?? null,
    [selectedShipId]
  )

  const activeZone = useMemo<ComponentZone | null>(
    () => selectedShip?.zones.find((zone) => zone.id === activeZoneId) ?? null,
    [selectedShip, activeZoneId]
  )

  const selectShip = (id: string | null) => {
    setSelectedShipId(id)
    setActiveZoneId(null)
    const ship = id ? SHIPS.find((entry) => entry.id === id) : null
    setActiveView(ship?.viewTabs[0]?.id ?? 'top')
  }

  const [activeSymptomId, setActiveSymptomId] = useState<string | null>(null)

  const diagnosisResult = useMemo<DiagnosisEntry | null>(
    () => DIAGNOSIS.find((entry) => entry.id === activeSymptomId) ?? null,
    [activeSymptomId]
  )

  const [visualToggles, setVisualToggles] = useState<VisualToggles>({
    showGimbalCone: false,
    showCrosshairDrift: false,
    showTargetMovement: false,
  })

  const toggleVisual = (key: keyof VisualToggles) =>
    setVisualToggles((previous) => ({ ...previous, [key]: !previous[key] }))

  return {
    activeSection,
    setActiveSection,
    selectedShipId,
    selectedShip,
    activeView,
    setActiveView,
    activeZoneId,
    setActiveZoneId,
    activeZone,
    selectShip,
    ships: SHIPS,
    activeSymptomId,
    setActiveSymptomId,
    diagnosisResult,
    diagnosis: DIAGNOSIS,
    visualToggles,
    toggleVisual,
  }
}
