import './gunnery.css'
import { useState } from 'react'
import { useGunneryState } from './hooks/useGunneryState'
import { GunnerySectionNav } from './components/GunnerySectionNav'
import { GunneryContentArea } from './components/GunneryContentArea'

export function GunneryToolPage() {
  const state = useGunneryState()
  const [navOpen, setNavOpen] = useState(true)

  return (
    <div className="gun-tool">
      <div className="gun-layout">
        <GunnerySectionNav
          active={state.activeSection}
          onChange={state.setActiveSection}
          isOpen={navOpen}
        />
        <button
          className="gun-nav-toggle"
          onClick={() => setNavOpen(o => !o)}
          aria-label={navOpen ? 'Collapse navigation' : 'Expand navigation'}
        >
          <span className={`gun-nav-chevron${navOpen ? '' : ' is-flipped'}`}>‹</span>
        </button>
        <GunneryContentArea state={state} />
      </div>
    </div>
  )
}
