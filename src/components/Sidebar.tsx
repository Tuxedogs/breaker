import { NavLink } from 'react-router-dom'
import { nav } from '../nav'

function Sidebar() {
  return (
    <aside className="glass-panel rounded-2xl p-4 lg:sticky lg:top-5 lg:h-[calc(100vh-3.5rem)] lg:p-5">
      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <p className="text-xs uppercase tracking-[0.18em] text-white/70">Doctrine Index</p>
        <span className="text-xs text-slate-400">v0.1</span>
      </div>

      <nav className="space-y-3">
        {nav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              [
                'block rounded-xl border px-4 py-3 transition',
                isActive
                  ? 'border-cyan-200/45 bg-cyan-100/10 text-white shadow-[0_0_24px_rgba(88,202,255,0.15)]'
                  : 'border-white/15 bg-black/15 text-slate-200 hover:border-white/30 hover:bg-white/[0.075]',
              ].join(' ')
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="hud-title text-base font-semibold leading-6">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{item.summary}</p>
              </div>
              <span className="pt-0.5 text-sm text-slate-400">-&gt;</span>
            </div>
          </NavLink>
        ))}
      </nav>

      <div className="mt-6 border-t border-white/10 pt-4 text-xs text-slate-500">2026 ARES</div>
    </aside>
  )
}

export default Sidebar
