import type { GunnerySection } from '../types'

type NavItem = {
  id: GunnerySection
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'mode-recommender', label: 'Recommended Modes' },
  { id: 'scenarios',        label: 'Scenarios' },
  { id: 'sub-targeting',    label: 'Sub-Target Trainer' },
  { id: 'diagnosis',        label: 'Failure Diagnosis' },
]

type Props = {
  active: GunnerySection
  onChange: (section: GunnerySection) => void
}

export function GunnerySectionNav({ active, onChange }: Props) {
  return (
    <nav className="gun-nav">
      <div className="gun-nav-header">
        <p className="tool-section-label">Tool Sections</p>
        <span className="gun-nav-title">Gunnery</span>
      </div>
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          className={`gun-nav-item tool-choice-button${active === item.id ? ' is-active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          <span className="gun-nav-item-dot" />
          {item.label}
        </button>
      ))}
    </nav>
  )
}
