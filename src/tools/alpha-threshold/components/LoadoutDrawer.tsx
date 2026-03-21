import { createPortal } from 'react-dom'
import { useEffect, type ReactNode } from 'react'

type Props = {
  mode: 'ships' | 'weapons' | null
  onClose: () => void
  onOpenShips: () => void
  onOpenWeapons: () => void
  children: ReactNode
}

export function LoadoutDrawer({
  mode,
  onClose,
  onOpenShips,
  onOpenWeapons,
  children,
}: Props) {
  useEffect(() => {
    if (!mode) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [mode, onClose])

  if (!mode) return null

  return createPortal(
    <div className="alpha-tool-route alpha-loadout-portal-root">
      <div
        className="alpha-loadout-drawer-backdrop"
        onMouseDown={onClose}
        aria-hidden="true"
      />
      <aside
        className="alpha-loadout-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alpha-loadout-drawer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="alpha-loadout-drawer-head">
          <div>
            <p className="page-kicker">Selection Drawer</p>
            <h2 id="alpha-loadout-drawer-title" className="surface-title mt-3">
              {mode === 'ships' ? 'Edit Victim Ships' : 'Edit Weapon Loadout'}
            </h2>
          </div>
          <div className="alpha-loadout-drawer-tabs" role="tablist" aria-label="Selection panels">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'ships'}
              className={[
                'alpha-loadout-drawer-tab',
                mode === 'ships' ? 'alpha-loadout-drawer-tab-active' : '',
              ].filter(Boolean).join(' ')}
              onClick={onOpenShips}
            >
              Ships
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'weapons'}
              className={[
                'alpha-loadout-drawer-tab',
                mode === 'weapons' ? 'alpha-loadout-drawer-tab-active' : '',
              ].filter(Boolean).join(' ')}
              onClick={onOpenWeapons}
            >
              Weapons
            </button>
            <button
              type="button"
              className="alpha-top-strip-button"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </header>

        <div className="alpha-loadout-drawer-body">{children}</div>
      </aside>
    </div>,
    document.body
  )
}
