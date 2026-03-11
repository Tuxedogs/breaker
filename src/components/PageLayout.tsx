import type { ReactNode } from 'react'

type PageLayoutProps = {
  title: string
  summary: string
  children: ReactNode
  contentClassName?: string
}

function PageLayout({
  children,
  contentClassName = 'max-w-4xl',
}: PageLayoutProps) {
  return (
    <main className="glass-panel rounded-2xl p-6 sm:p-8 lg:p-10">
      <article className={`doc-content ${contentClassName}`}>{children}</article>
    </main>
  )
}

export default PageLayout
