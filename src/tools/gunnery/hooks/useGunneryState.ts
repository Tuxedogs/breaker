import { useState, useMemo } from 'react'
import type {
  GunnerySection,
  OperatorType,
  TargetType,
  Range,
  TargetSpeed,
  ModeRecommendation,
  VisualToggles,
  SubTargetShip,
  ComponentZone,
  Scenario,
  DiagnosisEntry,
} from '../types'
import { recommendMode } from '../lib/recommend'
import { SCENARIOS } from '../data/scenarios'
import { SHIPS } from '../data/ships'
import { DIAGNOSIS } from '../data/diagnosis'

export type GunneryState = ReturnType<typeof useGunneryState>

export function useGunneryState() {
  // ── Section nav ──────────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<GunnerySection>('mode-recommender')

  // ── Mode Recommender ─────────────────────────────────────────────────────
  const [operatorType, setOperatorType] = useState<OperatorType | null>(null)
  const [targetType, setTargetType] = useState<TargetType | null>(null)
  const [range, setRange] = useState<Range | null>(null)
  const [speed, setSpeed] = useState<TargetSpeed | null>(null)

  const recommendation = useMemo<ModeRecommendation | null>(() => {
    if (!operatorType || !targetType || !range || !speed) return null
    return recommendMode(operatorType, targetType, range, speed)
  }, [operatorType, targetType, range, speed])

  const clearRecommender = () => {
    setOperatorType(null)
    setTargetType(null)
    setRange(null)
    setSpeed(null)
  }

  // ── Scenarios ────────────────────────────────────────────────────────────
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)

  const activeScenario = useMemo<Scenario | null>(
    () => SCENARIOS.find(s => s.id === activeScenarioId) ?? null,
    [activeScenarioId]
  )

  // Selecting a scenario pre-fills the recommender inputs so the two panels
  // stay in sync. The user can then modify inputs to explore variants.
  const selectScenario = (id: string | null) => {
    setActiveScenarioId(id)
    const scenario = SCENARIOS.find(s => s.id === id)
    if (scenario) {
      setTargetType(scenario.targetType)
      setRange(scenario.range)
      setSpeed(scenario.speed)
    }
  }

  // ── Sub-targeting ────────────────────────────────────────────────────────
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<string>('top')
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null)

  const selectedShip = useMemo<SubTargetShip | null>(
    () => SHIPS.find(s => s.id === selectedShipId) ?? null,
    [selectedShipId]
  )

  const activeZone = useMemo<ComponentZone | null>(
    () => selectedShip?.zones.find(z => z.id === activeZoneId) ?? null,
    [selectedShip, activeZoneId]
  )

  const selectShip = (id: string | null) => {
    setSelectedShipId(id)
    setActiveZoneId(null)
    const ship = id ? SHIPS.find(s => s.id === id) : null
    setActiveView(ship?.viewDefs[0]?.id ?? 'top')
  }

  // ── Diagnosis ────────────────────────────────────────────────────────────
  const [activeSymptomId, setActiveSymptomId] = useState<string | null>(null)

  const diagnosisResult = useMemo<DiagnosisEntry | null>(
    () => DIAGNOSIS.find(d => d.id === activeSymptomId) ?? null,
    [activeSymptomId]
  )

  // ── Visual toggles ───────────────────────────────────────────────────────
  const [visualToggles, setVisualToggles] = useState<VisualToggles>({
    showGimbalCone: false,
    showCrosshairDrift: false,
    showTargetMovement: false,
  })

  const toggleVisual = (key: keyof VisualToggles) =>
    setVisualToggles(prev => ({ ...prev, [key]: !prev[key] }))

  return {
    // Section
    activeSection,
    setActiveSection,

    // Mode recommender
    operatorType,
    setOperatorType,
    targetType,
    setTargetType,
    range,
    setRange,
    speed,
    setSpeed,
    recommendation,
    clearRecommender,

    // Scenarios
    activeScenarioId,
    activeScenario,
    selectScenario,
    scenarios: SCENARIOS,

    // Sub-targeting
    selectedShipId,
    selectedShip,
    activeView,
    setActiveView,
    activeZoneId,
    setActiveZoneId,
    activeZone,
    selectShip,
    ships: SHIPS,

    // Diagnosis
    activeSymptomId,
    setActiveSymptomId,
    diagnosisResult,
    diagnosis: DIAGNOSIS,

    // Visual toggles
    visualToggles,
    toggleVisual,
  }
}
