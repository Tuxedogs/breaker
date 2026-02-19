function Header() {
  return (
    <header className="glass-panel rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/90 shadow-[0_0_16px_rgba(255,255,255,0.7)]" />
          <p className="hud-title text-lg font-semibold tracking-tight text-white">ARES</p>
        </div>
        <nav className="hidden items-center gap-7 text-sm text-slate-300 sm:flex">
          <a className="transition hover:text-white" href="/docs/introduction">Overview</a>
          <a className="transition hover:text-white" href="/docs/getting-started">Systems</a>
          <a className="transition hover:text-white" href="/docs/writing-mdx">Doctrine</a>
        </nav>
      </div>
      <div className="mt-4 border-t border-white/10 pt-4">
        <h1 className="hud-title text-2xl font-semibold text-white sm:text-3xl">This is the H1 of the header</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
          This is the H2 of the header.
        </p>
      </div>
    </header>
  )
}

export default Header
