import type { GunnerySection } from '../types'

type NavItem = {
  id: GunnerySection
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'mode-recommender', label: 'Recommended Modes' },
  { id: 'sub-targeting',    label: 'Component Mapping' },
  { id: 'diagnosis',        label: 'Failure Diagnosis' },
]

type Props = {
  active: GunnerySection
  onChange: (section: GunnerySection) => void
  isOpen: boolean
}

export function GunnerySectionNav({ active, onChange, isOpen }: Props) {
  return (
    <nav className={`gun-nav${isOpen ? '' : ' is-collapsed'}`}>
      <div className="gun-nav-inner">
        <div className="gun-nav-header">
          <p className="tool-section-label">Tool Sections</p>
          <span className="gun-nav-title">Gunnery</span>
        </div>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`gun-nav-item tool-choice-button${active === item.id ? ' is-active' : ''}`}
            aria-pressed={active === item.id}
            onClick={() => onChange(item.id)}
          >
            <span className="gun-nav-item-dot" />
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
