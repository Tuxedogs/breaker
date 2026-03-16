import type { ThresholdDataSourceKey } from '../types'

export type ThresholdDataSourceOption = {
  value: ThresholdDataSourceKey
  label: string
  description: string
}

export const thresholdDataSourceOptions: ThresholdDataSourceOption[] = [
  {
    value: 'merged',
    label: 'Merged',
    description: 'Uses the best available values from manual, Erkul, and SPViewer snapshots.',
  },
  {
    value: 'erkul-live',
    label: 'Erkul Live',
    description: 'Production Erkul ship and weapon data.',
  },
  {
    value: 'erkul-ptu',
    label: 'Erkul PTU',
    description: 'PTU Erkul ship and weapon data.',
  },
  {
    value: 'spviewer',
    label: 'SPViewer',
    description: 'SPViewer ship and weapon data.',
  },
  {
    value: 'manual',
    label: 'Manual',
    description: 'Local manual fallback values.',
  },
]
