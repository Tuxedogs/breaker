import type { DoctrineModule } from "../../data/modules";

export function ConceptLayout({ module }: { module: DoctrineModule }) {
  return (
    <div className="doctrine-layout-shell doctrine-layout--concept space-y-1.5">
      <article className="doctrine-card p-3 sm:p-4">
        <header className="doctrine-hero-shell">
          <div className="doctrine-hero-copy">
            <p className="doctrine-hero-eyebrow">Concept</p>
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
      <article className="doctrine-card p-3 sm:p-4">
        <div className="doctrine-framework-prose">
          <module.Content />
        </div>
      </article>
    </div>
  );
}
