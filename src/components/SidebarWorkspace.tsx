import type { ReactNode } from 'react'

type SidebarWorkspaceProps = {
  sidebar: ReactNode
  children: ReactNode
  className?: string
}

export default function SidebarWorkspace({
  sidebar,
  children,
  className = '',
}: SidebarWorkspaceProps) {
  return (
    <section className={['sidebar-workspace', className].join(' ').trim()}>
      <aside className="sidebar-workspace-rail">
        {sidebar}
      </aside>

      <main className="sidebar-workspace-main">
        {children}
      </main>
    </section>
  )
}
