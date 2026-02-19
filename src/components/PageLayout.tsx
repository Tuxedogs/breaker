import type { ReactNode } from 'react'

type PageLayoutProps = {
  title: string
  summary: string
  children: ReactNode
}

function PageLayout({ title, summary, children }: PageLayoutProps) {
  return (
    <main className="glass-panel rounded-2xl p-6 sm:p-8 lg:p-10">
      <div className="mb-8 border-b border-white/10 pb-6">
        <h2 className="hud-title text-3xl font-semibold text-white sm:text-4xl">{title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">{summary}</p>
      </div>
      <article className="doc-content max-w-4xl">{children}</article>
    </main>
  )
}

export default PageLayout
