import type { ReactNode } from 'react'

type Props = {
  mobileOpen: boolean
  children?: ReactNode
}

export function ShipSelectionSidebar({
  mobileOpen,
  children,
}: Props) {
  return (
    <aside
      className={[
        'alpha-sidebar',
        mobileOpen ? 'block' : 'hidden',
        'lg:block',
      ].join(' ')}
    >
      {children}
    </aside>
  )
}
