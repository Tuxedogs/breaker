import type { DoctrineModule } from "../../data/modules";

export function ProcedureLayout({ module }: { module: DoctrineModule }) {
  return (
    <div className="doctrine-layout-shell doctrine-layout--procedure space-y-1.5">
      {/* Hero */}
      <article className="doctrine-card p-3 sm:p-4">
        <header className="doctrine-hero-shell">
          <div className="doctrine-hero-copy">
            <p className="doctrine-hero-eyebrow">Procedure</p>
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

      {/* Use when */}
      {module.useWhen && module.useWhen.length > 0 ? (
        <article className="doctrine-card p-3 sm:p-4">
          <p className="doctrine-framework-section-label">Use When</p>
          <ul className="doctrine-use-when-list">
            {module.useWhen.map((item, i) => (
              <li key={i} className="doctrine-use-when-item">{item}</li>
            ))}
          </ul>
        </article>
      ) : null}

      {/* Steps */}
      {module.steps && module.steps.length > 0 ? (
        <article className="doctrine-card p-3 sm:p-4">
          <p className="doctrine-framework-section-label">Execution</p>
          <ol className="doctrine-step-list">
            {module.steps.map((step, i) => (
              <li key={i} className="doctrine-step-item">
                <span className="doctrine-step-index">{i + 1}</span>
                <div className="doctrine-step-body">
                  <span className="doctrine-step-label">{step.label}</span>
                  {step.detail ? (
                    <p className="doctrine-step-detail">{step.detail}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </article>
      ) : null}

      {/* Failure modes */}
      {module.failureModes && module.failureModes.length > 0 ? (
        <article className="doctrine-card p-3 sm:p-4">
          <p className="doctrine-framework-section-label">Failure Modes</p>
          <ul className="doctrine-brief-list" style={{ marginTop: 0 }}>
            {module.failureModes.map((item, i) => (
              <li key={i} className="doctrine-brief-item">
                <span className="doctrine-brief-title">{item}</span>
              </li>
            ))}
          </ul>
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
