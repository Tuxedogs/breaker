import type { ReactNode } from 'react'

type SidebarWorkspaceProps = {
  leftSidebar: ReactNode
  children: ReactNode
  rightSidebar?: ReactNode
  className?: string
}

export default function SidebarWorkspace({
  leftSidebar,
  children,
  rightSidebar,
  className = '',
}: SidebarWorkspaceProps) {
  return (
    <section className={['sidebar-workspace', className].join(' ').trim()}>
      <aside className="sidebar-workspace-rail sidebar-workspace-rail-left self-start">
        {leftSidebar}
      </aside>

      <main className="sidebar-workspace-main self-start">
        {children}
      </main>

      {rightSidebar ? (
        <aside className="sidebar-workspace-rail sidebar-workspace-rail-right self-start">
          {rightSidebar}
        </aside>
      ) : null}
    </section>
  )
}
