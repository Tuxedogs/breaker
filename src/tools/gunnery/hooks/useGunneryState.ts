import { useMemo, useState } from 'react'
import type {
  ComponentZone,
  DiagnosisEntry,
  GunnerySection,
  ModeRecommendation,
  Range,
  SubTargetShip,
  TargetSpeed,
  TargetType,
  VisualToggles,
  WeaponType,
} from '../types'
import { DIAGNOSIS } from '../data/diagnosis'
import { SHIPS } from '../data/ships'
import { recommendMode } from '../lib/recommend'

export type GunneryState = ReturnType<typeof useGunneryState>

export function useGunneryState() {
  const [activeSection, setActiveSection] = useState<GunnerySection>('mode-recommender')

  const [weaponType, setWeaponType] = useState<WeaponType | null>(null)
  const [targetType, setTargetType] = useState<TargetType | null>(null)
  const [range, setRange] = useState<Range | null>(null)
  const [speed, setSpeed] = useState<TargetSpeed | null>(null)

  const resolvedTargetType =
    targetType === null
      ? null
      : weaponType === 'medusa'
        ? (targetType === 'fighter' || targetType === 'large' || targetType === 'capital' ? targetType : null)
        : (targetType === 'fighter' || targetType === 'heavy-fighter' || targetType === 'large' ? targetType : null)

  const recommendation = useMemo<ModeRecommendation | null>(() => {
    if (!weaponType || !resolvedTargetType || !range || !speed) return null
    return recommendMode(weaponType, resolvedTargetType, range, speed)
  }, [weaponType, resolvedTargetType, range, speed])

  const clearRecommender = () => {
    setWeaponType(null)
    setTargetType(null)
    setRange(null)
    setSpeed(null)
  }

  const [selectedShipId, setSelectedShipId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<string>('top')
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
    setActiveView(ship?.viewDefs[0]?.id ?? 'top')
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
    weaponType,
    setWeaponType,
    targetType,
    setTargetType,
    range,
    setRange,
    speed,
    setSpeed,
    recommendation,
    clearRecommender,
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
