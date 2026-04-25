import type { GunnerySection } from '../types'

type NavItem = {
  id: GunnerySection
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'sub-targeting',    label: 'Component Mapping' },
  { id: 'mode-recommender', label: 'Recommended Modes' },
  { id: 'diagnosis',        label: 'Failure Diagnosis' },
  { id: 'ground-school',    label: 'Ground School' },
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
        {NAV_ITEMS.map(item => {
          const disabled = item.id === 'diagnosis'
          return (
            <button
              key={item.id}
              className={`gun-nav-item tool-choice-button${active === item.id ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
              aria-pressed={active === item.id}
              disabled={disabled}
              onClick={() => !disabled && onChange(item.id)}
            >
              <span className="gun-nav-item-dot" />
              {item.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
