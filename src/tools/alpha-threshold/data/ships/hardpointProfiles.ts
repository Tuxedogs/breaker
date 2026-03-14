import type { Ship, ShipHardpointGroup } from '../../types'

const PROFILES: Record<string, ShipHardpointGroup[]> = {
  Scorpius: [
    {
      id: 'pilot-s3',
      role: 'pilot',
      label: 'Pilot S3 x4',
      size: 3,
      count: 4,
    },
    {
      id: 'turret-s3',
      role: 'turret',
      label: 'Remote Turret S3 x4',
      size: 3,
      count: 4,
    },
  ],
  Hurricane: [
    {
      id: 'pilot-s3',
      role: 'pilot',
      label: 'Pilot S3 x2',
      size: 3,
      count: 2,
    },
    {
      id: 'turret-s3',
      role: 'turret',
      label: 'Turret S3 x4',
      size: 3,
      count: 4,
    },
  ],
  Cutlass_Black: [
    {
      id: 'pilot-s3',
      role: 'pilot',
      label: 'Pilot S3 x4',
      size: 3,
      count: 4,
    },
    {
      id: 'turret-s3',
      role: 'turret',
      label: 'Turret S3 x2',
      size: 3,
      count: 2,
    },
  ],
}

function getFallbackHardpoints(ship: Ship): ShipHardpointGroup[] {
  if (ship.sizeGroup === 'capital' || ship.sizeGroup === 'large') {
    return [
      {
        id: 'pilot-s5',
        role: 'pilot',
        label: 'Pilot S5 x2',
        size: 5,
        count: 2,
      },
      {
        id: 'turret-s4',
        role: 'turret',
        label: 'Turret S4 x4',
        size: 4,
        count: 4,
      },
    ]
  }

  if (ship.sizeGroup === 'small') {
    return [
      {
        id: 'pilot-s3',
        role: 'pilot',
        label: 'Pilot S3 x3',
        size: 3,
        count: 3,
      },
    ]
  }

  return [
    {
      id: 'pilot-s3',
      role: 'pilot',
      label: 'Pilot S3 x4',
      size: 3,
      count: 4,
    },
    {
      id: 'turret-s3',
      role: 'turret',
      label: 'Turret S3 x2',
      size: 3,
      count: 2,
    },
  ]
}

export function resolveShipHardpointGroups(ship: Ship | null): ShipHardpointGroup[] {
  if (!ship) return []

  if (ship.hardpointGroups && ship.hardpointGroups.length > 0) {
    return ship.hardpointGroups
  }

  return PROFILES[ship.name] ?? getFallbackHardpoints(ship)
}
