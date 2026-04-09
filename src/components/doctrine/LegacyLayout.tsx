import type { DoctrineModule } from "../../data/modules";

export function LegacyLayout({ module }: { module: DoctrineModule }) {
  return (
    <div className="doctrine-layout-shell doctrine-layout--legacy space-y-1.5">
      <article className="doctrine-card p-3 sm:p-4">
        <header className="doctrine-hero-shell">
          <div className="doctrine-hero-copy">
            <p className="doctrine-hero-eyebrow">Operational Doctrine</p>
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
            <div className="doctrine-meta-item">
              <span className="doctrine-meta-label">Type</span>
              <span className="doctrine-meta-value">{module.moduleType}</span>
            </div>
            <div className="doctrine-meta-item">
              <span className="doctrine-meta-label">Owner</span>
              <span className="doctrine-meta-value">{module.owner}</span>
            </div>
          </div>
          <div className="doctrine-legacy-warning">
            This module uses a legacy layout type and needs migration.
          </div>
        </header>
      </article>
    </div>
  );
}
