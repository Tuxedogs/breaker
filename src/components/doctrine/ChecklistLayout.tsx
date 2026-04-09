import type { DoctrineModule } from "../../data/modules";

export function ChecklistLayout({ module }: { module: DoctrineModule }) {
  return (
    <div className="doctrine-layout-shell doctrine-layout--checklist space-y-1.5">
      {/* Hero */}
      <article className="doctrine-card p-3 sm:p-4">
        <header className="doctrine-hero-shell">
          <div className="doctrine-hero-copy">
            <p className="doctrine-hero-eyebrow">Checklist</p>
            <h1 className="doctrine-hero-title">{module.title}</h1>
            {module.summary ? (
              <p className="doctrine-hero-summary">{module.summary}</p>
            ) : null}
          </div>
          <div className="doctrine-meta-row">
            <div className="doctrine-meta-item">
              <span className="doctrine-meta-label">Status</span>
              <span className="doctrine-meta-value">{module.status}</span>
            </div>
            {module.validatedDate ? (
              <div className="doctrine-meta-item">
                <span className="doctrine-meta-label">Validated</span>
                <span className="doctrine-meta-value">{module.validatedDate}</span>
              </div>
            ) : null}
            <div className="doctrine-meta-item">
              <span className="doctrine-meta-label">Owner</span>
              <span className="doctrine-meta-value">{module.owner}</span>
            </div>
          </div>
        </header>
      </article>

      {/* Phases */}
      {module.phases && module.phases.length > 0 ? (
        <article className="doctrine-card p-3 sm:p-4">
          <p className="doctrine-framework-section-label">Phases</p>
          <div className="doctrine-phase-grid">
            {module.phases.map((phase, i) => (
              <div key={i} className="doctrine-phase">
                <p className="doctrine-phase-label">{phase.label}</p>
                <ul className="doctrine-phase-items">
                  {phase.items.map((item, j) => (
                    <li key={j} className="doctrine-phase-item">
                      <span className="doctrine-phase-check" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {/* Body prose */}
      <article className="doctrine-card p-3 sm:p-4">
        <div className="doctrine-framework-prose">
          <module.Content />
        </div>
      </article>
    </div>
  );
}
