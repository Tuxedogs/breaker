import './gunnery.css'
import { useGunneryState } from './hooks/useGunneryState'
import { GunnerySectionNav } from './components/GunnerySectionNav'
import { GunneryContentArea } from './components/GunneryContentArea'

export function GunneryToolPage() {
  const state = useGunneryState()

  return (
    <div className="gun-tool">
      <div className="gun-layout">
        <GunnerySectionNav
          active={state.activeSection}
          onChange={state.setActiveSection}
        />
        <GunneryContentArea state={state} />
      </div>
    </div>
  )
}
