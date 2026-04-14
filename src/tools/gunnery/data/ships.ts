import type { SubTargetShip } from '../types'

// ─── Coordinate convention ────────────────────────────────────────────────────
// All x / y values are PERCENT of the silhouette container measured to the
// CENTER of the zone box.  The .gun-zone CSS rule applies
// transform: translate(-50%, -50%) so left/top map directly to the center.
//
// wPx / hPx: fixed pixel dimensions (used instead of w% / h% when set).
// w / h:     percentage fallback — still required by type but ignored when
//            wPx / hPx are present.
//
// ─── Normalizer note ─────────────────────────────────────────────────────────
// The `color` field currently stores raw CSS var strings. When adding many more
// ships, add a COLOR_TOKENS map here (e.g. 'power' → 'var(--component-power)')
// and convert the field to a ColorToken union type. Phase 2: migrate each ship
// to its own JSON file and run the normalizer at import time.
// ─────────────────────────────────────────────────────────────────────────────

export const SHIPS: SubTargetShip[] = [
  // ── RSI Perseus ────────────────────────────────────────────────────────────
  {
    id: 'perseus',
    label: 'RSI Perseus',
    class: 'capital',
    viewDefs: [
      { id: 'top',  label: 'Top'  },
      { id: 'side', label: 'Side' },
    ],
    views: {
      top:  '/ships/gunnery/perseus-top.jpg',
      side: '/ships/gunnery/perseus-side.jpg',
    },
    zones: [
      // ── Power Plants ───────────────────────────────────────────────────────
      {
        id: 'per-powerplant-1',
        label: 'Forward Power Plant',
        shortLabel: 'P1',
        groupId: 'per-power',
        priority: 2,
        color: 'var(--component-power)',
        effect: 'Housing is easily identified due to nearby escape pod hatch. Starboard side, in line with bridge lower nose.',
        positions: {
          top:  { x: 62.2, y: 60.5, w: 0, h: 0, wPx: 29, hPx: 52 },
          side: { x: 62.3, y: 44.5, w: 0, h: 0, wPx: 38, hPx: 34 },
        },
      },
      {
        id: 'per-powerplant-2',
        label: 'Rear Power Plant',
        shortLabel: 'P2',
        groupId: 'per-power',
        priority: 2,
        color: 'var(--component-power)',
        effect: 'Housed towards the rear of the starboard external walkway, on the main deck.',
        positions: {
          top:  { x: 31.9, y: 62.2, w: 0, h: 0, wPx: 52, hPx: 29 },
          side: { x: 28.5, y: 44.1, w: 0, h: 0, wPx: 69, hPx: 32 },
        },
      },

      // ── Shield Generators ──────────────────────────────────────────────────
      {
        id: 'per-shield-1',
        label: 'Forward Shield Generator',
        shortLabel: 'S1',
        groupId: 'per-shield',
        priority: 4,
        color: 'var(--component-shield)',
        effect: 'Housing is slightly behind gun 1 on the starboard side.',
        positions: {
          top:  { x: 72.8, y: 57.3, w: 0, h: 0, wPx: 47, hPx: 19 },
          side: { x: 73.6, y: 43.2, w: 0, h: 0, wPx: 63, hPx: 20 },
        },
      },
      {
        id: 'per-shield-2',
        label: 'Rear Shield Generator',
        shortLabel: 'S2',
        groupId: 'per-shield',
        priority: 4,
        color: 'var(--component-shield)',
        effect: 'Housed directly adjacent of the rear power plant, radar included.',
        positions: {
          top:  { x: 28.2, y: 62.1, w: 0, h: 0, wPx: 47, hPx: 19 },
          side: { x: 25.5, y: 44.0, w: 0, h: 0, wPx: 63, hPx: 20 },
        },
      },

      // ── QT Drive ───────────────────────────────────────────────────────────
      {
        id: 'per-qt',
        label: 'Quantum Drive',
        shortLabel: 'QT',
        priority: 3,
        color: 'var(--component-qt)',
        effect: 'Housed below central vents present on the top of the main deck rear, forward of the upper and lower PDC.',
        positions: {
          top:  { x: 22.8, y: 51.1, w: 0, h: 0, wPx: 31, hPx: 49 },
          side: { x: 22.1, y: 39.5, w: 0, h: 0, wPx: 44, hPx: 13 },
        },
      },

      // ── Main Battery ───────────────────────────────────────────────────────
      // Note: side x/y not yet calibrated — top view only.
      {
        id: 'per-gun-1',
        label: 'Top Main Battery',
        shortLabel: 'Gun 1',
        priority: 1,
        color: 'var(--component-gun)',
        effect: 'Focused suppression against Perseus main batteries is critical during any engagement.',
        positions: {
          top:  { x: 77.4, y: 52.7, w: 0, h: 0, wPx: 156, hPx: 176 },
        },
      },

      // ── Navigation ─────────────────────────────────────────────────────────
      {
        id: 'per-br-airlock',
        label: 'Bridge Airlock',
        shortLabel: 'Br. Airlock',
        priority: 5,
        color: 'var(--component-navigation)',
        effect: '3 stage airlock with direct access to bridge deck.',
        positions: {
          top:  { x: 44.5, y: 43.5, w: 0, h: 0, wPx: 74, hPx: 42 },
        },
      },
      {
        id: 'per-stbd-airlock',
        label: 'Starboard Airlock',
        shortLabel: 'Stbd. Airlock',
        priority: 5,
        color: 'var(--component-navigation)',
        effect: 'Entry to Perseus the cargo bay.',
        positions: {
          side: { x: 55.3, y: 64.5, w: 0, h: 0, wPx: 119, hPx: 71 },
        },
      },
    ],
  },

  // ── Aegis Idris ────────────────────────────────────────────────────────────
  {
    id: 'idris',
    label: 'Aegis Idris',
    class: 'capital',
    viewDefs: [
      { id: 'top',  label: 'Top'  },
      { id: 'side', label: 'Side' },
    ],
    views: {
      top:  '/ships/gunnery/idris-top.jpg',
      side: '/ships/gunnery/idris-side.jpg',
    },
    zones: [
      // ── Power Plants ───────────────────────────────────────────────────────
      {
        id: 'idr-powerplant-fwd',
        label: 'Forward Power Plant',
        shortLabel: 'F. P1',
        groupId: 'idr-power',
        priority: 2,
        color: 'var(--component-power)',
        effect: 'AM Enabled on turrets when attacking capital weapons and internals.',
        positions: {
          top: { x: 77, y: 48.3, w: 0, h: 0, wPx: 40, hPx: 40 },
        },
      },
      {
        id: 'idr-powerplant-rear',
        label: 'Rear Power Plant',
        shortLabel: 'R. P2',
        groupId: 'idr-power',
        priority: 2,
        color: 'var(--component-power)',
        effect: 'AM Enabled on turrets when attacking capital weapons and internals.',
        positions: {
          top: { x: 80.3, y: 48.3, w: 0, h: 0, wPx: 40, hPx: 40 },
        },
      },

      // ── Shield Generators ──────────────────────────────────────────────────
      {
        id: 'idr-shield-stbd',
        label: 'Starboard Shield Generator',
        shortLabel: 'Shield 1',
        groupId: 'idr-shield',
        priority: 4,
        color: 'var(--component-shield)',
        effect: 'Target only if no other higher priority solution exists or after disable.',
        positions: {
          top: { x: 38.1, y: 27.9, w: 0, h: 0, wPx: 103, hPx: 33 },
        },
      },
      {
        id: 'idr-shield-port',
        label: 'Port Shield Generator',
        shortLabel: 'Shield 2',
        groupId: 'idr-shield',
        priority: 4,
        color: 'var(--component-shield)',
        effect: 'Target only if no other higher priority solution exists or after disable. Housed behind the forward port nacelle.',
        positions: {
          top:  { x: 38.1, y: 69,   w: 0, h: 0, wPx: 103, hPx: 33 },
          side: { x: 37.6, y: 73.4, w: 0, h: 0, wPx: 48,  hPx: 37 },
        },
      },

      // ── QT Drive ───────────────────────────────────────────────────────────
      {
        id: 'idr-qt',
        label: 'Quantum Drive',
        shortLabel: 'QT Drive',
        priority: 3,
        color: 'var(--component-qt)',
        effect: 'Drive is housed on the hangar level. Visible from top aspect, slightly rear and center of the forward port shoulder turret. If lower port MAV thruster is in view drive will be visible just forward of it.',
        positions: {
          top:  { x: 56.6, y: 69,   w: 0, h: 0, wPx: 103, hPx: 33 },
          side: { x: 58.5, y: 74.4, w: 0, h: 0, wPx: 48,  hPx: 37 },
        },
      },

      // ── Radar ──────────────────────────────────────────────────────────────
      {
        id: 'idr-radar',
        label: 'Radar',
        shortLabel: 'Radar',
        priority: 3,
        color: 'var(--component-radar)',
        effect: 'Housed on the roof of the bridge. Radar can be destroyed rapidly and effectively by properly equipped fighters or heavy gunships.',
        positions: {
          top:  { x: 61.8, y: 50.8, w: 0, h: 0, wPx: 32, hPx: 32 },
          side: { x: 61.7, y: 24.8, w: 0, h: 0, wPx: 56, hPx: 42 },
        },
      },

      // ── Weapons ────────────────────────────────────────────────────────────
      {
        id: 'idr-nose-gun',
        label: 'Manned Turret — S5/S7 x2',
        shortLabel: 'Nose Gun',
        priority: 1,
        color: 'var(--component-gun)',
        effect: 'Potential S7 or Conqueror — suppress immediately, extremely high damage outputs.',
        positions: {
          top: { x: 5.5, y: 48, w: 0, h: 0, wPx: 134, hPx: 97 },
        },
      },
      {
        id: 'idr-stbd-shoulder-1',
        label: 'Starboard Manned Turret — S5 x2',
        shortLabel: 'Stbd. Shoulder',
        groupId: 'idr-stbd-shoulder',
        priority: 1,
        color: 'var(--component-gun)',
        effect: 'Secondary suppression target.',
        positions: {
          top: { x: 56.5, y: 18.8, w: 0, h: 0, wPx: 141, hPx: 89 },
        },
      },
      {
        id: 'idr-stbd-shoulder-2',
        label: 'Starboard Manned Turret — S5 x2',
        shortLabel: 'Stbd. Shoulder',
        groupId: 'idr-stbd-shoulder',
        priority: 1,
        color: 'var(--component-gun)',
        effect: 'Secondary suppression target.',
        positions: {
          top: { x: 70.5, y: 18.8, w: 0, h: 0, wPx: 141, hPx: 89 },
        },
      },
      {
        id: 'idr-port-shoulder-1',
        label: 'Port Manned Turret — S5 x2',
        shortLabel: 'P. Shoulder',
        groupId: 'idr-port-shoulder',
        priority: 1,
        color: 'var(--component-gun)',
        effect: 'Secondary suppression target.',
        positions: {
          top: { x: 55.5, y: 79.9, w: 0, h: 0, wPx: 141, hPx: 89 },
        },
      },
      {
        id: 'idr-port-shoulder-2',
        label: 'Port Manned Turret — S5 x2',
        shortLabel: 'P. Shoulder',
        groupId: 'idr-port-shoulder',
        priority: 1,
        color: 'var(--component-gun)',
        effect: 'Secondary suppression target.',
        positions: {
          top: { x: 68.8, y: 79.9, w: 0, h: 0, wPx: 141, hPx: 89 },
        },
      },
      {
        id: 'idr-spinal',
        label: 'Railgun/Laser/Torpedo',
        shortLabel: 'Spinal',
        priority: 1,
        color: 'var(--component-gun)',
        effect: 'Primary Solodris weapons system. Do not prioritize unless instructed to.',
        positions: {
          side: { x: 15.9, y: 87, w: 0, h: 0, wPx: 424, hPx: 81 },
        },
      },

      // ── Navigation ─────────────────────────────────────────────────────────
      {
        id: 'idr-airlock',
        label: 'Port Airlock',
        shortLabel: 'Airlock',
        priority: 5,
        color: 'var(--component-navigation)',
        effect: 'Entry to the forward main deck.',
        positions: {
          side: { x: 34.2, y: 52.7, w: 0, h: 0, wPx: 80, hPx: 48 },
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
  5: 'Navigation — Entry Point',
}
