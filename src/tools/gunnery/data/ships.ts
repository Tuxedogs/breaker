import type { SubTargetShip } from '../types'

// Zone positions are % of silhouette container (top-left origin).
// A zone only renders in views where it has a position entry.
// Perseus top-view coordinates are measured from provided reference images.
// All other coordinates are placeholder — calibrate with the debug tool.

export const SHIPS: SubTargetShip[] = [
  {
    id: 'perseus',
    label: 'RSI Perseus',
    class: 'capital',
    viewDefs: [
      { id: 'top',   label: 'Top'   },
      { id: 'side',  label: 'Side'  },
      { id: 'lower', label: 'Lower' },
      { id: 'rear',  label: 'Rear'  },
    ],
    views: {
      top:   '/ships/gunnery/perseus-top.jpg',
      side:  '/ships/gunnery/perseus-side.jpg',
      lower: '/ships/gunnery/perseus-lower.jpg',
      rear:  '/ships/gunnery/perseus-rear.jpg',
    },
    zones: [
      {
        id: 'per-powerplant-1',
        label: 'Power Plant 1',
        shortLabel: 'P1',
        groupId: 'per-power',
        priority: 2,
        color: 'var(--component-power)',
        effect: 'Cuts available power — forces the crew to take shields or weapons offline.',
        positions: {
          top:  { x: 58, y: 56, w: 8, h: 8, wPx: 90,  hPx: 130 },
          side: { x: 48, y: 30, w: 14, h: 36 },
        },
      },
      {
        id: 'per-powerplant-2',
        label: 'Power Plant 2',
        shortLabel: 'P2',
        groupId: 'per-power',
        priority: 2,
        color: 'var(--component-power)',
        effect: 'Cuts available power — forces the crew to take shields or weapons offline.',
        positions: {
          top:  { x: 25, y: 53, w: 8, h: 8, wPx: 130, hPx: 90 },
        },
      },
      {
        id: 'per-shield-1',
        label: 'Shield Generator 1',
        shortLabel: 'S1',
        groupId: 'per-shield',
        priority: 4,
        color: 'var(--component-shield)',
        effect: 'Degrades shield regen rate — makes follow-up fire more effective.',
        positions: {
          top:  { x: 69, y: 53, w: 8, h: 8, wPx: 110, hPx: 50 },
          side: { x: 34, y: 20, w: 12, h: 22 },
        },
      },
      {
        id: 'per-shield-2',
        label: 'Shield Generator 2',
        shortLabel: 'S2',
        groupId: 'per-shield',
        priority: 4,
        color: 'var(--component-shield)',
        effect: 'Degrades shield regen rate — makes follow-up fire more effective.',
        positions: {
          top:  { x: 29, y: 53, w: 8, h: 8, wPx: 110, hPx: 50 },
        },
      },
      {
        id: 'per-qt',
        label: 'QT Drive',
        shortLabel: 'QT',
        priority: 3,
        color: 'var(--component-qt)',
        effect: 'Traps the ship in system — denies quantum escape.',
        positions: {
          top:   { x: 18, y: 47, w: 8, h: 8, wPx: 90, hPx: 120 },
          side:  { x: 70, y: 32, w: 14, h: 30 },
          lower: { x: 43, y: 70, w: 14, h: 16 },
          rear:  { x: 38, y: 58, w: 24, h: 22 },
        },
      },
    ],
  },

  {
    id: 'idris',
    label: 'Aegis Idris',
    class: 'capital',
    viewDefs: [
      { id: 'top',              label: 'Top'               },
      { id: 'side',             label: 'Side'              },
      { id: 'lower',            label: 'Lower'             },
      { id: 'rear',             label: 'Rear'              },
      { id: 'radar',            label: 'Radar'             },
      { id: 'powerplant-top',   label: 'Power Plant (Top)' },
    ],
    views: {
      top:              '/ships/gunnery/idris-top.jpg',
      side:             '/ships/gunnery/idris-side.jpg',
      lower:            '/ships/gunnery/idris-lower.jpg',
      rear:             '/ships/gunnery/idris-rear.jpg',
      radar:            '/ships/gunnery/idris-radar.jpg',
      'powerplant-top': '/ships/gunnery/idris-powerplant-top.jpg',
    },
    zones: [
      {
        id: 'idr-spinal',
        label: 'Spinal Cannon',
        priority: 1,
        color: 'var(--component-gun)',
        effect: 'Disables the main spinal mount — removes the highest-damage single weapon on the ship.',
        positions: {
          top:  { x: 42, y: 2,  w: 16, h: 22 },
          side: { x: 4,  y: 38, w: 22, h: 22 },
        },
      },
      {
        id: 'idr-turrets-dorsal',
        label: 'Dorsal Turret Battery',
        priority: 1,
        color: 'var(--component-gun)',
        effect: 'Suppresses the top turret battery — reduces broadside coverage significantly.',
        positions: {
          top:  { x: 24, y: 22, w: 52, h: 20 },
          side: { x: 24, y: 6,  w: 50, h: 22 },
        },
      },
      {
        id: 'idr-turrets-ventral',
        label: 'Ventral Turret Battery',
        priority: 1,
        color: 'var(--component-gun)',
        effect: 'Removes belly turret coverage — enables an attack run from below.',
        positions: {
          lower: { x: 24, y: 22, w: 52, h: 22 },
          side:  { x: 24, y: 70, w: 50, h: 20 },
        },
      },
      {
        id: 'idr-powerplant',
        label: 'Power Plant',
        priority: 2,
        color: 'var(--component-power)',
        effect: 'Largest power budget of any commonly fielded capital — degrading it forces hard trade-offs across shields, weapons, and flight systems.',
        positions: {
          top:              { x: 38, y: 44, w: 24, h: 22 },
          side:             { x: 46, y: 26, w: 16, h: 44 },
          lower:            { x: 38, y: 44, w: 24, h: 22 },
          rear:             { x: 30, y: 18, w: 40, h: 38 },
          'powerplant-top': { x: 20, y: 18, w: 60, h: 64 },
        },
      },
      {
        id: 'idr-radar',
        label: 'Radar Array',
        priority: 3,
        color: 'var(--component-radar)',
        effect: "Degrades target acquisition and detection range — reduces the Idris crew's situational awareness.",
        positions: {
          top:   { x: 44, y: 30, w: 12, h: 10 },
          radar: { x: 15, y: 15, w: 70, h: 70 },
        },
      },
      {
        id: 'idr-qt',
        label: 'QT Drive',
        priority: 3,
        color: 'var(--component-qt)',
        effect: 'Prevents quantum jump — the Idris cannot disengage. Critical for holding a capital in a kill box.',
        positions: {
          top:   { x: 40, y: 70, w: 20, h: 16 },
          side:  { x: 68, y: 30, w: 14, h: 36 },
          lower: { x: 40, y: 70, w: 20, h: 16 },
          rear:  { x: 34, y: 58, w: 32, h: 24 },
        },
      },
      {
        id: 'idr-shields',
        label: 'Shield Generators',
        priority: 4,
        color: 'var(--component-shield)',
        effect: 'Reduces regen across a very large shield pool — meaningful under sustained multi-crew fire.',
        positions: {
          side: { x: 34, y: 16, w: 12, h: 26 },
        },
      },
    ],
  },
]

export const PRIORITY_LABELS: Record<number, string> = {
  1: 'Primary — Weapons',
  2: 'Secondary — Power Plant',
  3: 'Tertiary — QT Drive',
  4: 'Quaternary — Shields',
}
