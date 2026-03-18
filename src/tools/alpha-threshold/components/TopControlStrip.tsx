import { DataSourceSelector } from './DataSourceSelector'
import { thresholdDataSourceOptions } from '../data/sourceOptions'
import type { ReactNode } from 'react'
import type { ThresholdDataSourceKey } from '../types'

type Props = {
  activeSource: ThresholdDataSourceKey
  onSourceChange: (source: ThresholdDataSourceKey) => void
  selectedWeaponCount: number
  selectedShipCount: number
  onOpenWeapons: () => void
  onOpenShips: () => void
  onClearAllWeapons: () => void
  onClearAllShips: () => void
  changelogControl?: ReactNode
}

export function TopControlStrip({
  activeSource,
  onSourceChange,
  selectedWeaponCount,
  selectedShipCount,
  onOpenWeapons,
  onOpenShips,
  onClearAllWeapons,
  onClearAllShips,
  changelogControl,
}: Props) {
  return (
    <section className="alpha-top-control-strip" aria-label="Threshold controls">
      <div className="alpha-top-control-strip-primary">
        <div className="alpha-top-control-strip-source">
          <span className="alpha-top-control-strip-label">Source</span>
          <DataSourceSelector
            activeSource={activeSource}
            sourceOptions={thresholdDataSourceOptions}
            onSourceChange={onSourceChange}
          />
        </div>

        <div className="alpha-top-control-strip-status">
          <span className="alpha-top-strip-pill">
            {selectedWeaponCount} {selectedWeaponCount === 1 ? 'weapon' : 'weapons'}
          </span>
          <span className="alpha-top-strip-pill">
            {selectedShipCount} {selectedShipCount === 1 ? 'ship' : 'ships'}
          </span>
        </div>
      </div>

      <div className="alpha-top-control-strip-actions">
        <button type="button" className="alpha-top-strip-button alpha-top-strip-button-primary" onClick={onOpenWeapons}>
          Edit Weapons
        </button>
        <button type="button" className="alpha-top-strip-button alpha-top-strip-button-primary" onClick={onOpenShips}>
          Edit Ships
        </button>
        <button type="button" className="alpha-top-strip-button" onClick={onClearAllWeapons}>
          Clear Weapons
        </button>
        <button type="button" className="alpha-top-strip-button" onClick={onClearAllShips}>
          Clear Ships
        </button>
        {changelogControl ? (
          <div className="alpha-top-control-strip-changelog">{changelogControl}</div>
        ) : null}
      </div>
    </section>
  )
}
