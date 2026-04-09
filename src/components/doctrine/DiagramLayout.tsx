import type { DoctrineModule } from "../../data/modules";

export function DiagramLayout({ module }: { module: DoctrineModule }) {
  return (
    <div className="doctrine-layout-shell doctrine-layout--diagram space-y-1.5">
      {/* Hero */}
      <article className="doctrine-card p-3 sm:p-4">
        <header className="doctrine-hero-shell">
          <div className="doctrine-hero-copy">
            <p className="doctrine-hero-eyebrow">Diagram</p>
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

      {/* Diagram asset */}
      <article className="doctrine-card p-3 sm:p-4">
        <div className="doctrine-diagram-frame">
          {module.assetPath ? (
            <img
              src={module.assetPath}
              alt={module.caption ?? module.title}
              className="doctrine-diagram-img"
            />
          ) : (
            <div className="doctrine-diagram-placeholder">
              <span>No diagram asset</span>
            </div>
          )}
        </div>
        {module.caption ? (
          <p className="doctrine-diagram-caption">{module.caption}</p>
        ) : null}
        {module.legend && module.legend.length > 0 ? (
          <div className="doctrine-diagram-legend">
            {module.legend.map((item, i) => (
              <div key={i} className="doctrine-diagram-legend-item">
                <span
                  className="doctrine-diagram-legend-swatch"
                  style={{ background: item.color }}
                />
                <span className="doctrine-diagram-legend-label">{item.label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </article>

      {/* Body prose */}
      <article className="doctrine-card p-3 sm:p-4">
        <div className="doctrine-framework-prose">
          <module.Content />
        </div>
      </article>
    </div>
  );
}
